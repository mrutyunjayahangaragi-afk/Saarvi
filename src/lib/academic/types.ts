/**
 * DocEase Phase 17 — Academic Intelligence Type Definitions
 *
 * Defines the core interfaces for extensible universities, grading systems,
 * pure calculations, local-first IndexedDB persistence, and student records.
 */

export interface GradingBand {
  min: number; // inclusive lower percentage (e.g. 90)
  max: number; // inclusive upper percentage (e.g. 100)
  grade: string; // e.g. "O", "A+"
  gradePoint: number; // e.g. 10, 9
  description: string; // e.g. "Outstanding"
}

export interface PassingRules {
  minCIE?: number; // e.g. 20 for VTU (out of 50)
  minSEE?: number; // e.g. 18 for VTU (out of 50)
  minAggregate?: number; // e.g. 40 for VTU (out of 100)
}

export interface EvaluationComponent {
  id: string; // "cie" | "see"
  name: string;
  maxMarks: number;
  minPassMarks?: number;
  weight?: number;
}

export interface CourseAssessmentPattern {
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
  allowedInputModes: ("cie-see" | "total")[];
  passingRules?: PassingRules;
  components?: EvaluationComponent[];
}

export interface AcademicCourseDefinition {
  university: string;
  scheme: string;
  branch: string;
  semester: number;
  courseCode: string;
  courseTitle: string;
  credits: number;
  assessment: CourseAssessmentPattern;
  includedInSGPA: boolean;
  includedInCGPA: boolean;
  category?: string;
  isElectiveGroup?: boolean;
  electiveGroupTitle?: string;
  electiveOptions?: Array<{
    courseCode: string;
    courseTitle: string;
    credits: number;
    category?: string;
  }>;
  sourceUrl?: string;
  sourceTitle?: string;
  verificationStatus?: "VERIFIED" | "DRAFT" | "DEPRECATED";
}

export interface BranchConfig {
  id: string;
  name: string;
  code: string;
  availableSemesters: number[];
}

export interface SchemeConfig {
  id: string;
  name: string;
  year: string;
  branches: BranchConfig[];
  defaultCreditsPerSemester?: Record<number, number>;
}

export interface CalculationRules {
  roundingDecimals: number; // usually 2
  fGradeTreatment: "retain_credits" | "exclude_credits"; // VTU retains in denominator
  percentageFormula?: (cgpa: number) => number; // e.g. (cgpa - 0.75) * 10
  percentageFormulaDescription?: string;
}

export interface UniversityAcademicConfig {
  id: string; // "VTU"
  name: string; // "Visvesvaraya Technological University"
  shortName: string; // "VTU"
  country: string; // "India"
  location: string; // "Belagavi, Karnataka"
  primarySourceUrl?: string;
  regulationsTitle?: string;
  schemes: SchemeConfig[];
  gradingBands: GradingBand[];
  calculationRules: CalculationRules;
}

// ==========================================
// CALCULATION RESULTS & INPUTS
// ==========================================

export interface DerivedGrade {
  grade: string;
  gradePoint: number;
  isPassed: boolean;
  percentage: number;
  description: string;
  remark?: string;
}

export interface CourseScoreInput {
  courseCode: string;
  courseTitle: string;
  credits: number;
  cieMarks?: number | "";
  seeMarks?: number | "";
  totalMarks?: number | "";
  inputMode: "cie-see" | "total";
  assessment: CourseAssessmentPattern;
  includedInSGPA: boolean;
  includedInCGPA: boolean;
}

export interface EvaluatedCourseResult {
  courseCode: string;
  courseTitle: string;
  credits: number;
  assessmentMarks: {
    cie?: number;
    see?: number;
    total?: number;
  };
  inputMode: "cie-see" | "total";
  totalMarks: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  creditPoints: number; // credits * gradePoint
  isPassed: boolean;
  includedInSGPA: boolean;
  includedInCGPA: boolean;
  remark?: string;
}

export interface SemesterSGPAResult {
  sgpa: number;
  totalCredits: number;
  earnedCredits: number;
  totalCreditPoints: number;
  subjectCount: number;
  hasBacklogs: boolean;
  failedCourses: string[];
  isComplete: boolean;
  completedCoursesCount: number;
  totalRequiredCoursesCount: number;
  calculationSteps: string[];
  explanation: string;
  courses: EvaluatedCourseResult[];
}

export interface CumulativeCGPAResult {
  cgpa: number;
  totalCredits: number;
  earnedCredits: number;
  totalCreditPoints: number;
  percentageEquivalent: number;
  completedSemestersCount: number;
  hasBacklogs: boolean;
  backlogCourseCodes: string[];
  calculationSteps: string[];
  explanation: string;
}

export interface AttendanceCalculationResult {
  currentPercentage: number;
  isSafe: boolean;
  message: string;
  classesNeededForTarget?: number;
  maxBunkableClasses?: number;
  explanation: string;
  error?: string;
}

export interface RequiredMarksResult {
  currentMarks: number;
  currentMax: number;
  targetPercentage: number;
  remainingMax: number;
  requiredMarks: number;
  isAchievable: boolean;
  isAlreadyAchieved: boolean;
  explanation: string;
}

export interface AcademicGoalResult {
  currentCgpa: number;
  targetCgpa: number;
  completedCredits: number;
  remainingCredits: number;
  requiredAverageSgpa: number;
  isAchievable: boolean;
  explanation: string;
}

// ==========================================
// LOCAL PERSISTENCE ENTITIES (INDEXEDDB)
// ==========================================

export interface StudentAcademicProfile {
  id: string;
  displayName: string;
  university: string;
  scheme: string;
  branch: string;
  currentSemester: number;
  createdAt: string;
  updatedAt: string;
}

export interface SemesterRecord {
  id: string; // `${profileId}_sem_${semester}`
  profileId: string;
  university: string;
  scheme: string;
  branch: string;
  semester: number;
  curriculumVersion: string;
  gradingVersion: string;
  sgpa: number;
  totalCredits: number;
  earnedCredits: number;
  totalCreditPoints: number;
  hasBacklogs: boolean;
  status: "not_entered" | "partially_entered" | "completed";
  courses: EvaluatedCourseResult[];
  calculationSteps?: string[];
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  profileId: string;
  subjectName: string;
  courseCode?: string;
  totalClasses: number;
  attendedClasses: number;
  targetPercentage: number;
  currentPercentage: number;
  isSafe: boolean;
  updatedAt: string;
}

export interface AcademicGoalRecord {
  id: string;
  profileId: string;
  targetCgpa: number;
  targetSemester: number;
  notes?: string;
  updatedAt: string;
}

export interface CalculationHistoryEntry {
  id: string;
  profileId?: string;
  type: "SGPA" | "CGPA" | "ATTENDANCE" | "REQUIRED_MARKS" | "GOAL";
  title: string;
  summary: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface AcademicExportPayload {
  version: "1.0";
  exportedAt: string;
  application: "Saarvi" | "DocEase";
  profile?: StudentAcademicProfile;
  semesters: SemesterRecord[];
  attendance: AttendanceRecord[];
  goals: AcademicGoalRecord[];
  history: CalculationHistoryEntry[];
}
