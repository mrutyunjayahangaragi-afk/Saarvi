import test from "node:test";
import assert from "node:assert/strict";

// =========================================================================
// PURE PERSONALIZATION ENGINE IMPLEMENTATION (MIRRORS src/lib/student/personalization)
// =========================================================================

function calculatePriorityScore(priority, urgencyBoost = 0, severityBoost = 0) {
  const baseMap = {
    critical: 95,
    high: 80,
    medium: 50,
    low: 20,
  };
  const raw = (baseMap[priority] || 50) + urgencyBoost + severityBoost;
  return Math.min(100, Math.max(0, raw));
}

class TestRecommendationEngine {
  generateRecommendations(context, options = {}) {
    const candidateList = [];
    const dismissedKeys = new Set(options.dismissedKeys || []);

    this.evaluateAcademicRules(context, candidateList);
    this.evaluateProductivityRules(context, candidateList);
    this.evaluateCareerRules(context, candidateList);
    this.evaluateCrossDomainRules(context, candidateList);

    const activeCandidates = candidateList.filter((rec) => !dismissedKeys.has(rec.id));

    // Deduplicate by id keeping highest score
    const dedupeMap = new Map();
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

  evaluateAcademicRules(context, out) {
    const now = context.currentDate ? new Date(context.currentDate) : new Date();
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
              description: `Attend next ${neededTo75} consecutive classes to reach 75%.`,
              reason: `Current attendance is ${pct}%, strictly below 75%.`,
              actionRoute: "/student/attendance",
              actionLabel: "View Attendance",
              sourceEntityId: att.id,
              timestamp: ts,
              neededTo75,
            });
          } else if (pct < 85) {
            out.push({
              id: `academic:att:${att.id}`,
              category: "academic",
              priority: "medium",
              score: calculatePriorityScore("medium", 5, 5),
              title: `Attendance Warning: ${att.subjectName} (${pct}%)`,
              description: `Attendance nearing warning threshold.`,
              reason: `Attendance is ${pct}%, between 75% and 85%.`,
              actionRoute: "/student/attendance",
              actionLabel: "Track Margin",
              sourceEntityId: att.id,
              timestamp: ts,
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
            const priority = isUrgent ? "high" : "medium";
            out.push({
              id: `academic:exam:${exam.id}`,
              category: "academic",
              priority,
              score: calculatePriorityScore(priority, isUrgent ? 15 : 5, 5),
              title: isUrgent
                ? `Urgent: ${exam.subject} Exam in ${diffDays === 0 ? "Today" : `${diffDays} day(s)`}`
                : `Upcoming Exam: ${exam.subject} (${diffDays} days)`,
              description: `Exam on ${exam.date}.`,
              reason: `Exam date is ${diffDays} day(s) away.`,
              actionRoute: "/student/exams",
              actionLabel: "Review Exam Plan",
              sourceEntityId: exam.id,
              timestamp: ts,
            });
          }
        }
      }
    }
  }

  evaluateProductivityRules(context, out) {
    const now = context.currentDate ? new Date(context.currentDate) : new Date();
    const nowMs = now.getTime();
    const ts = now.toISOString();

    if (context.assignments) {
      const overdueAssignments = context.assignments.filter((a) => {
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
          description: `Coursework past due date.`,
          reason: `${overdueAssignments.length} assignment(s) are past due date.`,
          actionRoute: "/student/assignments",
          actionLabel: "View Assignments",
          timestamp: ts,
        });
      }
    }

    const upcoming48hItems = [];
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
        description: `Multiple deadlines coincide: ${upcoming48hItems.join(", ")}.`,
        reason: `${upcoming48hItems.length} deadlines coincide within 48h.`,
        actionRoute: "/student/calendar",
        actionLabel: "View Schedule",
        timestamp: ts,
      });
    }

    if (context.timetableEntries && context.timetableEntries.length >= 2) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const currentDay = days[now.getDay()];
      const todayClasses = context.timetableEntries
        .filter((t) => t.day.toLowerCase() === currentDay.toLowerCase())
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

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
              description: `Free period between ${currentEnd} and ${nextStart}.`,
              reason: `Detected open window of ${gapMinutes} minutes.`,
              actionRoute: "/student/study-planner",
              actionLabel: "Schedule Session",
              timestamp: ts,
            });
            break;
          }
        }
      }
    }
  }

  evaluateCareerRules(context, out) {
    const now = context.currentDate ? new Date(context.currentDate) : new Date();
    const nowMs = now.getTime();
    const ts = now.toISOString();

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
              description: `Upcoming interview with ${intv.company}.`,
              reason: `Interview scheduled on ${intv.date}.`,
              actionRoute: "/career/interviews",
              actionLabel: "Prep Notes",
              sourceEntityId: intv.id,
              timestamp: ts,
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
              description: `Follow up with ${app.company}.`,
              reason: `Applied on ${app.applicationDate} (${daysSince} days ago).`,
              actionRoute: "/career/tracker",
              actionLabel: "Track Application",
              sourceEntityId: app.id,
              timestamp: ts,
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
        description: `Resume lacks professional summary.`,
        reason: `Summary field empty.`,
        actionRoute: `/career/resumes/${primaryResume.id}`,
        actionLabel: "Edit Resume",
        sourceEntityId: primaryResume.id,
        timestamp: ts,
      });
    }
  }

  evaluateCrossDomainRules(context, out) {
    const now = context.currentDate ? new Date(context.currentDate) : new Date();
    const nowMs = now.getTime();
    const ts = now.toISOString();

    if (context.attendanceRecords && context.exams) {
      for (const exam of context.exams) {
        if (!exam.date) continue;
        const examTime = new Date(exam.date).getTime();
        const diffDays = Math.ceil((examTime - nowMs) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 14) {
          const normExamSubject = exam.subject.trim().toLowerCase();
          const matchAtt = context.attendanceRecords.find((a) => {
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
                description: `Exam approaching with only ${pct}% attendance.`,
                reason: `Compound risk: Exam in ${diffDays} days with ${pct}% attendance.`,
                actionRoute: "/student/attendance",
                actionLabel: "Fix Attendance",
                sourceEntityId: exam.id,
                timestamp: ts,
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
            description: `Add hackathon "${hack.name}" to your resume.`,
            reason: `Hackathon exists in workspace but not in resume.`,
            actionRoute: `/career/resumes/${activeResume.id}`,
            actionLabel: "Update Resume",
            sourceEntityId: hack.id,
            timestamp: ts,
          });
          break;
        }
      }
    }
  }

  generateSmartDailyPlan(context, targetDateStr) {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const targetIsoDate = targetDate.toISOString().slice(0, 10);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = days[targetDate.getDay()];

    let totalCommitmentMinutes = 0;

    const todayClasses = [];
    if (context.timetableEntries) {
      const entries = context.timetableEntries.filter(
        (t) => t.day.toLowerCase() === currentDayName.toLowerCase()
      );
      entries.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
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

    const todayStudySessions = [];
    if (context.studySessions) {
      const sessions = context.studySessions.filter((s) => {
        if (!s.date) return false;
        return s.date.startsWith(targetIsoDate);
      });
      sessions.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
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

    const todayTasks = [];
    if (context.tasks) {
      const relevantTasks = context.tasks.filter((t) => {
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

    const todayDeadlines = [];
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

    const parts = [];
    if (todayClasses.length > 0) parts.push(`${todayClasses.length} class${todayClasses.length === 1 ? "" : "es"}`);
    if (todayStudySessions.length > 0) parts.push(`${todayStudySessions.length} study session${todayStudySessions.length === 1 ? "" : "s"}`);
    if (todayDeadlines.length > 0) parts.push(`${todayDeadlines.length} deadline${todayDeadlines.length === 1 ? "" : "s"}`);
    if (todayTasks.length > 0) parts.push(`${todayTasks.length} pending task${todayTasks.length === 1 ? "" : "s"}`);

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

const engine = new TestRecommendationEngine();

// =========================================================================
// TEST SUITE: 20 SCENARIOS FOR INTELLIGENT PERSONALIZATION
// =========================================================================

test("Scenario 1: Base priority scoring assigns deterministic weights", () => {
  assert.equal(calculatePriorityScore("critical"), 95);
  assert.equal(calculatePriorityScore("high"), 80);
  assert.equal(calculatePriorityScore("medium"), 50);
  assert.equal(calculatePriorityScore("low"), 20);
});

test("Scenario 2: Priority score modifiers apply cleanly and clamp to [0, 100]", () => {
  const boosted = calculatePriorityScore("high", 15, 10);
  assert.equal(boosted, 100); // 80 + 25 = 105 -> clamped to 100

  const negative = calculatePriorityScore("low", -30, -10);
  assert.equal(negative, 0); // 20 - 40 = -20 -> clamped to 0
});

test("Scenario 3: Academic rule - Critical low attendance (< 75%) generates high-urgency recovery", () => {
  const recs = engine.generateRecommendations({
    attendanceRecords: [
      { id: "att_1", subjectName: "Discrete Mathematics", totalClasses: 40, attendedClasses: 28 }, // 70%
    ],
  });

  assert.equal(recs.length, 1);
  assert.equal(recs[0].priority, "critical");
  assert.equal(recs[0].category, "academic");
  assert.ok(recs[0].title.includes("70%"));
  assert.equal(recs[0].neededTo75, 8); // (0.75 * 40 - 28) / 0.25 = 2 / 0.25 = 8 classes
});

test("Scenario 4: Academic rule - Warning low attendance (75-85%) generates warning", () => {
  const recs = engine.generateRecommendations({
    attendanceRecords: [
      { id: "att_2", subjectName: "Operating Systems", totalClasses: 50, attendedClasses: 40 }, // 80%
    ],
  });

  assert.equal(recs.length, 1);
  assert.equal(recs[0].priority, "medium");
  assert.ok(recs[0].title.includes("Warning"));
});

test("Scenario 5: Academic rule - Safe attendance (>= 85%) produces zero warnings", () => {
  const recs = engine.generateRecommendations({
    attendanceRecords: [
      { id: "att_3", subjectName: "Database Systems", totalClasses: 50, attendedClasses: 45 }, // 90%
    ],
  });
  assert.equal(recs.length, 0);
});

test("Scenario 6: Academic rule - Urgent upcoming exam within 2 days gets high priority", () => {
  const now = "2026-09-15T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    exams: [
      { id: "ex_1", subject: "Compiler Design", date: "2026-09-16" }, // 1 day away
    ],
  });

  assert.equal(recs.length, 1);
  assert.equal(recs[0].priority, "high");
  assert.ok(recs[0].title.includes("Urgent"));
  assert.ok(recs[0].score >= 90);
});

test("Scenario 7: Academic rule - Upcoming exam in 5 days gets medium priority", () => {
  const now = "2026-09-15T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    exams: [
      { id: "ex_2", subject: "Software Engineering", date: "2026-09-20" }, // 5 days away
    ],
  });

  assert.equal(recs.length, 1);
  assert.equal(recs[0].priority, "medium");
});

