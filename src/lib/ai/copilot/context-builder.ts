import {
  CopilotContextCategory,
  CopilotContextInput,
  AcademicContextSlice,
  ProductivityContextSlice,
  CareerContextSlice,
} from "@/types/copilot";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { studentService } from "@/lib/services/studentService";
import { careerService } from "@/lib/services/careerService";
import {
  calculateSemesterSGPA,
  calculateCGPA,
  calculateAttendance,
} from "@/lib/academic/engine/calculations";
import { SemesterRecord, AttendanceRecord } from "@/lib/academic/types";

const MAX_ITEMS_PER_SLICE = 5;

/**
 * Builds a minimized context payload based on explicitly enabled categories.
 * Strict data minimization: never includes passwords, payment data, or irrelevant records.
 */
export async function buildCopilotContext(
  categories: CopilotContextCategory[],
  profileId: string = "guest",
  documentTextSnippet?: string,
  documentFilename?: string
): Promise<CopilotContextInput> {
  const activeSet = new Set(categories);
  const result: CopilotContextInput = {
    activeCategories: categories,
  };

  // 1. ACADEMIC CONTEXT SLICE
  if (activeSet.has("academic")) {
    const slice: AcademicContextSlice = {};

    try {
      const [profile, semesters, attendanceList] = await Promise.all([
        academicStorage.getProfile(profileId),
        academicStorage.getSemesterRecords(profileId),
        academicStorage.getAttendanceRecords(profileId),
      ]);

      slice.scheme = profile?.scheme || "2022 Scheme";

      // Compute latest SGPA deterministically
      if (semesters && semesters.length > 0) {
        const sortedSemesters = [...semesters].sort((a, b) => b.semester - a.semester);
        const latestSem = sortedSemesters[0];
        slice.semesterNumber = latestSem.semester;

        if (latestSem.courses && latestSem.courses.length > 0) {
          const sgpaCalc = calculateSemesterSGPA(latestSem.courses);
          slice.currentSgpa = sgpaCalc.sgpa;
        } else if (latestSem.sgpa !== undefined && latestSem.sgpa > 0) {
          slice.currentSgpa = latestSem.sgpa;
        }

        // Compute CGPA deterministically
        const validSemesters = semesters.filter(
          (s: SemesterRecord) => s.sgpa !== undefined && s.sgpa > 0
        );

        if (validSemesters.length > 0) {
          const cgpaCalc = calculateCGPA(validSemesters);
          slice.cgpa = cgpaCalc.cgpa;
        }
      }

      // Summarize Attendance deterministically
      if (attendanceList && attendanceList.length > 0) {
        slice.attendanceSummary = attendanceList.slice(0, MAX_ITEMS_PER_SLICE).map((att: AttendanceRecord) => {
          const calc = calculateAttendance(att.totalClasses, att.attendedClasses, 75);

          return {
            subject: att.subjectName || att.courseCode || "Course",
            attended: att.attendedClasses,
            total: att.totalClasses,
            percentage: calc.currentPercentage,
            needsRecovery: !calc.isSafe,
            classesNeededFor75: calc.classesNeededForTarget || 0,
          };
        });
      }

      // Upcoming Exams
      const exams = await studentService.getExams(profileId);
      if (exams && exams.length > 0) {
        slice.upcomingExams = exams.slice(0, MAX_ITEMS_PER_SLICE).map((ex) => ({
          subject: ex.subject,
          date: ex.date,
          type: ex.examType,
        }));
      }

      result.academic = slice;
    } catch {
      // Fallback cleanly
    }
  }

  // 2. PRODUCTIVITY CONTEXT SLICE
  if (activeSet.has("productivity")) {
    const slice: ProductivityContextSlice = {};

    try {
      const [tasks, timetable, sessions, assignments] = await Promise.all([
        studentService.getTasks(profileId),
        studentService.getTimetable(profileId),
        studentService.getStudySessions(profileId),
        studentService.getAssignments(profileId),
      ]);

      // Today's classes
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayDay = days[new Date().getDay()];
      slice.todayClasses = timetable
        .filter((t) => t.day === todayDay)
        .slice(0, MAX_ITEMS_PER_SLICE)
        .map((t) => ({
          subject: t.subject,
          startTime: t.startTime,
          endTime: t.endTime,
          room: t.room,
        }));

      // Pending tasks
      slice.pendingTasks = tasks
        .filter((t) => t.status !== "COMPLETED")
        .slice(0, MAX_ITEMS_PER_SLICE)
        .map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate,
        }));

      // Upcoming Deadlines (Assignments)
      slice.upcomingDeadlines = assignments
        .filter((a) => a.status !== "completed")
        .slice(0, MAX_ITEMS_PER_SLICE)
        .map((a) => ({
          title: a.title,
          dueDate: a.dueDate,
          type: "assignment",
        }));

      // Today's study sessions
      const todayStr = new Date().toISOString().split("T")[0];
      slice.todayStudySessions = sessions
        .filter((s) => s.date === todayStr)
        .slice(0, MAX_ITEMS_PER_SLICE)
        .map((s) => ({
          subject: s.subject,
          startTime: s.startTime,
          durationMinutes: s.durationMinutes,
        }));

      result.productivity = slice;
    } catch {
      // Fallback cleanly
    }
  }

  // 3. CAREER CONTEXT SLICE
  if (activeSet.has("career")) {
    const slice: CareerContextSlice = {};

    try {
      const [profile, resumes, apps, interviews] = await Promise.all([
        careerService.getOrCreateProfile(profileId),
        academicStorage.getAllResumeVersions(),
        academicStorage.getAllJobApplications(),
        academicStorage.getAllInterviews(),
      ]);

      const targetRole = profile?.professionalTitle || "Software Engineer";
      slice.targetRole = targetRole;

      if (resumes && resumes.length > 0) {
        slice.activeResumeName = resumes[0].name;
      }

      // Deterministic skill matching using Set operations
      const userSkillNames = (profile?.skills || []).map((s) => s.name);
      const skillGap = careerService.analyzeSkillGap(targetRole, userSkillNames);
      slice.matchedSkills = skillGap.matchedSkills.slice(0, MAX_ITEMS_PER_SLICE);
      slice.missingSkills = skillGap.missingSkills.slice(0, MAX_ITEMS_PER_SLICE);

      // Pending follow-ups
      slice.pendingFollowUps = apps
        .filter((a) => a.status === "APPLIED")
        .slice(0, MAX_ITEMS_PER_SLICE)
        .map((a) => ({
          company: a.company,
          role: a.role,
          appliedDate: a.applicationDate,
        }));

      // Upcoming interviews
      slice.upcomingInterviews = interviews
        .filter((i) => i.status === "SCHEDULED")
        .slice(0, MAX_ITEMS_PER_SLICE)
        .map((i) => ({
          company: i.company,
          round: i.round,
          date: i.date,
        }));

      result.career = slice;
    } catch {
      // Fallback cleanly
    }
  }

  // 4. DOCUMENT CONTEXT SLICE
  if (activeSet.has("documents") && documentTextSnippet) {
    result.document = {
      filename: documentFilename || "selected-document.txt",
      charCount: documentTextSnippet.length,
      textSnippet: documentTextSnippet.slice(0, 2000),
    };
  }

  return result;
}
