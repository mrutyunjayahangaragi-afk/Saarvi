/**
 * DocEase Intelligent Personalization Engine (Deterministic).
 *
 * Rules-driven, zero AI, zero heuristic guessing.
 * Computes explainable, high-value recommendations across Academic, Productivity,
 * and Career domains based on local user data in IndexedDB.
 *
 * Complexity:
 * - Generation: O(A + T + E + C + J) where inputs are user's local items.
 * - Deduplication: O(R) where R is total candidate recommendations using Map.
 * - Sorting: O(R log R) where R is typically < 20.
 */

import {
  StudentRecommendation,
  RecommendationCategory,
  RecommendationPriority,
  SmartDailyPlan,
  SmartDailyClassItem,
  SmartDailyStudyItem,
  SmartDailyTaskItem,
  SmartDailyDeadlineItem,
  PersonalizationContextInput,
} from "@/types/personalization";
import { AttendanceRecord } from "@/lib/academic/types";
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
} from "@/types/career";

const LOCAL_STORAGE_DISMISSED_KEY = "saarvi_dismissed_recommendations";
const LEGACY_LOCAL_STORAGE_DISMISSED_KEY = "docease_dismissed_recommendations";

export function getDismissedRecommendationKeys(): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) {
    return new Set<string>();
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_DISMISSED_KEY) ?? window.localStorage.getItem(LEGACY_LOCAL_STORAGE_DISMISSED_KEY);
    if (!raw) return new Set<string>();
    const list = JSON.parse(raw);
    return new Set<string>(Array.isArray(list) ? list : []);
  } catch {
    return new Set<string>();
  }
}

export function dismissRecommendationKey(dedupeKey: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const current = getDismissedRecommendationKeys();
    current.add(dedupeKey);
    window.localStorage.setItem(
      LOCAL_STORAGE_DISMISSED_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {}
}

export function clearDismissedRecommendations(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_DISMISSED_KEY);
    window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_DISMISSED_KEY);
  } catch {}
}

export function calculatePriorityScore(
  priority: RecommendationPriority,
  urgencyBoost: number = 0,
  severityBoost: number = 0
): number {
  const baseMap: Record<RecommendationPriority, number> = {
    critical: 95,
    high: 80,
    medium: 50,
    low: 20,
  };
  const raw = (baseMap[priority] || 50) + urgencyBoost + severityBoost;
  return Math.min(100, Math.max(0, raw));
}