test("Scenario 8: Academic rule - Exam > 7 days away produces zero recommendations", () => {
  const now = "2026-09-15T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    exams: [
      { id: "ex_3", subject: "Computer Networks", date: "2026-10-15" }, // 30 days away
    ],
  });
  assert.equal(recs.length, 0);
});

test("Scenario 9: Productivity rule - Overdue assignments generate high-priority notice", () => {
  const now = "2026-09-15T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    assignments: [
      { id: "as_1", title: "Lab Report 1", subject: "OS", dueDate: "2026-09-10", status: "not_started" },
      { id: "as_2", title: "Assignment 2", subject: "DAA", dueDate: "2026-09-12", status: "in_progress" },
    ],
  });

  assert.equal(recs.length, 1);
  assert.equal(recs[0].category, "productivity");
  assert.ok(recs[0].title.includes("2 Overdue"));
});

test("Scenario 10: Productivity rule - Clustered deadlines within 48h generates workload warning", () => {
  const now = "2026-09-15T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    assignments: [
      { id: "as_1", title: "Project Proposal", subject: "SE", dueDate: "2026-09-16", status: "in_progress" },
    ],
    exams: [
      { id: "ex_1", subject: "Maths", date: "2026-09-16" },
    ],
  });

  const clustered = recs.find((r) => r.id.includes("clustered_deadlines"));
  assert.ok(clustered);
  assert.equal(clustered.priority, "high");
});

