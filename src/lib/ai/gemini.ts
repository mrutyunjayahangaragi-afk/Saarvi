/**
 * Saarvi AI 2.0 Centralized Gemini Server Service
 *
 * Responsibilities:
 * - Read process.env.GEMINI_API_KEY / AI_API_KEY strictly on the server
 * - Enforce zero browser key leakage
 * - Handle model negotiation (gemini-3.6-flash / gemini-2.5-flash)
 * - Measure real round-trip network latency to Google Generative Language API
 * - Coordinate graceful offline deterministic tool discovery fallback
 * - Safe error normalization without leaking secrets
 */

export interface GeminiHealthStatus {
  configured: boolean;
  provider: "gemini";
  model: string;
  status: "connected" | "offline";
  latencyMs: number;
  message: string;
}

export interface GeminiGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface GeminiGenerateResult {
  text: string;
  latencyMs: number;
  model: string;
  isOfflineFallback: boolean;
  error?: string;
}

function getServerApiKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY VIOLATION: Gemini API key must never be accessed in browser context.");
  }
  return process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "";
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || process.env.AI_TEXT_MODEL || "gemini-3.6-flash";
}

/**
 * Pings Google Generative Language API and measures true round-trip network latency.
 * Strictly redacts API keys and secrets from output.
 */
export async function checkGeminiHealth(timeoutMs = 6000): Promise<GeminiHealthStatus> {
  const apiKey = getServerApiKey();
  const model = getGeminiModel();

  if (!apiKey) {
    return {
      configured: false,
      provider: "gemini",
      model,
      status: "offline",
      latencyMs: 0,
      message: "GEMINI_API_KEY not configured. Offline deterministic fallback active.",
    };
  }

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Ping models endpoint with key to test network connectivity and credential validity
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));

    if (res.ok) {
      return {
        configured: true,
        provider: "gemini",
        model,
        status: "connected",
        latencyMs,
        message: `Saarvi AI 2.0 Gemini Connected (${latencyMs}ms).`,
      };
    }

    if (res.status === 400 || res.status === 403) {
      return {
        configured: false,
        provider: "gemini",
        model,
        status: "offline",
        latencyMs,
        message: "Gemini API credential rejected. Offline deterministic fallback active.",
      };
    }

    // Temporary upstream service disruption / rate-limit (429/503)
    return {
      configured: true,
      provider: "gemini",
      model,
      status: "offline",
      latencyMs,
      message: `Gemini upstream busy (HTTP ${res.status}). Offline deterministic fallback active.`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const isTimeout = err instanceof Error && err.name === "AbortError";

    return {
      configured: true,
      provider: "gemini",
      model,
      status: "offline",
      latencyMs,
      message: isTimeout
        ? `Gemini connection timed out after ${timeoutMs}ms. Offline mode active.`
        : "Gemini network unreachable. Offline deterministic fallback active.",
    };
  }
}

/**
 * Server-authoritative generation with timeout and deterministic fallback.
 */
export async function generateWithGemini(options: GeminiGenerateOptions): Promise<GeminiGenerateResult> {
  const apiKey = getServerApiKey();
  const model = getGeminiModel();
  const timeoutMs = options.timeoutMs || 8000;

  if (!apiKey) {
    return {
      text: "",
      latencyMs: 0,
      model,
      isOfflineFallback: true,
      error: "GEMINI_API_KEY not set.",
    };
  }

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: options.prompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.3,
      },
    };

    if (options.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const data = await res.json();

    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        text: data.candidates[0].content.parts[0].text,
        latencyMs,
        model,
        isOfflineFallback: false,
      };
    }

    return {
      text: "",
      latencyMs,
      model,
      isOfflineFallback: true,
      error: data.error?.message || `HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return {
      text: "",
      latencyMs,
      model,
      isOfflineFallback: true,
      error: err instanceof Error ? err.message : "Unknown Gemini generation failure.",
    };
  }
}
