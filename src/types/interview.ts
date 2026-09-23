export type InterviewMode = "text_mcq" | "typed_answer" | "live_video";

export type InterviewQuestionType =
  | "mcq"
  | "behavioral"
  | "technical_coding"
  | "system_design"
  | "coding"
  | "dsa"
  | "hr"
  | "project"
  | "resume_based"
  | "communication";

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

export type InterviewSessionState =
  | "REGISTERED"
  | "ELIGIBILITY_CHECK"
  | "PERMISSION_CHECK"
  | "READY"
  | "ACTIVE"
  | "PAUSED"
  | "WARNING"
  | "COMPLETED"
  | "ABANDONED"
  | "TERMINATED";

export type CandidatePrivacyMode =
  | "FULL_VIDEO"
  | "BLURRED_CANDIDATE_VIDEO"
  | "NO_CANDIDATE_VIDEO";

export type InterviewerRole =
  | "candidate"
  | "admin_interviewer"
  | "superadmin_interviewer"
  | "ai";

export type QuestionSourceType =
  | "Saarvi practice question"
  | "Community-reported question"
  | "Reported interview question"
  | "Source-derived practice question"
  | "Licensed external";

export interface QuestionSourceInfo {
  sourceName: string;
  sourceUrl?: string;
  sourceDate?: string;
  sourceType: QuestionSourceType;
  companyName?: string;
  role?: string;
  topic?: string;
  difficulty?: InterviewDifficulty;
}

export interface InterviewQuestion {
  id: string;
  role: string;
  type: InterviewQuestionType;
  difficulty: InterviewDifficulty;
  company: InterviewCompany;
  topic?: string;
  subtopic?: string;
  category?: string;
  question: string;
  options?: string[]; // For MCQ (indices 0, 1, 2, 3)
  correctAnswer?: number; // 0-indexed for MCQ (stored server-side or revealed post-answer)
  explanation?: string;
  rubric?: {
    criteria: string[];
    sampleStrongAnswer: string;
  };
  expectedTimeSeconds?: number;
  timeLimitSeconds: number; // authoritative countdown (e.g. 30s or 60s for MCQ)
  exposureCount: number;
  sourceName?: string;
  sourceUrl?: string;
  sourceDate?: string;
  sourceType?: QuestionSourceType;
  isAdminCreated?: boolean;
  isActive?: boolean;
  isFree?: boolean;
  isPro?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EvaluationBreakdown {
  technical: number; // 0-100
  communication: number; // 0-100
  problemSolving: number; // 0-100
  clarity: number; // 0-100
  relevance: number; // 0-100
  timeManagement: number; // 0-100
}

export interface InterviewTurnResponse {
  questionId: string;
  userAnswer: string | number; // text or selected index
  timeSpentSeconds: number;
  durationMs?: number;
  isCorrect?: boolean; // For MCQ
  score?: number; // 0-100 for this turn
  breakdown?: Partial<EvaluationBreakdown>;
  isAiEvaluated?: boolean; // Label: AI-assisted evaluation
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
  pageVisibilityState?: string;
}

export type PermissionCheckStatus = "requested" | "granted" | "denied" | "unavailable";

export interface InterviewPermissionState {
  camera: PermissionCheckStatus;
  microphone: PermissionCheckStatus;
  location: PermissionCheckStatus;
  screen: PermissionCheckStatus;
  consent: "accepted" | "rejected" | "pending";
  browserSupported: boolean;
}

export interface InterviewCenter {
  id: string;
  centerName: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface InterviewLocationCapture {
  id: string;
  sessionId: string;
  centerId?: string;
  consentStatus: "granted" | "denied";
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timezone: string;
  capturedAt: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  candidateEmail?: string;
  planTier?: "FREE" | "PRO";
  mode: InterviewMode;
  role: string;
  targetCompany?: InterviewCompany;
  sessionState: InterviewSessionState;
  privacyMode: CandidatePrivacyMode;
  interviewerRole: InterviewerRole;
  interviewerId?: string;
  centerId?: string;
  questions: InterviewQuestion[];
  responses: InterviewTurnResponse[];
  currentQuestionIndex: number;
  overallScore: number;
  proctoringViolations: ProctoringViolationEvent[];
  warningCount: number;
  maxWarnings: number;
  status: "in_progress" | "completed" | "terminated_proctoring" | "abandoned";
  startedAt: string;
  completedAt?: string;
}

export interface InterviewSettings {
  interviewEnabled: boolean;
  registrationRequired: boolean;
  emailVerificationRequired: boolean;
  freeAccessAllowed: boolean;
  proAccessAllowed: boolean;
  questionCount: number;
  defaultMcqTimeLimitSeconds: number;
  defaultVideoTimeLimitSeconds: number;
  maxProctoringWarnings: number;
  humanInterviewerEnabled: boolean;
  aiFallbackEnabled: boolean;
  enableCameraDeviceCheck: boolean;
  enableMicDeviceCheck: boolean;
  enableLocationCheck: boolean;
  enableScreenShareCheck: boolean;
  allowedPrivacyModes: CandidatePrivacyMode[];
  enableAiTtsFallback: boolean;
  audioOnlyAllowed?: boolean;
  textOnlyAllowed?: boolean;
}

export type InterviewEventType =
  | "INTERVIEW_REGISTERED"
  | "PERMISSION_REQUESTED"
  | "PERMISSION_GRANTED"
  | "PERMISSION_DENIED"
  | "READY"
  | "STARTED"
  | "QUESTION_SHOWN"
  | "ANSWER_SUBMITTED"
  | "QUESTION_SKIPPED"
  | "QUESTION_TIMEOUT"
  | "TAB_SWITCH_WARNING"
  | "PAUSED"
  | "RESUMED"
  | "COMPLETED"
  | "TERMINATED"
  | "ABANDONED"
  | "AI_FALLBACK_USED"
  | "HUMAN_INTERVIEWER_JOINED";

export interface InterviewEventLog {
  id: string;
  sessionId: string;
  userId: string;
  eventType: InterviewEventType;
  warningNumber?: number;
  pageVisibilityState?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