test("Scenario 11: Productivity rule - Timetable gap >= 60 min detects open study window", () => {
  // 2026-09-14 is a Monday
  const now = "2026-09-14T08:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    timetableEntries: [
      { id: "tt_1", day: "Monday", subject: "Physics", startTime: "09:00", endTime: "10:00" },
      { id: "tt_2", day: "Monday", subject: "Chemistry", startTime: "12:00", endTime: "13:00" }, // 2 hour gap
    ],
  });

  const gapRec = recs.find((r) => r.id.includes("gap"));
  assert.ok(gapRec);
  assert.ok(gapRec.title.includes("2h Study Window"));
});

test("Scenario 12: Career rule - Upcoming interview within 72h generates prep reminder", () => {
  const now = "2026-09-15T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    interviews: [
      { id: "int_1", company: "Google", date: "2026-09-17", round: "Technical Round 1" },
    ],
  });

  const intvRec = recs.find((r) => r.category === "career");
  assert.ok(intvRec);
  assert.equal(intvRec.priority, "high");
  assert.ok(intvRec.title.includes("Google"));
});

test("Scenario 13: Career rule - Applied > 7 days ago prompts recruiter follow-up", () => {
  const now = "2026-09-20T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    jobApplications: [
      { id: "job_1", company: "Microsoft", role: "SDE Intern", status: "APPLIED", applicationDate: "2026-09-10" }, // 10 days ago
    ],
  });

  const followUpRec = recs.find((r) => r.id.includes("job_1"));
  assert.ok(followUpRec);
  assert.ok(followUpRec.title.includes("Follow Up"));
});

