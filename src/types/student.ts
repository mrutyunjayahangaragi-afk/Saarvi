export type PriorityLevel = "low" | "medium" | "high";

export type TaskStatus = "pending" | "in_progress" | "completed";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type TaskItemStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface TaskItem {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subjectId?: string;
  title: string;
  description?: string;
  category?: string;
  priority: TaskPriority;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  status: TaskItemStatus;
  createdAt: string;
  updatedAt: string;
}

export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "completed";

export type ExamType = "Internal" | "SEE" | "Lab" | "Practical" | "Quiz" | "Other";

export interface ExamRecord {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subject: string;
  subjectId?: string;
  examType: ExamType | string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM e.g. "09:30"
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type StudySessionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface StudySession {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subject: string;
  subjectId?: string;
  topic: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "19:00"
  endTime?: string; // e.g. "20:30"
  durationMinutes: number; // e.g. 90
  priority: PriorityLevel;
  notes?: string;
  status: StudySessionStatus;
  createdAt: string;
  updatedAt: string;
}

export type GoalCategory = "Academic" | "Coding" | "Projects" | "Career" | "Fitness" | "Personal";
export type GoalStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED";

export interface StudentGoal {
  id: string;
  userId?: string;
  profileId?: string;
  title: string;
  category: GoalCategory;
  targetDate: string; // YYYY-MM-DD
  progress: number; // 0 - 100
  status: GoalStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DeadlineCategory = "Assignment" | "Exam" | "Task" | "Goal" | "Internship" | "Hackathon" | "Other";
export type DeadlineUrgency = "overdue" | "today" | "tomorrow" | "this_week" | "later";

export interface UnifiedDeadline {
  id: string;
  sourceId: string;
  sourceType: DeadlineCategory;
  title: string;
  subtitle?: string;
  subjectId?: string;
  targetDate: string; // YYYY-MM-DD
  targetTime?: string; // HH:MM
  priority: "low" | "medium" | "high";
  urgency: DeadlineUrgency;
  countdownText: string;
  daysRemaining: number;
  isCompleted: boolean;
  route: string;
}

export type InternshipStatus =
  | "interested"
  | "applied"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type HackathonStatus =
  | "interested"
  | "saved"
  | "registered"
  | "in_progress"
  | "selected"
  | "finalist"
  | "winner"
  | "completed"
  | "did_not_participate"
  | "SAVED"
  | "REGISTERED"
  | "IN_PROGRESS"
  | "FINALIST"
  | "WINNER"
  | "COMPLETED"
  | "DID_NOT_PARTICIPATE";

export interface StudyTask {
  id: string;
  userId?: string;
  subject: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "19:00"
  durationMinutes: number; // e.g. 90
  priority: PriorityLevel;
  notes?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subjectId?: string;
  title: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  priority: PriorityLevel;
  description?: string;
  status: AssignmentStatus;
  estimatedHours?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableEntry {
  id: string;
  userId?: string;
  profileId?: string;
  semesterId?: string;
  subjectId?: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  subject: string;
  startTime: string; // e.g. "09:00"
  endTime: string; // e.g. "10:30"
  room?: string;
  teacher?: string;
  type?: string; // e.g. "Lecture", "Lab", "Tutorial"
  notes?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CertificateRecord {
  id: string;
  userId?: string;
  profileId?: string;
  name: string;
  issuer: string;
  issueDate: string; // YYYY-MM-DD
  category: "Academic" | "Course" | "Competition" | "Internship" | "Other";
  credentialId?: string;
  verificationUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternshipApplication {
  id: string;
  userId?: string;
  profileId?: string;
  company: string;
  role: string;
  location?: string;
  applicationDate: string; // YYYY-MM-DD
  deadline?: string; // YYYY-MM-DD
  status: InternshipStatus;
  link?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HackathonRecord {
  id: string;
  userId?: string;
  profileId?: string;
  name: string;
  organizer: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  registrationDeadline?: string; // YYYY-MM-DD
  teamName?: string;
  status: HackathonStatus;
  link?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterData {
  id?: string;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  date: string;
  recipientName: string;
  recipientTitle: string;
  companyName: string;
  companyAddress?: string;
  targetRole: string;
  opening: string;
  bodyParagraph1: string;
  bodyParagraph2?: string;
  skillsHighlight: string;
  closing: string;
  template: "classic" | "modern" | "minimal";
  createdAt?: string;
  updatedAt?: string;
}

// Academic Calculator Types
export interface GradeItem {
  letter: string;
  points: number;
}

export interface GradingScale {
  id: string;
  name: string;
  maxPoints: number;
  grades: GradeItem[];
}

export interface SubjectGrade {
  id: string;
  name: string;
  credits: number;
  grade: string;
}

export interface CGPAResult {
  cgpa: number;
  totalCredits: number;
  totalPoints: number;
  subjectCount: number;
  explanation: string;
}

export interface SGPAResult {
  sgpa: number;
  totalCredits: number;
  totalPoints: number;
  subjectCount: number;
  explanation: string;
}

export interface SubjectMarks {
  id: string;
  name: string;
  obtained: number;
  maximum: number;
}

export interface PercentageResult {
  percentage: number;
  totalObtained: number;
  totalMaximum: number;
  subjectCount: number;
  gradeEstimate?: string;
  explanation: string;
}

export interface AttendanceResult {
  currentPercentage: number;
  isSafe: boolean;
  message: string;
  classesNeededForTarget?: number;
  maxBunkableClasses?: number;
  explanation: string;
  error?: string;
}

export interface SubjectMarksBreakdown {
  id: string;
  name: string;
  internalObtained: number;
  internalMax: number;
  externalObtained: number;
  externalMax: number;
}

export interface MarksResult {
  overallPercentage: number;
  totalInternalScaled: number;
  totalExternalScaled: number;
  totalScore: number;
  maxPossibleScore: number;
  explanation: string;
}

// ==========================================
// PHASE 10: VTU & CURRICULUM INTELLIGENCE TYPES
// ==========================================

export type MarksInputMode = "cie-see" | "total";

export interface CourseAssessmentConfig {
  hasSEE: boolean;
  cie?: {
    maxMarks: number;
  };
  see?: {
    maxMarks: number;
  };
  total?: {
    maxMarks: number;
  };
  allowedInputModes: MarksInputMode[];
  passingRules?: {
    minCIE?: number;
    minSEE?: number;
    minAggregate?: number;
  };
  components?: AssessmentComponent[];
}

export interface NormalizedCourseScore {
  courseCode: string;
  marksObtained: number;
  maximumMarks: number;
  percentage: number;
}

export interface AssessmentComponent {
  id: string; // e.g. "cie", "see"
  name: string; // e.g. "Continuous Internal Evaluation (CIE)", "Semester End Exam (SEE)"
  maxMarks: number; // e.g. 50
  minPassMarks?: number; // e.g. 20 for CIE, 18 for SEE
  weight?: number; // e.g. 0.5
}

export interface ElectiveOption {
  courseCode: string;
  courseTitle: string;
  credits: number;
  category?: string;
}

export interface CurriculumCourse {
  university: string; // e.g. "VTU"
  scheme: string; // e.g. "2022"
  branch: string; // e.g. "CSE"
  semester: number; // 1 to 8
  courseCode: string; // e.g. "BCS301"
  courseTitle: string; // e.g. "Mathematics for Computer Science"
  credits: number; // e.g. 4
  assessment: CourseAssessmentConfig;
  includedInSGPA: boolean;
  includedInCGPA: boolean;
  category?: string; // "IPCC" | "PCC" | "ESC" | "ETC" | "PLC" | "SEC" | "AEC" | "MC"
  isElectiveGroup?: boolean;
  electiveGroupTitle?: string;
  electiveOptions?: ElectiveOption[];
  sourceUrl: string;
  sourceTitle: string;
  retrievedAt?: string;
  verifiedAt?: string;
  verificationStatus: "VERIFIED" | "DRAFT" | "DEPRECATED";
}

export interface CourseResultInput {
  courseCode: string;
  courseTitle: string;
  credits: number;
  assessmentMarks: Record<string, number>; // component id -> marks e.g. { cie: 42, see: 38 }
  inputMode?: MarksInputMode;
  totalMarks: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  creditPoints: number;
  isPassed: boolean;
  includedInSGPA: boolean;
  includedInCGPA: boolean;
  attempt?: number;
  remark?: string;
}

export interface SemesterResult {
  semester: number;
  semesterName?: string;
  courses: CourseResultInput[];
  sgpa: number;
  totalCredits: number;
  earnedCredits: number;
  totalCreditPoints: number;
  hasBacklogs: boolean;
  status: "not_entered" | "partially_entered" | "completed";
}

export interface AcademicCalculationSnapshot {
  id?: string;
  userId?: string;
  university: string;
  scheme: string;
  branch: string;
  curriculumVersion: string;
  gradingVersion: string;
  calculatedAt: string;
  semesters: SemesterResult[];
  cgpa: number;
  totalCredits: number;
  earnedCredits: number;
  totalCreditPoints: number;
  percentageEquivalent?: number;
  status: "active" | "archived";
  createdAt?: string;
  updatedAt?: string;
}

export interface VTUBranchOption {
  id: string;
  name: string;
  code: string;
  availableSemesters: number[];
}

export interface VTUSchemeOption {
  id: string;
  name: string;
  year: string;
  branches: VTUBranchOption[];
}

