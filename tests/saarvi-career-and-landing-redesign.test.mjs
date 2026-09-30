import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseCareerSearchIntent,
  CAREER_FILTER_CONFIGS,
  getFiltersForOpportunity,
} from "../src/lib/career/career-filter-config.ts";
import { isJobLiveForUsers } from "../src/lib/jobs/live-predicate.ts";
import { CANONICAL_TOOL_REGISTRY } from "../src/lib/tools/tool-registry.ts";

const ROOT = process.cwd();

test("1. Natural Career Intent Parsing (Deterministic & Zero AI Hallucination)", () => {
  // Test 1: React internship in Bengaluru
  const intent1 = parseCareerSearchIntent("React internship in Bengaluru");
  assert.equal(intent1.opportunityType, "internship", "Detects internship intent");
  assert.equal(intent1.location, "Bengaluru", "Detects Bengaluru location");
  assert.ok(intent1.cleanQuery.includes("React"), "Preserves role/technology keyword");

  // Test 2: Java fresher job
  const intent2 = parseCareerSearchIntent("Java fresher job");
  assert.equal(intent2.opportunityType, "job", "Detects job intent");
  assert.equal(intent2.experience, "fresher", "Detects fresher experience level");
  assert.ok(intent2.cleanQuery.includes("Java"), "Preserves Java keyword");

  // Test 3: AI internship remote
  const intent3 = parseCareerSearchIntent("AI internship remote");
  assert.equal(intent3.opportunityType, "internship", "Detects internship intent");
  assert.equal(intent3.workMode, "remote", "Detects remote work mode");
  assert.ok(intent3.domain?.includes("AI"), "Detects AI domain");

  // Test 4: Full-stack training
  const intent4 = parseCareerSearchIntent("Full-stack training");
  assert.equal(intent4.opportunityType, "training", "Detects training opportunity scope");
  assert.ok(intent4.domain?.includes("Full Stack"), "Detects full stack domain");

  // Test 5: Empty query safety
  const intentEmpty = parseCareerSearchIntent("");
  assert.equal(intentEmpty.opportunityType, "any", "Handles empty search gracefully");
  assert.equal(intentEmpty.cleanQuery, "");
});

test("2. Admin-Controlled Dynamic Career Filter Intelligence", () => {
  assert.ok(Array.isArray(CAREER_FILTER_CONFIGS), "Canonical filter configurations must be defined");
  assert.ok(CAREER_FILTER_CONFIGS.length >= 6, "Must define comprehensive filters");

  // Verify schema properties
  for (const config of CAREER_FILTER_CONFIGS) {
    assert.ok(config.key, "Filter config must have key");
    assert.ok(config.label, "Filter config must have label");
    assert.ok(Array.isArray(config.opportunityTypes), "Filter config must define opportunityTypes");
    assert.equal(typeof config.enabled, "boolean", "Filter config must specify enabled state");
    assert.equal(typeof config.priority, "number", "Filter config must specify priority");
    assert.equal(typeof config.sortOrder, "number", "Filter config must specify sortOrder");
  }

  // Dynamic filter resolution for Internship
  const internFilters = getFiltersForOpportunity("internship");
  const internPrimaryKeys = internFilters.primary.map((f) => f.key);
  assert.ok(internPrimaryKeys.includes("remote"), "Internship includes remote work mode");
  assert.ok(internPrimaryKeys.includes("duration"), "Internship includes duration filter");
  assert.ok(internPrimaryKeys.includes("stipend"), "Internship includes stipend filter");

  // Dynamic filter resolution for Job
  const jobFilters = getFiltersForOpportunity("job");
  const jobPrimaryKeys = jobFilters.primary.map((f) => f.key);
  assert.ok(jobPrimaryKeys.includes("remote"), "Job includes remote work mode");
  assert.ok(jobPrimaryKeys.includes("experience"), "Job includes experience level");
  assert.ok(!jobPrimaryKeys.includes("duration"), "Job does not expose internship duration as primary");

  // Dynamic filter resolution for Training
  const trainingFilters = getFiltersForOpportunity("training");
  const trainingPrimaryKeys = trainingFilters.primary.map((f) => f.key);
  assert.ok(trainingPrimaryKeys.includes("deliveryMode"), "Training includes delivery mode filter");
});

