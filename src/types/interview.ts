export type InterviewMode = "text_mcq" | "live_video";

export type InterviewQuestionType =
  | "mcq"
  | "behavioral"
  | "technical_coding"
  | "system_design";

export type InterviewDifficulty = "Easy" | "Medium" | "Hard";

export type InterviewCompany =
  | "Google"
  | "Microsoft"
  | "Amazon"
  | "Infosys"
  | "TCS"
  | "Wipro"
  | "Accenture"
  | "General";

export interface InterviewQuestion {
  id: string;
  role: string;
  type: InterviewQuestionType;
  difficulty: InterviewDifficulty;
  company: InterviewCompany;
  question: string;
  options?: string[]; // For MCQ (indices 0, 1, 2, 3)
  correctAnswer?: number; // 0-indexed for MCQ (stored server-side or revealed post-answer)
  explanation?: string;
  rubric?: {
    criteria: string[];
    sampleStrongAnswer: string;
  };
  timeLimitSeconds: number; // authoritative countdown
  exposureCount: number;
}

export interface InterviewTurnResponse {
  questionId: string;
  userAnswer: string | number; // text or selected index
  timeSpentSeconds: number;
  isCorrect?: boolean; // For MCQ
  score?: number; // 0-100 for this turn
  feedback?: {
    rating: "Strong" | "Needs improvement" | "Could be clearer" | "Excellent" | "Incorrect";
    notes: string;
    tips: string[];
  };
  submittedAt: string;
}

export interface ProctoringViolationEvent {
  id: string;
  type: "tab_switch" | "fullscreen_exit" | "window_blur" | "no_face_detected";
  timestamp: string;
  warningNumber: number;
}

export interface InterviewSession {
  id: string;
  userId: string;
  mode: InterviewMode;
  role: string;
  targetCompany?: InterviewCompany;
  questions: InterviewQuestion[];
  responses: InterviewTurnResponse[];
  currentQuestionIndex: number;
  overallScore: number;
  proctoringViolations: ProctoringViolationEvent[];
  status: "in_progress" | "completed" | "terminated_proctoring";
  startedAt: string;
  completedAt?: string;
}

export interface InterviewSettings {
  defaultMcqTimeLimitSeconds: number;
  defaultVideoTimeLimitSeconds: number;
  maxProctoringWarnings: number;
  enableCameraDeviceCheck: boolean;
  enableAiTtsFallback: boolean;
}
