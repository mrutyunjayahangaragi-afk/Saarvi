import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("Saarvi Resume Builder 6.0 — Adaptive Step-by-Step Completion Wizard Master Test Suite", async (t) => {
  // 1. Static Architecture and File Structure Verification
  await t.test("1. Required Wizard files and exports exist", () => {
    const servicePath = path.join(rootDir, "src/lib/services/resumeCompletionService.ts");
    const wizardPath = path.join(rootDir, "src/components/career/ResumeCompletionWizard.tsx");
    const pagePath = path.join(rootDir, "src/app/student/resume/page.tsx");

    assert.ok(fs.existsSync(servicePath), "resumeCompletionService.ts must exist");
    assert.ok(fs.existsSync(wizardPath), "ResumeCompletionWizard.tsx must exist");
    assert.ok(fs.existsSync(pagePath), "page.tsx must exist");

    const serviceCode = fs.readFileSync(servicePath, "utf8");
    assert.ok(serviceCode.includes("export const resumeCompletionService"), "Exports resumeCompletionService");
    assert.ok(serviceCode.includes("WIZARD_STEP_DEFINITIONS"), "Exports step definitions");
    assert.ok(serviceCode.includes("validateForExport"), "Exports validateForExport");

    const wizardCode = fs.readFileSync(wizardPath, "utf8");
    assert.ok(wizardCode.includes("export const ResumeCompletionWizard"), "Exports ResumeCompletionWizard component");
    assert.ok(wizardCode.includes("data-saarvi-target=\"resume-wizard\""), "Contains resume-wizard data target");
  });

  // 2. Dynamic Service Logic Verification
  const { resumeCompletionService, WIZARD_STEP_DEFINITIONS } = await import(
    "../src/lib/services/resumeCompletionService.ts"
  );

  await t.test("2. Core vs Recommended vs Optional Step Classification", () => {
    const contactStep = WIZARD_STEP_DEFINITIONS.find((s) => s.id === "contact");
    assert.ok(contactStep, "Contact step exists");
    assert.equal(contactStep.level, "CORE");
    assert.equal(contactStep.canSkip, false, "Contact cannot be skipped");
    assert.equal(contactStep.targetId, "resume-personal");

    const summaryStep = WIZARD_STEP_DEFINITIONS.find((s) => s.id === "summary");
    assert.equal(summaryStep.level, "RECOMMENDED");

    const educationStep = WIZARD_STEP_DEFINITIONS.find((s) => s.id === "education");
    assert.equal(educationStep.level, "RECOMMENDED");

    const experienceStep = WIZARD_STEP_DEFINITIONS.find((s) => s.id === "experience");
    assert.equal(experienceStep.level, "RECOMMENDED");
    assert.equal(experienceStep.canSkip, true);
    assert.equal(experienceStep.canMarkNotApplicable, true);

    const projectsStep = WIZARD_STEP_DEFINITIONS.find((s) => s.id === "projects");
    assert.equal(projectsStep.level, "RECOMMENDED");

    const optionalSections = ["certifications", "leadership", "volunteering", "languages", "additional"];
    for (const optId of optionalSections) {
      const step = WIZARD_STEP_DEFINITIONS.find((s) => s.id === optId);
      assert.ok(step, `Step ${optId} exists`);
      assert.equal(step.level, "OPTIONAL", `${optId} must be classified as OPTIONAL`);
      assert.equal(step.canSkip, true, `${optId} can be skipped`);
      assert.equal(step.canMarkNotApplicable, true, `${optId} can be marked not applicable`);
    }
  });

  await t.test("3. Deterministic Validation for Core Export", () => {
    // Missing Full Name
    const resNoName = resumeCompletionService.validateForExport({
      id: "p1",
      fullName: "",
      email: "alex@example.com",
    });
    assert.equal(resNoName.isValid, false);
    assert.equal(resNoName.missingSection, "contact");
    assert.equal(resNoName.missingField, "fullName");

    // Missing Email
    const resNoEmail = resumeCompletionService.validateForExport({
      id: "p2",
      fullName: "Alex Johnson",
      email: "",
    });
    assert.equal(resNoEmail.isValid, false);
    assert.equal(resNoEmail.missingSection, "contact");
    assert.equal(resNoEmail.missingField, "email");

    // Invalid Email format
    const resInvalidEmail = resumeCompletionService.validateForExport({
      id: "p3",
      fullName: "Alex Johnson",
      email: "invalid-email-address",
    });
    assert.equal(resInvalidEmail.isValid, false);
    assert.equal(resInvalidEmail.missingField, "email");

    // Valid Core (no optional sections needed to export!)
    const resValid = resumeCompletionService.validateForExport({
      id: "p4",
      fullName: "Alex Johnson",
      email: "alex.johnson@example.com",
    });
    assert.equal(resValid.isValid, true);
    assert.equal(resValid.missingSection, null);
  });

  await t.test("4. Deterministic Progress Score & Never-Fake Calculation", () => {
    // 0% for empty profile
    const emptyReport = resumeCompletionService.generateReport({
      id: "empty",
      fullName: "",
      email: "",
      skills: [],
      education: [],
      experience: [],
      projects: [],
      certifications: [],
    });
    assert.equal(emptyReport.percentage, 0, "Empty profile should be 0%");
    assert.equal(emptyReport.readinessState, "NOT_STARTED");
    assert.equal(emptyReport.canExport, false);

    // Profile with Core + Education + Projects + Skills + Summary, and all optional skipped
    const completeProfile = {
      id: "comp",
      fullName: "Alex Johnson",
      email: "alex@example.com",
      summary: "Aspiring full-stack software engineer with hands-on project experience.",
      education: [
        {
          id: "e1",
          institution: "VTU University",
          degree: "B.E. Computer Science",
          fieldOfStudy: "CSE",
          startDate: "2020",
          endDate: "2024",
        },
      ],
      experience: [], // Student has no work experience
      projects: [
        {
          id: "pr1",
          title: "Cloud E-Commerce Platform",
          technologies: ["React", "Node.js"],
          highlights: ["Engineered microservices architecture"],
        },
      ],
      skills: [{ id: "s1", name: "JavaScript", category: "Programming Languages" }],
      certifications: [],
      leadership: [],
      volunteering: [],
      languages: [],
      additionalInfo: "",
    };

    const skippedSet = new Set([
      "experience",
      "certifications",
      "leadership",
      "volunteering",
      "languages",
      "additional",
    ]);

    const report = resumeCompletionService.generateReport(
      completeProfile,
      undefined,
      "contact",
      skippedSet,
      new Set()
    );

    // CRITICAL ACCEPTANCE: Optional skips do not make 100% impossible!
    assert.equal(report.percentage, 100, "Core + recommended satisfied with skipped optional must yield 100%");
    assert.equal(report.readinessState, "READY_TO_EXPORT");
    assert.equal(report.canExport, true);
    assert.ok(
      report.readinessMessage.includes("ready to export"),
      "Message clarifies readiness and explains skipped optional sections"
    );
  });

  await t.test("5. Adaptive Step Transition (Fresher / No Experience Path)", () => {
    const studentProfile = {
      id: "s1",
      fullName: "Rahul Sharma",
      email: "rahul@example.com",
      education: [{ id: "e1", institution: "VTU", degree: "B.E." }],
      experience: [],
      projects: [],
      skills: [],
    };

    // When on experience and experience is empty or marked skipped,
    // next step intelligently transitions to projects
    const nextStep = resumeCompletionService.getNextStepAfter(
      "experience",
      studentProfile,
      undefined,
      new Set(["experience"]),
      new Set()
    );
    assert.equal(nextStep, "projects", "Skipping experience immediately routes to projects");
  });

  await t.test("6. Return / Continue Where You Left Off Logic", () => {
    // User filled contact and education, left projects and skills incomplete
    const partialProfile = {
      id: "part",
      fullName: "Priya Rao",
      email: "priya@example.com",
      education: [{ id: "e1", institution: "VTU", degree: "B.E." }],
      experience: [],
      projects: [],
      skills: [],
    };

    const report = resumeCompletionService.generateReport(
      partialProfile,
      undefined,
      "contact",
      new Set(["experience"]),
      new Set()
    );

    assert.ok(report.firstIncompleteMeaningfulStep, "Finds first incomplete step");
    assert.equal(
      report.firstIncompleteMeaningfulStep.id,
      "projects",
      "Returns projects as the first incomplete meaningful step when experience is skipped"
    );
  });

  await t.test("7. Integration into page.tsx: Targets, SmartReveal & Privacy", () => {
    const pageCode = fs.readFileSync(path.join(rootDir, "src/app/student/resume/page.tsx"), "utf8");

    // All required stable data-saarvi-target attributes
    const requiredTargets = [
      "resume-personal",
      "resume-summary",
      "resume-education",
      "resume-experience",
      "resume-projects",
      "resume-skills",
      "resume-certifications",
      "resume-hackathons",
      "resume-achievements",
      "resume-leadership",
      "resume-volunteering",
      "resume-languages",
      "resume-additional",
      "resume-editor",
      "resume-wizard",
    ];

    for (const target of requiredTargets) {
      assert.ok(
        pageCode.includes(`data-saarvi-target="${target}"`),
        `page.tsx must contain data-saarvi-target="${target}"`
      );
    }

    // Input IDs for auto-focus on core export validation fail
    assert.ok(pageCode.includes("id=\"contact-fullname-input\""), "Has contact-fullname-input id");
    assert.ok(pageCode.includes("id=\"contact-email-input\""), "Has contact-email-input id");

    // Integrated ResumeCompletionWizard component
    assert.ok(pageCode.includes("<ResumeCompletionWizard"), "Renders ResumeCompletionWizard");

    // Integrated Step Action Bar
    assert.ok(pageCode.includes("{renderSectionFooter(activeTab)}"), "Renders renderSectionFooter");
    assert.ok(pageCode.includes("Save & Continue"), "Contains Save & Continue action");
    assert.ok(pageCode.includes("Save & Exit"), "Contains Save & Exit action");

    // Integrated Compact Header Progress Banner
    assert.ok(pageCode.includes("Continue where you left off:"), "Contains Continue where you left off header");

    // Zero-PII analytics rule
    assert.ok(pageCode.includes("trackResumeWizardEvent"), "Contains trackResumeWizardEvent");
    // Ensure no name or email is placed into analytics payload
    assert.ok(!pageCode.includes("fullName: profile"), "Analytics must not leak profile fullName");
    assert.ok(!pageCode.includes("email: profile"), "Analytics must not leak profile email");
  });
});
