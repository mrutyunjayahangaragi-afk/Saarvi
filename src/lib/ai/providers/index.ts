import { AIProvider } from "../types";
import { MockAIProvider } from "./mock-provider";
import { GeminiAIProvider } from "./gemini-provider";
import { OpenRouterAIProvider } from "./openrouter-provider";
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
import { StudyExplanationResult } from "../types";

export class NullAIProvider implements AIProvider {
  public readonly name = "NullAIProvider";

  isAvailable(): boolean {
    return false;
  }

  private throwUnavailable(): never {
    throw new Error("AI assistance is currently unavailable. No AI provider is configured.");
  }

  async generateText(_prompt: string, _options?: AIOptions): Promise<string> {
    this.throwUnavailable();
  }

  async generateChat(
    _systemPrompt: string,
    _userPrompt: string,
    _jsonMode?: boolean,
    _options?: AIOptions
  ): Promise<string> {
    this.throwUnavailable();
  }

  async summarize(
    _text: string,
    _options?: AISummaryOptions,
    _aiOptions?: AIOptions
  ): Promise<AISummaryResult> {
    this.throwUnavailable();
  }

  async answerQuestion(
    _question: string,
    _chunks: ContextChunk[],
    _aiOptions?: AIOptions
  ): Promise<AIQuestionResponse> {
    this.throwUnavailable();
  }

  async extractStructuredData(
    _text: string,
    _schema: StructuredExtractionSchema,
    _aiOptions?: AIOptions
  ): Promise<Record<string, unknown>> {
    this.throwUnavailable();
  }

  async analyzeResume(
    _resumeText: string,
    _targetRole?: string,
    _aiOptions?: AIOptions
  ): Promise<ResumeFeedbackResult> {
    this.throwUnavailable();
  }

  async analyzeJobDescription(
    _jobText: string,
    _candidateSkills?: string[],
    _aiOptions?: AIOptions
  ): Promise<JobAnalysisResult> {
    this.throwUnavailable();
  }

  async explainStudyMaterial(
    _materialText: string,
    _topic?: string,
    _aiOptions?: AIOptions
  ): Promise<StudyExplanationResult> {
    this.throwUnavailable();
  }
}

// Global cached provider instance
let cachedProvider: AIProvider | null = null;

export function getAIProvider(forceProvider?: string): AIProvider {
  if (forceProvider) {
    if (forceProvider === "mock") return new MockAIProvider();
    if (forceProvider === "gemini") return new GeminiAIProvider();
    if (forceProvider === "openrouter") return new OpenRouterAIProvider();
  }

  if (cachedProvider) return cachedProvider;

  const providerType = (process.env.AI_PROVIDER || "").toLowerCase().trim();

  // Test environment or explicit mock
  if (providerType === "mock" || process.env.NODE_ENV === "test") {
    cachedProvider = new MockAIProvider();
    return cachedProvider;
  }

  if (providerType === "gemini" || process.env.GEMINI_API_KEY) {
    const gemini = new GeminiAIProvider();
    if (gemini.isAvailable()) {
      cachedProvider = gemini;
      return cachedProvider;
    }
  }

  if (providerType === "openrouter" || process.env.OPENROUTER_API_KEY) {
    const openRouter = new OpenRouterAIProvider();
    if (openRouter.isAvailable()) {
      cachedProvider = openRouter;
      return cachedProvider;
    }
  }

  // If AI_API_KEY is provided without explicit provider, try Gemini first then OpenRouter
  if (process.env.AI_API_KEY) {
    const gemini = new GeminiAIProvider();
    if (gemini.isAvailable()) {
      cachedProvider = gemini;
      return cachedProvider;
    }
    const openRouter = new OpenRouterAIProvider();
    if (openRouter.isAvailable()) {
      cachedProvider = openRouter;
      return cachedProvider;
    }
  }

  // Development fallback to mock only if explicitly allowed or in dev mode
  if (process.env.NODE_ENV === "development") {
    cachedProvider = new MockAIProvider();
    return cachedProvider;
  }

  // Otherwise return NullAIProvider
  cachedProvider = new NullAIProvider();
  return cachedProvider;
}

export function resetAIProvider(): void {
  cachedProvider = null;
}