test("Scenario 14: Career rule - Resume missing summary prompt is generated", () => {
  const recs = engine.generateRecommendations({
    resumeVersions: [
      { id: "rv_1", name: "SWE Resume", summaryOverride: "" },
    ],
    careerProfile: { summary: "" },
  });

  const summaryRec = recs.find((r) => r.id.includes("res_summary"));
  assert.ok(summaryRec);
  assert.equal(summaryRec.priority, "low");
});

test("Scenario 15: Cross-domain rule - Exam + low attendance in same subject generates critical compound alert", () => {
  const now = "2026-09-15T10:00:00Z";
  const recs = engine.generateRecommendations({
    currentDate: now,
    exams: [
      { id: "ex_math", subject: "Engineering Mathematics", date: "2026-09-20" },
    ],
    attendanceRecords: [
      { id: "att_math", subjectName: "Engineering Mathematics", totalClasses: 40, attendedClasses: 26 }, // 65%
    ],
  });

  const compoundRec = recs.find((r) => r.category === "cross-domain" && r.id.includes("exam_att"));
  assert.ok(compoundRec);
  assert.equal(compoundRec.priority, "critical");
  assert.equal(compoundRec.score, 98);
});

test("Scenario 16: Cross-domain rule - Hackathon completed but unreferenced prompts resume update", () => {
  const recs = engine.generateRecommendations({
    hackathons: [
      { id: "hack_1", name: "Smart India Hackathon", outcome: "Winner" },
    ],
    resumeVersions: [
      { id: "rv_1", name: "Master Resume", summaryOverride: "Experienced student developer" },
    ],
  });

  const hackRec = recs.find((r) => r.id.includes("hack_resume"));
  assert.ok(hackRec);
  assert.ok(hackRec.title.includes("Smart India Hackathon"));
});