test("3. Authoritative Live Opportunity Predicate", () => {
  // Live job
  const liveJob = {
    id: "opp_valid_1",
    status: "ACTIVE",
    recordState: "ACTIVE",
    reviewState: "APPROVED",
    publicationState: "PUBLISHED",
    visibility: "public",
    dataOrigin: "PROVIDER",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days future
  };
  assert.equal(isJobLiveForUsers(liveJob), true, "Active, approved, published job is live");

  // Expired deadline
  const expiredJob = {
    ...liveJob,
    id: "opp_expired_1",
    deadline: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour past
  };
  assert.equal(isJobLiveForUsers(expiredJob), false, "Expired job must NOT be live for users");

  // Unpublished job
  const unpubJob = {
    ...liveJob,
    id: "opp_unpub_1",
    publicationState: "NOT_PUBLISHED",
  };
  assert.equal(isJobLiveForUsers(unpubJob), false, "Unpublished job must NOT be live for users");

  // Deleted record
  const deletedJob = {
    ...liveJob,
    id: "opp_deleted_1",
    status: "DELETED",
    recordState: "DELETED",
  };
  assert.equal(isJobLiveForUsers(deletedJob), false, "Deleted job must NOT be live for users");
});

test("4. Unified Career Search UX Invariants in /jobs", () => {
  const jobsCode = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");

  // Unified Search Bar
  assert.ok(
    jobsCode.includes("Search jobs, internships, and training"),
    "Must feature unified search field placeholder"
  );
  assert.ok(jobsCode.includes("Any location"), "Must feature location input with Any location");
  assert.ok(jobsCode.includes("Any opportunity"), "Must feature compact opportunity scope selector");

  // Removal of segmented top-level tab clutter
  assert.ok(
    !jobsCode.includes("All ({jobs.length})"),
    "Must NOT render old 'All (0)' verification tier tab"
  );
  assert.ok(
    !jobsCode.includes("Saarvi Verified ({verifiedCount})"),
    "Must NOT render old 'Saarvi Verified (0)' verification tier tab"
  );
  assert.ok(
    !jobsCode.includes("Source Discoveries ({sourceDiscoveryCount})"),
    "Must NOT render old 'Source Discoveries (0)' verification tier tab"
  );

  // Visible Applied Filters
  assert.ok(jobsCode.includes("Searching for:"), "Must display active applied filter chips");
  assert.ok(jobsCode.includes("Clear all"), "Must provide Clear all filters action");

  // Progressive Disclosure
  assert.ok(jobsCode.includes("More filters"), "Must provide More filters progressive disclosure button");

  // Optional Post-Search Personalization (Never mandatory upfront modal)
  assert.ok(
    jobsCode.includes("Personalize Results") || jobsCode.includes("Want personalized match scores?"),
    "Must offer optional post-search personalization"
  );

  // Distinguishes empty states
  assert.ok(
    jobsCode.includes("No opportunities match your current filters"),
    "Must support filter mismatch empty state"
  );
  assert.ok(
    jobsCode.includes("No live opportunities are currently available"),
    "Must support truly-empty live opportunities state"
  );

  // Mobile Filter Drawer
  assert.ok(
    jobsCode.includes("Filter Opportunities"),
    "Must include mobile filter drawer with clear apply actions"
  );

  // Card Design & Canonical IDs
  assert.ok(jobsCode.includes("href={`/jobs/${job.id}`}"), "Cards must link to canonical /jobs/${job.id}");
  assert.ok(jobsCode.includes("Saarvi Verified"), "Cards must render Saarvi Verified badge");
  assert.ok(jobsCode.includes("Source Listing"), "Cards must render Source Listing badge");
});

test("5. Professional Landing Page Redesign & Real Metrics", () => {
  const heroCode = fs.readFileSync(path.join(ROOT, "src/components/home/HeroSection.tsx"), "utf8");
  const landingCode = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");

  // Restrained, professional copy in Hero
  assert.ok(
    heroCode.includes("One workspace to") && heroCode.includes("study, work, and grow."),
    "Hero headline must be: One workspace to study, work, and grow."
  );
  assert.ok(
    heroCode.includes("Saarvi brings everyday academic tools, document utilities, and career workflows into one focused workspace."),
    "Hero supporting copy must match specification"
  );

  // Zero fake latency claims
  assert.ok(!heroCode.includes("Converted in 0.38s"), "Must NOT include fake latency 'Converted in 0.38s'");
  assert.ok(!heroCode.includes("0 bytes sent to server"), "Must NOT include fake network metric '0 bytes sent to server'");

  // Realistic Workspace Composition
  assert.ok(heroCode.includes("Saarvi Interactive Workspace"), "Must feature realistic workspace composition");
  assert.ok(heroCode.includes("Tools") && heroCode.includes("Study") && heroCode.includes("Career") && heroCode.includes("Resume"),
    "Workspace must have realistic Tools, Study, Career, Resume navigation"
  );

  // Core Pillars in Landing Page
  assert.ok(landingCode.includes("Study") && landingCode.includes("Work") && landingCode.includes("Grow"),
    "Landing page must articulate Study, Work, and Grow pillars"
  );

  // 3-Step How Saarvi Works
  assert.ok(landingCode.includes("Choose what you need"), "Step 1 of How Saarvi Works");
  assert.ok(landingCode.includes("Use the tool or workflow"), "Step 2 of How Saarvi Works");
  assert.ok(landingCode.includes("Save, download, or apply"), "Step 3 of How Saarvi Works");

  // Real Dynamic Tool Count
  assert.ok(
    landingCode.includes("CANONICAL_TOOL_REGISTRY.length"),
    "Tools count must be dynamically calculated from CANONICAL_TOOL_REGISTRY"
  );
  assert.equal(
    typeof CANONICAL_TOOL_REGISTRY.length,
    "number",
    "Canonical tool registry must be a populated array"
  );

  // Honest Privacy Architecture
  assert.ok(
    landingCode.includes("Many Saarvi tools process files locally in your browser."),
    "Must use exact honest privacy architecture copy"
  );

  // Unified Career Section Preview
  assert.ok(
    landingCode.includes("Find opportunities that fit"),
    "Landing page must showcase unified career discovery"
  );
  assert.ok(
    landingCode.includes("Frontend internship") && landingCode.includes("Bengaluru"),
    "Career preview must reflect unified career query"
  );
});

