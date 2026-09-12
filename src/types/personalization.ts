import {
  AttendanceRecord,
  StudentAcademicProfile,
} from "@/lib/academic/types";
import {
  ExamRecord,
  Assignment,
  TaskItem,
  TimetableEntry,
  StudySession,
  HackathonRecord,
} from "@/types/student";
import {
  JobApplication,
  InterviewRecord,
  ResumeVersion,
  CareerProfile,
} from "@/types/career";

export type RecommendationCategory =
  | "academic"
  | "productivity"
  | "career"
  | "cross-domain";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export interface StudentRecommendation {
  id: string; // Stable deduplication key: e.g. "academic:att:MAT301", "career:intv:google"
  category: RecommendationCategory;
  priority: RecommendationPriority;
  score: number; // Transparent calculated priority score (0-100)
  title: string;
  description?: string;
  reason: string;
  actionLabel: string;
  actionRoute: string;
  sourceEntityId?: string;
  timestamp: string;
  dismissed?: boolean;
  ruleType?: string;
}

export interface SmartDailyClassItem {
  id: string;
  subject: string;
  time: string;
  room?: string;
  teacher?: string;
}

export interface SmartDailyStudyItem {
  id: string;
  subject: string;
  topic: string;
  time: string;
  durationMinutes: number;
}

export interface SmartDailyTaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
}

export interface SmartDailyDeadlineItem {
  id: string;
  title: string;
  category: string;
  countdownText: string;
  route: string;
}

export interface SmartDailyPlan {
  date: string;
  todayClasses: SmartDailyClassItem[];
  todayStudySessions: SmartDailyStudyItem[];
  todayTasks: SmartDailyTaskItem[];
  todayDeadlines: SmartDailyDeadlineItem[];
  totalCommitmentHours: number;
  summaryText: string;
}

export interface PersonalizationContextInput {
  profile?: StudentAcademicProfile | null;
  attendanceRecords?: AttendanceRecord[];
  exams?: ExamRecord[];
  assignments?: Assignment[];
  tasks?: TaskItem[];
  timetableEntries?: TimetableEntry[];
  studySessions?: StudySession[];
  hackathons?: HackathonRecord[];
  careerProfile?: CareerProfile | null;
  jobApplications?: JobApplication[];
  interviews?: InterviewRecord[];
  resumeVersions?: ResumeVersion[];
}
