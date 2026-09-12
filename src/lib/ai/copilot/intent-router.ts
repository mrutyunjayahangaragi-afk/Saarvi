import { CopilotIntentCategory, CopilotContextCategory } from "@/types/copilot";

/**
 * Deterministic Intent Router
 *
 * Evaluates user queries using rule and keyword matching before attempting any AI classification.
 * Matches common academic, planning, career, and document questions.
 */
export function routeIntent(query: string): CopilotIntentCategory {
  const q = query.toLowerCase().trim();

  // 1. Direct Academic Numerical Inquiries
  if (
    /(what is my|show my|current|my)\s*(sgpa|cgpa|gpa|marks percentage|grade point)/i.test(q) ||
    /^(sgpa|cgpa|gpa)\??$/i.test(q)
  ) {
    return "ACADEMIC_RESULT";
  }

  // 2. Attendance Questions
  if (/(attendance|shortage|bunk|miss class|classes needed|attend classes|safe attendance)/i.test(q)) {
    return "ATTENDANCE";
  }

  // 3. Exam Inquiries
  if (/(exam|test date|finals|midterm|internal test|cie test|see exam|when is my exam)/i.test(q)) {
    return "EXAM";
  }

  // 4. Study Planning & Daily Organization
  if (
    /(plan my day|study plan|what should i study|schedule study|daily plan|today's plan|plan today)/i.test(q)
  ) {
    return "STUDY_PLANNING";
  }

  // 5. Tasks & Assignments
  if (/(assignment|task|homework|submission|pending work|deadline)/i.test(q)) {
    return "TASK";
  }

  // 6. Resume
  if (/(resume|cv|ats|summary section|bullet point|highlight project)/i.test(q)) {
    return "RESUME";
  }

  // 7. Interview & Mock Prep
  if (/(interview|mock interview|prep for interview|practice question|behavioral question)/i.test(q)) {
    return "INTERVIEW";
  }

  // 8. Job Application & Follow-ups
  if (/(application|job post|job description|applied to|recruiter follow-up|follow up)/i.test(q)) {
    return "APPLICATION";
  }

  // 9. Career & Skills
  if (/(skill.*gap|skills? (needed|required|missing|am i missing)|missing skills?|career|internship|job role)/i.test(q)) {
    return "CAREER";
  }

  // 10. Document
  if (/(document|pdf|this file|read this|summarize this file|attached)/i.test(q)) {
    return "DOCUMENT";
  }

  // 11. Academic Explanations
  if (/(why is my sgpa|explain (how|my|vtu)|how (does )?vtu calculate|credit system|grading band|grade points)/i.test(q)) {
    return "ACADEMIC_EXPLANATION";
  }

  return "GENERAL";
}

/**
 * Determines which minimal context categories are needed for a specific intent.
 * Enforces strict data minimization: never requests all categories by default.
 */
export function getRequiredContextCategories(intent: CopilotIntentCategory): CopilotContextCategory[] {
  switch (intent) {
    case "ACADEMIC_RESULT":
    case "ATTENDANCE":
    case "EXAM":
    case "ACADEMIC_EXPLANATION":
      return ["academic"];

    case "STUDY_PLANNING":
      return ["academic", "productivity"];

    case "TASK":
      return ["productivity"];

    case "RESUME":
    case "APPLICATION":
    case "INTERVIEW":
    case "CAREER":
      return ["career"];

    case "DOCUMENT":
      return ["documents"];

    case "GENERAL":
    default:
      return ["conversation"];
  }
}

/**
 * Flags queries that can be answered 100% deterministically without external AI processing.
 */
export function isDirectDeterministicQuery(intent: CopilotIntentCategory): boolean {
  return intent === "ACADEMIC_RESULT";
}