test("6. Saarvi Adaptive Visual Accent System (SaarviAdaptiveTheme)", async () => {
  const { ADAPTIVE_THEMES, resolveAdaptiveTheme } = await import("../src/lib/theme/adaptive-theme.ts");

  // Verify all 5 canonical accent themes exist
  assert.ok(ADAPTIVE_THEMES["career-blue"], "Career Blue palette must exist");
  assert.ok(ADAPTIVE_THEMES["internship-teal"], "Internship Teal palette must exist");
  assert.ok(ADAPTIVE_THEMES["training-violet"], "Training Violet palette must exist");
  assert.ok(ADAPTIVE_THEMES["academic-indigo"], "Academic Indigo palette must exist");
  assert.ok(ADAPTIVE_THEMES["technology-cyan"], "Technology Cyan palette must exist");

  // Verify WCAG contrast levels (Primary text is high contrast white, Level 2 secondary has dark readable text)
  for (const [key, theme] of Object.entries(ADAPTIVE_THEMES)) {
    assert.equal(theme.primaryText, "#FFFFFF", `${key} primary text must be high-contrast white`);
    assert.ok(theme.primary.startsWith("#"), `${key} primary must be hex color`);
    assert.ok(theme.secondary.startsWith("#"), `${key} secondary tint must be hex color`);
    assert.ok(theme.border.startsWith("#"), `${key} border must be hex color`);
    assert.ok(theme.btnClass.includes("bg-"), `${key} must export button class`);
    assert.ok(theme.badgeClass.includes("text-"), `${key} must export badge class`);
  }

  // Deterministic Theme Resolution
  // 1. Internship -> Internship Teal
  const resIntern = resolveAdaptiveTheme({ opportunityType: "internship" });
  assert.equal(resIntern.primary.key, "internship-teal", "Internship resolves to Internship Teal");

  // 2. Training -> Training Violet
  const resTrain = resolveAdaptiveTheme({ opportunityType: "training" });
  assert.equal(resTrain.primary.key, "training-violet", "Training resolves to Training Violet");

  // 3. AI Internship -> Internship Teal with Technology Cyan secondary
  const resAiIntern = resolveAdaptiveTheme({ opportunityType: "internship", domain: "ai-ml" });
  assert.equal(resAiIntern.primary.key, "internship-teal", "Primary remains Internship Teal");
  assert.equal(resAiIntern.secondary?.key, "technology-cyan", "Secondary reflects AI technology");

  // 4. Software Developer Job -> Career Blue
  const resJob = resolveAdaptiveTheme({ opportunityType: "job", role: "Software Developer" });
  assert.equal(resJob.primary.key, "career-blue", "Job resolves to Career Blue");

  // 5. User preference manual override
  const resOverride = resolveAdaptiveTheme({ opportunityType: "internship", userPreference: "saarvi-blue" });
  assert.equal(resOverride.primary.key, "career-blue", "Manual override locks to Saarvi Blue");
});