export class RecommendationEngine {
  public generateRecommendations(
    context: PersonalizationContextInput,
    options: { includeDismissed?: boolean; limit?: number } = {}
  ): StudentRecommendation[] {
    const candidateList: StudentRecommendation[] = [];
    const dismissedKeys = options.includeDismissed
      ? new Set<string>()
      : getDismissedRecommendationKeys();

    this.evaluateAcademicRules(context, candidateList);
    this.evaluateProductivityRules(context, candidateList);
    this.evaluateCareerRules(context, candidateList);
    this.evaluateCrossDomainRules(context, candidateList);

    const activeCandidates = candidateList.filter((rec) => !dismissedKeys.has(rec.id));

    // Deduplicate by id (which acts as dedupeKey) keeping highest score
    const dedupeMap = new Map<string, StudentRecommendation>();
    for (const rec of activeCandidates) {
      const existing = dedupeMap.get(rec.id);
      if (!existing || rec.score > existing.score) {
        dedupeMap.set(rec.id, rec);
      }
    }

    const uniqueRecs = Array.from(dedupeMap.values());

    uniqueRecs.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.title.localeCompare(b.title);
    });

    const limit = options.limit ?? 5;
    return limit > 0 ? uniqueRecs.slice(0, limit) : uniqueRecs;
  }

  // ==========================================
  // ACADEMIC RULE GENERATORS
  // ==========================================
  private evaluateAcademicRules(
    context: PersonalizationContextInput,
    out: StudentRecommendation[]
  ): void {
    const now = new Date();
    const nowMs = now.getTime();
    const ts = now.toISOString();

    if (context.attendanceRecords) {
      for (const att of context.attendanceRecords) {
        if (att.totalClasses > 0) {
          const pct = Math.round((att.attendedClasses / att.totalClasses) * 100);
          if (pct < 75) {
            const neededTo75 = Math.max(
              0,
              Math.ceil((0.75 * att.totalClasses - att.attendedClasses) / 0.25)
            );
            out.push({
              id: `academic:att:${att.id}`,
              category: "academic",
              priority: "critical",
              score: calculatePriorityScore("critical", 5, 0),
              title: `Critical Attendance: ${att.subjectName} (${pct}%)`,
              description: `Your attendance is below the mandatory VTU 75% threshold. You must attend the next ${neededTo75} consecutive class${neededTo75 === 1 ? "" : "es"} to become eligible for exams.`,
              reason: `Current attendance is ${pct}%, strictly below the university requirement of 75%.`,
              actionRoute: "/student/attendance",
              actionLabel: "View Attendance",
              sourceEntityId: att.id,
              timestamp: ts,
              ruleType: "LOW_ATTENDANCE_CRITICAL",
            });
          } else if (pct < 85) {
            out.push({
              id: `academic:att:${att.id}`,
              category: "academic",
              priority: "medium",
              score: calculatePriorityScore("medium", 5, 5),
              title: `Attendance Warning: ${att.subjectName} (${pct}%)`,
              description: `Attendance is nearing the danger zone. Maintain regular attendance to avoid semester condonation penalties.`,
              reason: `Attendance is ${pct}%, between 75% and 85%.`,
              actionRoute: "/student/attendance",
              actionLabel: "Track Margin",
              sourceEntityId: att.id,
              timestamp: ts,
              ruleType: "LOW_ATTENDANCE_WARNING",
            });
          }
        }
      }
    }

    if (context.exams) {
      for (const exam of context.exams) {
        if (exam.date) {
          const examTime = new Date(exam.date).getTime();
          const diffDays = Math.ceil((examTime - nowMs) / (1000 * 60 * 60 * 24));

          if (diffDays >= 0 && diffDays <= 7) {
            const isUrgent = diffDays <= 2;
            const priority: RecommendationPriority = isUrgent ? "high" : "medium";
            out.push({
              id: `academic:exam:${exam.id}`,
              category: "academic",
              priority,
              score: calculatePriorityScore(priority, isUrgent ? 15 : 5, 5),
              title: isUrgent
                ? `Urgent: ${exam.subject} Exam in ${diffDays === 0 ? "Today" : `${diffDays} day(s)`}`
                : `Upcoming Exam: ${exam.subject} (${diffDays} days)`,
              description: `Scheduled on ${exam.date}. Ensure your syllabus revision and formula sheets are complete.`,
              reason: `Exam date is ${diffDays} day(s) away.`,
              actionRoute: "/student/exams",
              actionLabel: "Review Exam Plan",
              sourceEntityId: exam.id,
              timestamp: ts,
              ruleType: "UPCOMING_EXAM",
            });
          }
        }
      }
    }
  }

  // ==========================================
  // PRODUCTIVITY RULE GENERATORS
  // ==========================================
  private evaluateProductivityRules(
    context: PersonalizationContextInput,
    out: StudentRecommendation[]
  ): void {
    const now = new Date();
    const nowMs = now.getTime();
    const ts = now.toISOString();

    if (context.assignments) {
      const overdueAssignments = context.assignments.filter((a: Assignment) => {
        if (a.status === "submitted" || a.status === "completed") return false;
        if (!a.dueDate) return false;
        return new Date(a.dueDate).getTime() < nowMs;
      });

      if (overdueAssignments.length > 0) {
        out.push({
          id: `productivity:asgn:overdue`,
          category: "productivity",
          priority: "high",
          score: calculatePriorityScore("high", 15, 5),
          title: `${overdueAssignments.length} Overdue Assignment${overdueAssignments.length === 1 ? "" : "s"}`,
          description: `You have overdue coursework that needs immediate submission to avoid internal marks deduction.`,
          reason: `${overdueAssignments.length} assignment(s) are past their due dates.`,
          actionRoute: "/student/assignments",
          actionLabel: "View Assignments",
          timestamp: ts,
          ruleType: "OVERDUE_ASSIGNMENTS",
        });
      }
    }

    const upcoming48hItems: string[] = [];
    if (context.assignments) {
      for (const a of context.assignments) {
        if (a.status !== "submitted" && a.status !== "completed" && a.dueDate) {
          const diffHours = (new Date(a.dueDate).getTime() - nowMs) / (1000 * 60 * 60);
          if (diffHours >= 0 && diffHours <= 48) {
            upcoming48hItems.push(`Assignment: ${a.title}`);
          }
        }
      }
    }
    if (context.exams) {
      for (const e of context.exams) {
        if (e.date) {
          const diffHours = (new Date(e.date).getTime() - nowMs) / (1000 * 60 * 60);
          if (diffHours >= 0 && diffHours <= 48) {
            upcoming48hItems.push(`Exam: ${e.subject}`);
          }
        }
      }
    }

    if (upcoming48hItems.length >= 2) {
      out.push({
        id: "productivity:general:clustered_deadlines",
        category: "productivity",
        priority: "high",
        score: calculatePriorityScore("high", 15, 0),
        title: `High Workload: ${upcoming48hItems.length} Deadlines in 48 Hours`,
        description: `You have multiple concurrent deadlines approaching: ${upcoming48hItems.slice(0, 3).join(", ")}. Prioritize by submission weightage.`,
        reason: `${upcoming48hItems.length} deadlines coincide within the next 48 hours.`,
        actionRoute: "/student/calendar",
        actionLabel: "View Schedule",
        timestamp: ts,
        ruleType: "CLUSTERED_DEADLINES",
      });
    }

    if (context.timetableEntries && context.timetableEntries.length >= 2) {
      const days: TimetableEntry["day"][] = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const currentDay = days[now.getDay()];
      const todayClasses = context.timetableEntries
        .filter((t: TimetableEntry) => t.day.toLowerCase() === currentDay.toLowerCase())
        .sort((a: TimetableEntry, b: TimetableEntry) => (a.startTime || "").localeCompare(b.startTime || ""));

      for (let i = 0; i < todayClasses.length - 1; i++) {
        const currentEnd = todayClasses[i].endTime;
        const nextStart = todayClasses[i + 1].startTime;
        if (currentEnd && nextStart) {
          const [endH, endM] = currentEnd.split(":").map(Number);
          const [startH, startM] = nextStart.split(":").map(Number);
          const gapMinutes = (startH * 60 + startM) - (endH * 60 + endM);

          if (gapMinutes >= 60) {
            out.push({
              id: `productivity:gap:${i}`,
              category: "productivity",
              priority: "low",
              score: calculatePriorityScore("low", 5, 0),
              title: `${Math.floor(gapMinutes / 60)}h Study Window Today`,
              description: `You have a free period between ${currentEnd} and ${nextStart} today. Ideal for quick revision or coursework prep.`,
              reason: `Detected open window of ${gapMinutes} minutes in your timetable today.`,
              actionRoute: "/student/study-planner",
              actionLabel: "Schedule Session",
              timestamp: ts,
              ruleType: "TIMETABLE_GAP",
            });
            break;
          }
        }
      }
    }
  }

  // ==========================================
  // CAREER RULE GENERATORS
  // ==========================================
  private evaluateCareerRules(
    context: PersonalizationContextInput,
    out: StudentRecommendation[]
  ): void {
    const nowMs = Date.now();
    const ts = new Date().toISOString();

    if (context.interviews) {
      for (const intv of context.interviews) {
        if (intv.date) {
          const intvTime = new Date(intv.date).getTime();
          const diffDays = Math.ceil((intvTime - nowMs) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 3) {
            out.push({
              id: `career:intv:${intv.id}`,
              category: "career",
              priority: "high",
              score: calculatePriorityScore("high", 15, 10),
              title: `Interview in ${diffDays === 0 ? "Today" : `${diffDays} day(s)`}: ${intv.company}`,
              description: `Your ${intv.round || "technical"} interview with ${intv.company} is approaching. Review your resume projects and core fundamentals.`,
              reason: `Interview scheduled on ${intv.date} (${diffDays} days away).`,
              actionRoute: "/student/applications",
              actionLabel: "Prep Notes",
              sourceEntityId: intv.id,
              timestamp: ts,
              ruleType: "UPCOMING_INTERVIEW",
            });
          }
        }
      }
    }

    if (context.jobApplications) {
      for (const app of context.jobApplications) {
        if (app.status === "APPLIED" && app.applicationDate) {
          const appliedTime = new Date(app.applicationDate).getTime();
          const daysSince = Math.floor((nowMs - appliedTime) / (1000 * 60 * 60 * 24));
          if (daysSince >= 7 && daysSince <= 30) {
            out.push({
              id: `career:app:${app.id}`,
              category: "career",
              priority: "medium",
              score: calculatePriorityScore("medium", 5, 0),
              title: `Follow Up: ${app.company} (${app.role})`,
              description: `It has been ${daysSince} days since applying to ${app.company}. Consider sending a polite follow-up inquiry to the recruiter.`,
              reason: `Application submitted on ${app.applicationDate} (${daysSince} days ago without status change).`,
              actionRoute: "/student/applications",
              actionLabel: "Track Application",
              sourceEntityId: app.id,
              timestamp: ts,
              ruleType: "APPLICATION_FOLLOWUP",
            });
          }
        }
      }
    }

    const hasSummary =
      (context.resumeVersions &&
        context.resumeVersions.length > 0 &&
        Boolean(context.resumeVersions[0].summaryOverride?.trim())) ||
      Boolean(context.careerProfile?.summary?.trim());

    if (context.resumeVersions && context.resumeVersions.length > 0 && !hasSummary) {
      const primaryResume = context.resumeVersions[0];
      out.push({
        id: `career:res_summary:${primaryResume.id}`,
        category: "career",
        priority: "low",
        score: calculatePriorityScore("low", 0, 5),
        title: `Add Summary to Resume: ${primaryResume.name}`,
        description: `Your resume lacks a concise professional summary. Adding a 2-sentence career summary improves recruiter scan engagement.`,
        reason: `Summary field is empty or under 30 characters.`,
        actionRoute: "/student/resume",
        actionLabel: "Edit Resume",
        sourceEntityId: primaryResume.id,
        timestamp: ts,
        ruleType: "RESUME_SUMMARY_MISSING",
      });
    }
  }

  // ==========================================
  // CROSS-DOMAIN RULE GENERATORS
  // ==========================================
  private evaluateCrossDomainRules(
    context: PersonalizationContextInput,
    out: StudentRecommendation[]
  ): void {
    const nowMs = Date.now();
    const ts = new Date().toISOString();

    if (context.attendanceRecords && context.exams) {
      for (const exam of context.exams) {
        if (!exam.date) continue;
        const examTime = new Date(exam.date).getTime();
        const diffDays = Math.ceil((examTime - nowMs) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 14) {
          const normExamSubject = exam.subject.trim().toLowerCase();
          const matchAtt = context.attendanceRecords.find((a: AttendanceRecord) => {
            const normAttSubject = a.subjectName.trim().toLowerCase();
            return (
              normAttSubject === normExamSubject ||
              normAttSubject.includes(normExamSubject) ||
              normExamSubject.includes(normAttSubject)
            );
          });

          if (matchAtt && matchAtt.totalClasses > 0) {
            const pct = Math.round((matchAtt.attendedClasses / matchAtt.totalClasses) * 100);
            if (pct < 75) {
              out.push({
                id: `cross_domain:exam_att:${exam.id}`,
                category: "cross-domain",
                priority: "critical",
                score: 98,
                title: `Eligibility Alert: ${exam.subject}`,
                description: `You have an upcoming exam on ${exam.date}, but your attendance is only ${pct}%. Attend remaining classes to secure hall ticket eligibility.`,
                reason: `Compound risk: Exam in ${diffDays} days coupled with sub-75% attendance (${pct}%).`,
                actionRoute: "/student/attendance",
                actionLabel: "Fix Attendance",
                sourceEntityId: exam.id,
                timestamp: ts,
                ruleType: "EXAM_LOW_ATTENDANCE_RISK",
              });
            }
          }
        }
      }
    }

    if (context.hackathons && context.resumeVersions && context.resumeVersions.length > 0) {
      const activeResume = context.resumeVersions[0];
      const resumeText = JSON.stringify(activeResume).toLowerCase();

      for (const hack of context.hackathons) {
        if (hack.name && !resumeText.includes(hack.name.toLowerCase().trim())) {
          out.push({
            id: `cross_domain:hack_resume:${hack.id}`,
            category: "cross-domain",
            priority: "medium",
            score: calculatePriorityScore("medium", 5, 0),
            title: `Add ${hack.name} to Resume`,
            description: `You participated in "${hack.name}". Add this hackathon under your resume projects or achievements to strengthen your profile.`,
            reason: `Hackathon entry exists in your workspace but is not referenced in resume "${activeResume.name}".`,
            actionRoute: "/student/resume",
            actionLabel: "Update Resume",
            sourceEntityId: hack.id,
            timestamp: ts,
            ruleType: "ADD_HACKATHON_TO_RESUME",
          });
          break;
        }
      }
    }
  }

  // ==========================================
  // SMART DAILY PLAN GENERATION
  // ==========================================
  public generateSmartDailyPlan(
    context: PersonalizationContextInput,
    targetDateStr?: string
  ): SmartDailyPlan {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const targetIsoDate = targetDate.toISOString().slice(0, 10);
    const days: TimetableEntry["day"][] = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const currentDayName = days[targetDate.getDay()];

    let totalCommitmentMinutes = 0;

    // 1. Classes Today
    const todayClasses: SmartDailyClassItem[] = [];
    if (context.timetableEntries) {
      const entries = context.timetableEntries.filter(
        (t: TimetableEntry) => t.day.toLowerCase() === currentDayName.toLowerCase()
      );
      entries.sort((a: TimetableEntry, b: TimetableEntry) => (a.startTime || "").localeCompare(b.startTime || ""));
      for (const entry of entries) {
        todayClasses.push({
          id: entry.id,
          subject: entry.subject,
          time: `${entry.startTime} - ${entry.endTime}`,
          room: entry.room,
          teacher: entry.teacher,
        });
        if (entry.startTime && entry.endTime) {
          const [sh, sm] = entry.startTime.split(":").map(Number);
          const [eh, em] = entry.endTime.split(":").map(Number);
          const dur = (eh * 60 + em) - (sh * 60 + sm);
          if (dur > 0) totalCommitmentMinutes += dur;
        }
      }
    }

    // 2. Study Sessions Today
    const todayStudySessions: SmartDailyStudyItem[] = [];
    if (context.studySessions) {
      const sessions = context.studySessions.filter((s: StudySession) => {
        if (!s.date) return false;
        return s.date.startsWith(targetIsoDate);
      });
      sessions.sort((a: StudySession, b: StudySession) => (a.startTime || "").localeCompare(b.startTime || ""));
      for (const s of sessions) {
        let dur = s.durationMinutes || 60;
        if (!dur && s.startTime && s.endTime) {
          const [sh, sm] = s.startTime.split(":").map(Number);
          const [eh, em] = s.endTime.split(":").map(Number);
          const diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff > 0) dur = diff;
        }
        todayStudySessions.push({
          id: s.id,
          subject: s.subject,
          topic: s.topic || "General Study",
          time: `${s.startTime} - ${s.endTime || ""}`,
          durationMinutes: dur,
        });
        totalCommitmentMinutes += dur;
      }
    }

    // 3. Tasks Due Today or Pending High Priority
    const todayTasks: SmartDailyTaskItem[] = [];
    if (context.tasks) {
      const relevantTasks = context.tasks.filter((t: TaskItem) => {
        if (t.status === "COMPLETED" || t.status === "CANCELLED") return false;
        if (t.dueDate && t.dueDate.startsWith(targetIsoDate)) return true;
        if (t.priority === "HIGH") return true;
        return false;
      });
      for (const t of relevantTasks) {
        todayTasks.push({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
        });
      }
    }

    // 4. Deadlines (Due today or within next 48h)
    const todayDeadlines: SmartDailyDeadlineItem[] = [];
    const targetTime = targetDate.getTime();

    if (context.assignments) {
      for (const a of context.assignments) {
        if (a.status !== "submitted" && a.status !== "completed" && a.dueDate) {
          const diffHours = (new Date(a.dueDate).getTime() - targetTime) / (1000 * 60 * 60);
          if (diffHours >= -24 && diffHours <= 48) {
            const countdownText =
              diffHours <= 0
                ? "Due today"
                : diffHours <= 24
                ? `Due in ${Math.round(diffHours)}h`
                : `Due in ${Math.ceil(diffHours / 24)} days`;

            todayDeadlines.push({
              id: a.id,
              title: a.title,
              category: "Assignment",
              countdownText,
              route: "/student/assignments",
            });
          }
        }
      }
    }

    if (context.exams) {
      for (const e of context.exams) {
        if (e.date) {
          const diffHours = (new Date(e.date).getTime() - targetTime) / (1000 * 60 * 60);
          if (diffHours >= -24 && diffHours <= 48) {
            const countdownText =
              diffHours <= 0
                ? "Today"
                : diffHours <= 24
                ? `In ${Math.round(diffHours)}h`
                : `In ${Math.ceil(diffHours / 24)} days`;

            todayDeadlines.push({
              id: e.id,
              title: `${e.subject} Exam`,
              category: "Exam",
              countdownText,
              route: "/student/exams",
            });
          }
        }
      }
    }

    const parts: string[] = [];
    if (todayClasses.length > 0) {
      parts.push(`${todayClasses.length} class${todayClasses.length === 1 ? "" : "es"}`);
    }
    if (todayStudySessions.length > 0) {
      parts.push(`${todayStudySessions.length} study session${todayStudySessions.length === 1 ? "" : "s"}`);
    }
    if (todayDeadlines.length > 0) {
      parts.push(`${todayDeadlines.length} deadline${todayDeadlines.length === 1 ? "" : "s"}`);
    }
    if (todayTasks.length > 0) {
      parts.push(`${todayTasks.length} pending task${todayTasks.length === 1 ? "" : "s"}`);
    }

    const summaryText =
      parts.length > 0
        ? `Today's schedule: ${parts.join(", ")}.`
        : "No scheduled events or deadlines for today. Take time to revise or relax!";

    return {
      date: targetIsoDate,
      todayClasses,
      todayStudySessions,
      todayTasks,
      todayDeadlines,
      totalCommitmentHours: Math.round((totalCommitmentMinutes / 60) * 10) / 10,
      summaryText,
    };
  }
}

export const recommendationEngine = new RecommendationEngine();
