export type CopilotIntentCategory =
  | "ACADEMIC_RESULT"
  | "ACADEMIC_EXPLANATION"
  | "STUDY_PLANNING"
  | "ATTENDANCE"
  | "EXAM"
  | "TASK"
  | "CAREER"
  | "RESUME"
  | "APPLICATION"
  | "INTERVIEW"
  | "DOCUMENT"
  | "GENERAL";

export type CopilotContextCategory =
  | "academic"
  | "productivity"
  | "career"
  | "documents"
  | "conversation";

export interface AcademicContextSlice {
  currentSgpa?: number;
  cgpa?: number;
  semesterNumber?: number;
  scheme?: string;
  attendanceSummary?: {
    subject: string;
    attended: number;
    total: number;
    percentage: number;
    needsRecovery?: boolean;
    classesNeededFor75?: number;
  }[];
  upcomingExams?: {
    subject: string;
    date: string;
    type?: string;
  }[];
}

export interface ProductivityContextSlice {
  todayClasses?: {
    subject: string;
    startTime: string;
    endTime: string;
    room?: string;
  }[];
  pendingTasks?: {
    id: string;
    title: string;
    priority: string;
    dueDate?: string;
  }[];
  upcomingDeadlines?: {
    title: string;
    dueDate: string;
    type: "assignment" | "exam" | "task";
  }[];
  todayStudySessions?: {
    subject: string;
    startTime: string;
    durationMinutes: number;
  }[];
}

export interface CareerContextSlice {
  targetRole?: string;
  matchedSkills?: string[];
  missingSkills?: string[];
  pendingFollowUps?: {
    company: string;
    role: string;
    appliedDate: string;
  }[];
  upcomingInterviews?: {
    company: string;
    round: string;
    date: string;
  }[];
  activeResumeName?: string;
}

export interface DocumentContextSlice {
  filename?: string;
  charCount?: number;
  textSnippet?: string;
}

export interface CopilotContextInput {
  activeCategories: CopilotContextCategory[];
  academic?: AcademicContextSlice;
  productivity?: ProductivityContextSlice;
  career?: CareerContextSlice;
  document?: DocumentContextSlice;
  recentMessages?: {
    role: "user" | "assistant";
    content: string;
  }[];
}

export type CopilotActionType =
  | "create_study_session"
  | "create_task"
  | "schedule_reminder"
  | "navigate_to_feature";

export interface CopilotAction {
  id: string;
  type: CopilotActionType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  status: "suggested" | "confirmed" | "cancelled" | "executed";
}

export interface CopilotResponse {
  message: string;
  intent: CopilotIntentCategory;
  isDeterministic: boolean;
  sourceNotice?: string;
  suggestedActions?: CopilotAction[];
  contextUsed: CopilotContextCategory[];
  citations?: string[];
}

export interface MockInterviewTurn {
  questionIndex: number;
  question: string;
  role: string;
  answer?: string;
  feedback?: {
    rating: "Strong" | "Needs improvement" | "Could be clearer";
    notes: string;
    tips: string[];
  };
}