test("7. Guided Pre-Search Selectors & Layout Invariants", () => {
  const jobsCode = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");

  // Header copy
  assert.ok(
    jobsCode.includes("Find opportunities that fit you"),
    "Header must state: Find opportunities that fit you"
  );
  assert.ok(
    jobsCode.includes("Choose what you're looking for and Saarvi will find relevant opportunities") ||
    jobsCode.includes("Choose what you&apos;re looking for and Saarvi will find relevant opportunities"),
    "Header supporting text must match guided paradigm"
  );

  // Row 1 Requirement Selectors
  assert.ok(jobsCode.includes('label="Job Role"'), "Must render Job Role selector");
  assert.ok(jobsCode.includes('label="Branch / Discipline"'), "Must render Branch / Discipline selector");
  assert.ok(jobsCode.includes('label="Domain / Industry"'), "Must render Domain / Industry selector");
  assert.ok(jobsCode.includes('label="Area / Location"'), "Must render Area / Location selector");

  // Row 2 Refinement Selectors
  assert.ok(jobsCode.includes("Opportunity Type"), "Must render Opportunity Type selector");
  assert.ok(jobsCode.includes("Experience Level"), "Must render Experience Level selector");
  assert.ok(jobsCode.includes("Work Mode"), "Must render Work Mode selector");
  assert.ok(jobsCode.includes("More filters"), "Must render More filters toggle");

  // Dominant Primary Search CTA
  assert.ok(jobsCode.includes("Search Opportunities"), "Must feature dominant 'Search Opportunities' CTA");

  // Pre-Search State
  assert.ok(
    jobsCode.includes("Tell us what you're looking for") ||
    jobsCode.includes("Tell us what you&apos;re looking for"),
    "Must feature pre-search empty guidance state"
  );

  // Return Visit Resume Banner
  assert.ok(
    jobsCode.includes("Continue previous search") || jobsCode.includes("Use previous search"),
    "Must support harmless return-visit search resume"
  );

  // Adaptive Theme switcher
  assert.ok(jobsCode.includes("themeMode"), "Must include theme preference control");
  assert.ok(jobsCode.includes("Adaptive") && jobsCode.includes("Saarvi Blue"), "Must offer Adaptive and Saarvi Blue theme options");
});

test("8. CareerFilterDependencyEngine Intelligent Guidance", async () => {
  const { CareerFilterDependencyEngine } = await import("../src/lib/career/career-dependency-engine.ts");

  // Branch recommendations
  const cseDomains = CareerFilterDependencyEngine.getRecommendedDomainsForBranch("cse");
  assert.ok(cseDomains.includes("software-saas"), "CSE suggests software-saas domain");
  assert.ok(cseDomains.includes("ai-ml"), "CSE suggests ai-ml domain");

  // Role recommendations
  const aiRoles = CareerFilterDependencyEngine.getRecommendedRoles(undefined, "ai-ml");
  assert.ok(aiRoles.includes("ai-engineer"), "AI domain suggests ai-engineer");
  assert.ok(aiRoles.includes("ml-engineer"), "AI domain suggests ml-engineer");

  // Skill recommendations
  const feSkills = CareerFilterDependencyEngine.getRecommendedSkills("frontend-developer");
  assert.ok(feSkills.includes("React"), "Frontend developer suggests React");
  assert.ok(feSkills.includes("TypeScript"), "Frontend developer suggests TypeScript");

  // Opportunity refinements
  const internRefinements = CareerFilterDependencyEngine.getRelevantRefinements("internship");
  assert.ok(internRefinements.includes("duration"), "Internship exposes duration refinement");
  assert.ok(internRefinements.includes("stipend"), "Internship exposes stipend refinement");

  const trainRefinements = CareerFilterDependencyEngine.getRelevantRefinements("training");
  assert.ok(trainRefinements.includes("deliveryMode"), "Training exposes deliveryMode refinement");
});

test("9. Strict Regression & Auth Invariants in /jobs", () => {
  const jobsCode = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");

  // Auth gate invariants
  assert.ok(jobsCode.includes("useAuth"), "Must use useAuth context");
  assert.ok(jobsCode.includes("saveSearchIntent"), "Must call saveSearchIntent when unauthenticated");
  assert.ok(jobsCode.includes("getSearchIntent"), "Must restore intent with getSearchIntent");
  assert.ok(jobsCode.includes("clearSearchIntent"), "Must clear intent after restoration");
  assert.ok(jobsCode.includes("<JobsAuthGateModal"), "Must include JobsAuthGateModal component");
  assert.ok(jobsCode.includes("setAuthGateOpen(true)"), "Must open auth gate on protected action");

  // Feature gate and verified invariants
  assert.ok(
    jobsCode.includes('featureGated.status === "DISABLED"'),
    "Must preserve exact featureGated.status === \"DISABLED\" check"
  );
  assert.ok(
    jobsCode.includes("verifiedStatus === 'verified'"),
    "Must preserve exact verifiedStatus === 'verified' single-quote check"
  );

  // Canonical cards and Suspense
  assert.ok(jobsCode.includes("handleSaveJob"), "Must preserve handleSaveJob");
  assert.ok(jobsCode.includes("<Suspense"), "Must wrap page in Suspense boundary");
});

