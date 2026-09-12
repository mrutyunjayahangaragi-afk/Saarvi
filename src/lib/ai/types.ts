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

export interface StudyExplanationResult {
  explanation: string;
  keyConcepts: string[];
  sampleQuestions: string[];
  revisionPoints: string[];
  model?: string;
  provider?: string;
}

export interface AIProvider {
  name: string;
  isAvailable(): boolean;
  generateText(prompt: string, options?: AIOptions): Promise<string>;
  generateChat?(
    systemPrompt: string,
    userPrompt: string,
    jsonMode?: boolean,
    options?: AIOptions
  ): Promise<string>;
  summarize(text: string, options?: AISummaryOptions, aiOptions?: AIOptions): Promise<AISummaryResult>;
  answerQuestion(
    question: string,
    chunks: ContextChunk[],
    aiOptions?: AIOptions
  ): Promise<AIQuestionResponse>;
  extractStructuredData(
    text: string,
    schema: StructuredExtractionSchema,
    aiOptions?: AIOptions
  ): Promise<Record<string, unknown>>;
  analyzeResume(
    resumeText: string,
    targetRole?: string,
    aiOptions?: AIOptions
  ): Promise<ResumeFeedbackResult>;
  analyzeJobDescription(
    jobText: string,
    candidateSkills?: string[],
    aiOptions?: AIOptions
  ): Promise<JobAnalysisResult>;
  explainStudyMaterial(
    materialText: string,
    topic?: string,
    aiOptions?: AIOptions
  ): Promise<StudyExplanationResult>;
}