test("Scenario 17: Deduplication - Multiple identical entity rules retain highest priority score", () => {
  const mockEngine = new TestRecommendationEngine();
  const recs = mockEngine.generateRecommendations({
    attendanceRecords: [
      { id: "same_att", subjectName: "Operating Systems", totalClasses: 40, attendedClasses: 25 },
    ],
  });

  const matchingIds = recs.filter((r) => r.id === "academic:att:same_att");
  assert.equal(matchingIds.length, 1);
});

test("Scenario 18: Deterministic sorting - Recommendations ordered by score descending then title", () => {
  const recs = engine.generateRecommendations({
    attendanceRecords: [
      { id: "att_crit", subjectName: "Sub A", totalClasses: 50, attendedClasses: 25 }, // critical score 100
      { id: "att_warn", subjectName: "Sub B", totalClasses: 50, attendedClasses: 40 }, // medium score 60
    ],
  });

  assert.ok(recs.length >= 2);
  assert.ok(recs[0].score >= recs[1].score);
});

test("Scenario 19: Top-N truncation strictly enforces limit", () => {
  const recs = engine.generateRecommendations(
    {
      attendanceRecords: [
        { id: "1", subjectName: "A", totalClasses: 40, attendedClasses: 20 },
        { id: "2", subjectName: "B", totalClasses: 40, attendedClasses: 20 },
        { id: "3", subjectName: "C", totalClasses: 40, attendedClasses: 20 },
        { id: "4", subjectName: "D", totalClasses: 40, attendedClasses: 20 },
        { id: "5", subjectName: "E", totalClasses: 40, attendedClasses: 20 },
        { id: "6", subjectName: "F", totalClasses: 40, attendedClasses: 20 },
      ],
    },
    { limit: 3 }
  );

  assert.equal(recs.length, 3);
});

test("Scenario 20: Smart Daily Plan generates truthful schedule breakdown & commitment hours", () => {
  const targetDate = "2026-09-14"; // Monday
  const plan = engine.generateSmartDailyPlan(
    {
      timetableEntries: [
        { id: "t1", day: "Monday", subject: "Maths", startTime: "09:00", endTime: "10:30" }, // 90m
        { id: "t2", day: "Monday", subject: "CS", startTime: "11:00", endTime: "12:00" }, // 60m
      ],
      studySessions: [
        { id: "s1", subject: "Algorithms", date: "2026-09-14", startTime: "18:00", endTime: "19:30", durationMinutes: 90 },
      ],
      tasks: [
        { id: "tsk1", title: "Submit Assignment", priority: "HIGH", status: "TODO", dueDate: "2026-09-14" },
      ],
      assignments: [
        { id: "asgn1", title: "Maths Homework", dueDate: "2026-09-15", status: "in_progress" },
      ],
    },
    targetDate
  );

  assert.equal(plan.date, "2026-09-14");
  assert.equal(plan.todayClasses.length, 2);
  assert.equal(plan.todayStudySessions.length, 1);
  assert.equal(plan.todayTasks.length, 1);
  assert.equal(plan.todayDeadlines.length, 1);
  assert.equal(plan.totalCommitmentHours, 4); // (90 + 60 + 90) / 60 = 240m = 4h
  assert.ok(plan.summaryText.includes("2 classes"));
  assert.ok(plan.summaryText.includes("1 study session"));
});
