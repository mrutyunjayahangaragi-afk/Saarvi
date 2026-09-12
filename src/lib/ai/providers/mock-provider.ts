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

export class MockAIProvider implements AIProvider {
  public readonly name = "MockAIProvider";

  isAvailable(): boolean {
    // Disabled in production
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_IN_PROD !== "true") {
      return false;
    }
    return true;
  }

  private ensureAvailable() {
    if (!this.isAvailable()) {
      throw new Error("Mock AI provider is strictly disabled in production environments.");
    }
  }

  async generateText(prompt: string, _options?: AIOptions): Promise<string> {
    this.ensureAvailable();
    return `[Mock AI Response for: "${prompt.slice(0, 40)}..."]`;
  }

  async generateChat(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = false,
    _options?: AIOptions
  ): Promise<string> {
    this.ensureAvailable();

    if (jsonMode) {
      if (systemPrompt.includes("Mock Interview Coach")) {
        return JSON.stringify({
          question: "Can you explain how you approach indexing in relational databases and when a B-tree index might degrade performance?",
          feedback: {
            rating: "Strong",
            notes: "Clear and well-structured response demonstrating sound conceptual grasp.",
            tips: [
              "Quantify performance impacts with concrete examples.",
              "Discuss composite index column ordering rules."
            ]
          }
        });
      }

      const qLower = userPrompt.toLowerCase();
      let intent = "GENERAL";
      let actions: any[] = [];

      if (qLower.includes("study") || qLower.includes("plan")) {
        intent = "STUDY_PLANNING";
        actions = [
          {
            id: `act_${Date.now()}_1`,
            type: "create_study_session",
            title: "Study Database Management Systems",
            description: "Review Relational Algebra & SQL joins",
            payload: {
              subject: "Database Management Systems",
              date: new Date().toISOString().split("T")[0],
              startTime: "18:00",
              durationMinutes: 60,
              priority: "HIGH"
            },
            status: "suggested"
          }
        ];
      } else if (qLower.includes("task") || qLower.includes("assignment")) {
        intent = "TASK";
        actions = [
          {
            id: `act_${Date.now()}_task`,
            type: "create_task",
            title: "Submit DBMS Assignment Module 3",
            description: "Complete query optimization exercises",
            payload: {
              title: "Submit DBMS Assignment Module 3",
              priority: "HIGH",
              dueDate: new Date().toISOString().split("T")[0]
            },
            status: "suggested"
          }
        ];
      } else if (qLower.includes("interview") || qLower.includes("career")) {
        intent = "INTERVIEW";
      }

      return JSON.stringify({
        message: `I've analyzed your request and workspace context. Here are my grounded recommendations.\n\n- Prioritize high-weightage topics first.\n- Maintain consistent study blocks.\n- Ensure attendance remains above VTU's 75% threshold.`,
        intent,
        suggestedActions: actions,
        citations: ["Workspace Records", "Student Timetable"]
      });
    }

    return `[Mock AI Chat Response for query: "${userPrompt.slice(0, 50)}..."]`;
  }

  async summarize(
    text: string,
    options?: AISummaryOptions,
    _aiOptions?: AIOptions
  ): Promise<AISummaryResult> {
    this.ensureAvailable();
    const length = options?.length || "standard";
    const charCount = text.length;

    let summary = `This document contains approximately ${charCount} characters covering essential details and instructions.`;
    if (length === "brief") {
      summary = `Brief overview: Document outlines core topics spanning ${charCount} characters.`;
    } else if (length === "detailed") {
      summary = `In-depth synthesis: The document encompasses ${charCount} characters, outlining structured procedures, key constraints, and operational guidelines for the reader.`;
    }

    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const keyPoints = [
      sentences[0] || "Primary subject overview and introductory context.",
      sentences[1] || "Specific requirements, workflow processes, or key parameters.",
      sentences[2] || "Summary of conclusions, milestones, and actionable recommendations.",
    ];

    return {
      summary,
      keyPoints,
      charCount,
      provider: "mock",
      model: "mock-ai-v1",
    };
  }

  async answerQuestion(
    question: string,
    chunks: ContextChunk[],
    _aiOptions?: AIOptions
  ): Promise<AIQuestionResponse> {
    this.ensureAvailable();

    if (!chunks || chunks.length === 0) {
      return {
        answer: "I could not find information about that in the provided document.",
        citedContext: [],
        model: "mock-ai-v1",
        provider: "mock",
      };
    }

    const citedChunk = chunks[0];
    const citedContext = [citedChunk.text.slice(0, 100)];
    const citedPages = citedChunk.pageNumber ? [citedChunk.pageNumber] : undefined;

    return {
      answer: `Based on the document excerpts, "${question.slice(0, 40)}" relates directly to: ${citedChunk.text.slice(0, 120)}...`,
      citedContext,
      citedPages,
      model: "mock-ai-v1",
      provider: "mock",
    };
  }

  async extractStructuredData(
    text: string,
    schema: StructuredExtractionSchema,
    _aiOptions?: AIOptions
  ): Promise<Record<string, unknown>> {
    this.ensureAvailable();
    const result: Record<string, unknown> = {};

    for (const field of schema.fields) {
      if (field.name.toLowerCase().includes("date")) {
        result[field.name] = "2025-06-15";
      } else if (field.name.toLowerCase().includes("amount") || field.type === "number") {
        result[field.name] = 1250.0;
      } else if (field.type === "array") {
        result[field.name] = ["Extracted Item 1", "Extracted Item 2"];
      } else {
        result[field.name] = `Extracted ${field.name}`;
      }
    }

    return result;
  }

  async analyzeResume(
    resumeText: string,
    targetRole?: string,
    _aiOptions?: AIOptions
  ): Promise<ResumeFeedbackResult> {
    this.ensureAvailable();

    const roleName = targetRole || "Software Engineer";

    return {
      strengths: [
        "Clear section layout with identifiable technical skills.",
        "Demonstrated practical exposure to modern software tooling.",
      ],
      suggestions: [
        `Quantify project achievements with measurable business metrics for ${roleName} applications.`,
        "Incorporate specific action verbs at the beginning of each project bullet point.",
      ],
      missingAreas: [
        "Include a targeted summary statement tailored to your target industry.",
        "Ensure all project links or repositories are actively verified.",
      ],
      claritySuggestions: [
        "Consolidate repetitive technology mentions in the experience section.",
      ],
      atsFriendlyFormattingNotes: [
        "Deterministic formatting check: Standard single-column layout is recommended for automated scanners.",
      ],
      model: "mock-ai-v1",
      provider: "mock",
    };
  }

  async analyzeJobDescription(
    jobText: string,
    candidateSkills?: string[],
    _aiOptions?: AIOptions
  ): Promise<JobAnalysisResult> {
    this.ensureAvailable();

    // Extract simple tokens from text
    const lower = jobText.toLowerCase();
    const detectedSkills: string[] = [];
    const keywords = ["react", "typescript", "node.js", "python", "sql", "docker", "aws", "git"];

    for (const kw of keywords) {
      if (lower.includes(kw)) {
        detectedSkills.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    }

    if (detectedSkills.length === 0) {
      detectedSkills.push("Communication", "Problem Solving", "Analytical Skills");
    }

    return {
      role: "Engineering Specialist",
      requiredSkills: detectedSkills.slice(0, 3),
      preferredSkills: detectedSkills.slice(3),
      responsibilities: [
        "Design, build, and maintain efficient, reusable, and reliable code.",
        "Collaborate with cross-functional product and design teams.",
        "Ensure performance, quality, and responsiveness of applications.",
      ],
      keywords: detectedSkills,
      model: "mock-ai-v1",
      provider: "mock",
    };
  }

  async explainStudyMaterial(
    materialText: string,
    topic?: string,
    _aiOptions?: AIOptions
  ): Promise<StudyExplanationResult> {
    this.ensureAvailable();

    return {
      explanation: `Conceptual overview: The material explores ${topic || "core syllabus principles"} emphasizing algorithmic clarity and practical application.`,
      keyConcepts: [
        "Foundational terminology and definitions.",
        "System architecture and component interactions.",
        "Complexity trade-offs and performance implications.",
      ],
      sampleQuestions: [
        `What are the primary trade-offs introduced in ${topic || "this topic"}?`,
        "How does the proposed method compare with traditional implementations?",
      ],
      revisionPoints: [
        "Review key definitions and invariant conditions.",
        "Memorize time and space complexity boundaries.",
        "Practice standard exam problem variations.",
      ],
      model: "mock-ai-v1",
      provider: "mock",
    };
  }
}
