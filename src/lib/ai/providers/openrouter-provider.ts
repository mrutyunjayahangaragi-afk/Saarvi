import {
  AISummaryOptions,
  AISummaryResult,
  ContextChunk,
  AIQuestionResponse,
  StructuredExtractionSchema,
  ResumeFeedbackResult,
  JobAnalysisResult,
  AIOptions,
} from "@/types/ai";
import { AIProvider, StudyExplanationResult } from "../types";
import { AI_LIMITS } from "../limits";
import {
  buildSummarizePrompt,
  buildQuestionAnsweringPrompt,
  buildStructuredExtractionPrompt,
  buildResumeFeedbackPrompt,
  buildJobAnalysisPrompt,
  buildStudyExplanationPrompt,
} from "../prompts/templates";

function cleanJsonText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

export class OpenRouterAIProvider implements AIProvider {
  public readonly name = "OpenRouterAIProvider";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "";
    this.model = model || process.env.OPENROUTER_MODEL || process.env.AI_TEXT_MODEL || "meta-llama/llama-3-8b-instruct";
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async callOpenRouter(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = false,
    options?: AIOptions
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("AI provider is not configured. Missing API key.");
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs || AI_LIMITS.AI_REQUEST_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: AI_LIMITS.MAX_OUTPUT_TOKENS,
      };

      if (jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://saarvi.app",
          "X-Title": "Saarvi Document Intelligence",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter responded with status ${res.status}: ${errText.slice(0, 100)}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("Empty response from AI service.");
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateText(prompt: string, options?: AIOptions): Promise<string> {
    return this.callOpenRouter("You are a helpful assistant.", prompt, false, options);
  }

  async generateChat(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = false,
    options?: AIOptions
  ): Promise<string> {
    return this.callOpenRouter(systemPrompt, userPrompt, jsonMode, options);
  }

  async summarize(
    text: string,
    options?: AISummaryOptions,
    aiOptions?: AIOptions
  ): Promise<AISummaryResult> {
    const { system, user } = buildSummarizePrompt(text, options);
    const raw = await this.callOpenRouter(system, user, true, aiOptions);
    const parsed = JSON.parse(cleanJsonText(raw));

    return {
      summary: parsed.summary || "Summary generated.",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      charCount: text.length,
      provider: "openrouter",
      model: this.model,
    };
  }

  async answerQuestion(
    question: string,
    chunks: ContextChunk[],
    aiOptions?: AIOptions
  ): Promise<AIQuestionResponse> {
    const { system, user } = buildQuestionAnsweringPrompt(question, chunks);
    const raw = await this.callOpenRouter(system, user, true, aiOptions);
    const parsed = JSON.parse(cleanJsonText(raw));

    return {
      answer: parsed.answer || "No direct answer found.",
      citedContext: Array.isArray(parsed.citedContext) ? parsed.citedContext : [],
      citedPages: Array.isArray(parsed.citedPages) ? parsed.citedPages : undefined,
      provider: "openrouter",
      model: this.model,
    };
  }

  async extractStructuredData(
    text: string,
    schema: StructuredExtractionSchema,
    aiOptions?: AIOptions
  ): Promise<Record<string, unknown>> {
    const { system, user } = buildStructuredExtractionPrompt(text, schema);
    const raw = await this.callOpenRouter(system, user, true, aiOptions);
    return JSON.parse(cleanJsonText(raw));
  }

  async analyzeResume(
    resumeText: string,
    targetRole?: string,
    aiOptions?: AIOptions
  ): Promise<ResumeFeedbackResult> {
    const { system, user } = buildResumeFeedbackPrompt(resumeText, targetRole);
    const raw = await this.callOpenRouter(system, user, true, aiOptions);
    const parsed = JSON.parse(cleanJsonText(raw));

    return {
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      missingAreas: Array.isArray(parsed.missingAreas) ? parsed.missingAreas : [],
      claritySuggestions: Array.isArray(parsed.claritySuggestions) ? parsed.claritySuggestions : [],
      provider: "openrouter",
      model: this.model,
    };
  }

  async analyzeJobDescription(
    jobText: string,
    candidateSkills?: string[],
    aiOptions?: AIOptions
  ): Promise<JobAnalysisResult> {
    const { system, user } = buildJobAnalysisPrompt(jobText, candidateSkills);
    const raw = await this.callOpenRouter(system, user, true, aiOptions);
    const parsed = JSON.parse(cleanJsonText(raw));

    return {
      role: parsed.role || "Target Role",
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : [],
      responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      provider: "openrouter",
      model: this.model,
    };
  }

  async explainStudyMaterial(
    materialText: string,
    topic?: string,
    aiOptions?: AIOptions
  ): Promise<StudyExplanationResult> {
    const { system, user } = buildStudyExplanationPrompt(materialText, topic);
    const raw = await this.callOpenRouter(system, user, true, aiOptions);
    const parsed = JSON.parse(cleanJsonText(raw));

    return {
      explanation: parsed.explanation || "Study explanation.",
      keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
      sampleQuestions: Array.isArray(parsed.sampleQuestions) ? parsed.sampleQuestions : [],
      revisionPoints: Array.isArray(parsed.revisionPoints) ? parsed.revisionPoints : [],
      provider: "openrouter",
      model: this.model,
    };
  }
}
