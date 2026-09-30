import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildCareerSearchIntent,
  expandRoleAliases,
  expandLocationAliases,
  computeQueryFingerprint,
} from "../src/lib/career/career-search-intent.ts";

import {
  CareerSourcePlanner,
} from "../src/lib/career/career-source-planner.ts";

import {
  CanonicalJobDeduplicationEngine,
} from "../src/lib/career/career-dedupe-engine.ts";

import {
  CareerRelevanceEngine,
} from "../src/lib/career/career-relevance-engine.ts";

import {
  CareerSearchOrchestrator,
} from "../src/lib/career/career-search-orchestrator.ts";

import {
  LinkedInSourceConnector,
  NaukriApnaSourceConnector,
} from "../src/lib/career/career-source-connector.ts";

const ROOT = process.cwd();

// ============================================================================
// 1. EXACT ACCEPTANCE SCENARIO #101 & INTENT RESOLUTION
// ============================================================================

test("1. Acceptance Scenario #101: Zero-Text Search with Structured Requirements", async () => {
  // User enters NOTHING in the text search field.
  // Selects:
  // Role: Frontend Developer
  // Branch: Computer Science & Engineering (CSE)
  // Domain: Web & Mobile Development
  // Area: Any location
  // Opportunity Type: Any opportunity
  // Experience: Any experience
  // Work Mode: Any work mode
  const rawInput = {
    q: "", // Empty free text
    role: "Frontend Developer",
    branch: "Computer Science & Engineering (CSE)",
    domain: "Web & Mobile Development",
    location: "Any location",
    opportunityType: "Any opportunity",
    experience: "Any experience",
    workMode: "Any work mode",
  };

  const intent = buildCareerSearchIntent(rawInput);

  // Requirement 1 & 2: Search succeeds without "enter search query" error
  assert.equal(intent.isValid, true, "Search must be valid when requirements are selected");
  assert.equal(intent.validationMessage, undefined, "Zero validation error message when requirements provided");

  // Requirement 3: Intent is built from structured requirements
  assert.equal(intent.role?.label, "Frontend Developer");
  assert.equal(intent.branch?.label, "Computer Science & Engineering (CSE)");
  assert.equal(intent.domain?.label, "Web & Mobile Development");

  // Requirement 10, 11, 12, 13: "Any" means unrestricted (null)
  assert.equal(intent.location, null, "'Any location' must resolve to null (unrestricted)");
  assert.equal(intent.experience, null, "'Any experience' must resolve to null (unrestricted)");
  assert.equal(intent.workMode, null, "'Any work mode' must resolve to null (unrestricted)");
  assert.deepEqual(
    intent.opportunityTypes.slice().sort(),
    ["INTERNSHIP", "JOB", "TRAINING"],
    "'Any opportunity' must search all 3 opportunity types"
  );

  // Requirement 6: Bounded query expansion variants
  assert.ok(intent.expandedQueryVariants.length > 0, "Generates query variants for external sources");
  assert.ok(intent.expandedQueryVariants.length <= 4, "Variants must be bounded (<= 4)");

  // Execute orchestrator with this intent
  const result = await CareerSearchOrchestrator.search(rawInput);
  assert.ok(Array.isArray(result.items), "Search returns items array");
  assert.equal(typeof result.total, "number", "Search returns numeric total");
  assert.ok(result.sourcesSearched.length > 0, "Identifies sources searched");
});

test("2. Validation Guardrail: Empty search prompts user guidance", () => {
  const emptyIntent = buildCareerSearchIntent({
    q: "",
    role: "All Job Roles",
    location: "Any location",
    opportunityType: "Any opportunity",
    experience: "Any experience",
    workMode: "Any work mode",
  });

  assert.equal(emptyIntent.isValid, false, "Completely empty criteria must be invalid");
  assert.equal(
    emptyIntent.validationMessage,
    "Choose a role, opportunity type, location, domain, or enter a search."
  );
});

test("3. Bounded Query Expansion (Role, Domain, Location)", () => {
  // Role expansion
  const feVariants = expandRoleAliases("Frontend Developer");
  assert.ok(feVariants.includes("Frontend Developer"));
  assert.ok(feVariants.some((v) => v.toLowerCase().includes("engineer") || v.toLowerCase().includes("ui")));
  assert.ok(feVariants.length <= 4, "Role expansion bounded to at most 4 variants");

  // Location dual-naming expansion
  const blrVariants = expandLocationAliases("Bengaluru");
  assert.ok(blrVariants.includes("Bengaluru"));
  assert.ok(blrVariants.includes("Bangalore"));

  const belgaumVariants = expandLocationAliases("Belagavi");
  assert.ok(belgaumVariants.includes("Belagavi"));
  assert.ok(belgaumVariants.includes("Belgaum"));
});

// ============================================================================
// 2. DEDUPLICATION & SOURCE CONCURRENCY ENGINE
// ============================================================================

test("4. Multi-Source Deduplication & Canonical Key Generation", () => {
  // 3 identical listings from Google Jobs, Company Careers, and Greenhouse ATS
  const jobGoogle = {
    id: "gjob_1",
    canonicalId: "SAARVI-JOB-001",
    title: "Frontend Developer Intern",
    company: "Acme Corp",
    companyName: "Acme Corp",
    location: "Bengaluru",
    remoteType: "hybrid",
    remote: false,
    employmentType: "internship",
    opportunityType: "INTERNSHIP",
    experienceLevel: "fresher",
    salary: "₹ 25,000 / mo",
    description: "React and Next.js frontend internship.",
    skills: ["React", "JavaScript"],
    datePosted: "2026-09-25T00:00:00Z",
    applicationDeadline: "2026-10-30",
    sourceName: "Google Jobs",
    sourceUrl: "https://google.com/jobs/1",
    applyUrl: "https://acme.com/careers/apply/1",
    sourceJobId: "g_1",
    sourceKey: "google-jobs",
    sourceType: "SEARCH_PROVIDER",
    sourceAttribution: "Source: Google Jobs",
    verifiedStatus: "source_checked",
    verificationTier: "SOURCE_DISCOVERY",
    verificationState: "NOT_VERIFIED",
    isInternship: true,
    fetchedAt: "2026-09-25T00:00:00Z",
    sourceReferences: [
      {
        source: "Google Jobs",
        sourceJobId: "g_1",
        sourceUrl: "https://google.com/jobs/1",
        discoveredAt: "2026-09-25T00:00:00Z",
      },
    ],
  };

  const jobCompany = {
    ...jobGoogle,
    id: "comp_1",
    sourceName: "Company Careers",
    sourceKey: "ats-company-feeds",
    sourceType: "COMPANY_DIRECT",
    sourceJobId: "comp_1",
    sourceUrl: "https://acme.com/jobs/fe-intern",
    sourceReferences: [
      {
        source: "Company Careers",
        sourceJobId: "comp_1",
        sourceUrl: "https://acme.com/jobs/fe-intern",
        discoveredAt: "2026-09-26T00:00:00Z",
      },
    ],
  };

  const jobGreenhouse = {
    ...jobGoogle,
    id: "gh_1",
    sourceName: "Greenhouse",
    sourceKey: "ats-company-feeds",
    sourceType: "ATS_PUBLIC_API",
    sourceJobId: "gh_1",
    sourceUrl: "https://boards.greenhouse.io/acme/jobs/1",
    sourceReferences: [
      {
        source: "Greenhouse",
        sourceJobId: "gh_1",
        sourceUrl: "https://boards.greenhouse.io/acme/jobs/1",
        discoveredAt: "2026-09-26T00:00:00Z",
      },
    ],
  };

  const { uniqueJobs, duplicatesMergedCount } =
    CanonicalJobDeduplicationEngine.deduplicateAndMerge([jobGoogle, jobCompany, jobGreenhouse]);

  // Requirement 33: 3 identical listings merged into ONE canonical job
  assert.equal(uniqueJobs.length, 1, "Must collapse 3 identical source listings into exactly 1 canonical job");
  assert.equal(duplicatesMergedCount, 2, "Must record 2 duplicates merged");

  // Requirement 32: Canonical Saarvi Job ID format SAARVI-JOB-XXXXXXXX
  const merged = uniqueJobs[0];
  assert.ok(merged.canonicalId.startsWith("SAARVI-JOB-"), "Canonical ID must follow SAARVI-JOB-XXXXXXXX format");

  // Requirement 34: Preserves all 3 sourceReferences
  assert.equal(merged.sourceReferences.length, 3, "Must preserve references to all 3 contributing sources");
  const sourceNames = merged.sourceReferences.map((r) => r.source);
  assert.ok(sourceNames.includes("Google Jobs"));
  assert.ok(sourceNames.includes("Company Careers"));
  assert.ok(sourceNames.includes("Greenhouse"));
});

test("5. Freshness Lifecycle Evaluation", () => {
  // Fresh: <= 7 days
  const freshDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(CanonicalJobDeduplicationEngine.evaluateFreshness(freshDate), "FRESH");

  // Recent: 8 - 30 days
  const recentDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(CanonicalJobDeduplicationEngine.evaluateFreshness(recentDate), "RECENT");

  // Stale: > 30 days
  const staleDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(CanonicalJobDeduplicationEngine.evaluateFreshness(staleDate), "STALE");

  // Expired: past deadline
  const expiredDeadline = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(CanonicalJobDeduplicationEngine.evaluateFreshness(freshDate, expiredDeadline), "EXPIRED");
});

// ============================================================================
// 3. RELEVANCE RANKING & ZERO AI FABRICATION
// ============================================================================

test("6. Explainable Relevance Scoring & Zero Fake Match Percentages", () => {
  const intent = buildCareerSearchIntent({
    role: "Frontend Developer",
    domain: "Web & Mobile Development",
    location: "Bengaluru",
    skills: ["React"],
    opportunityType: "internship",
  });

  const matchingJob = {
    id: "job_match_1",
    canonicalId: "SAARVI-JOB-MATCH1",
    title: "Frontend Developer Intern",
    company: "Acme",
    companyName: "Acme",
    location: "Bengaluru",
    remoteType: "hybrid",
    remote: false,
    employmentType: "internship",
    opportunityType: "INTERNSHIP",
    experienceLevel: "fresher",
    salary: "₹ 20,000 / mo",
    description: "Seeking Frontend Developer with React expertise for Web & Mobile Development.",
    skills: ["React", "TypeScript"],
    datePosted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    applicationDeadline: "2026-11-01",
    sourceName: "Saarvi Verified",
    sourceUrl: "https://saarvi.in",
    applyUrl: "https://saarvi.in/apply",
    sourceJobId: "s1",
    sourceKey: "saarvi-db",
    sourceType: "ADMIN_IMPORT",
    sourceAttribution: "✓ Saarvi Verified",
    verifiedStatus: "verified",
    verificationTier: "SAARVI_VERIFIED",
    verificationState: "VERIFIED",
    isInternship: true,
    fetchedAt: new Date().toISOString(),
    sourceReferences: [],
  };

  const { score, matchReasons } = CareerRelevanceEngine.scoreJob(matchingJob, intent);

  assert.ok(score >= 80, "Strong match must receive high score");
  assert.ok(matchReasons.length > 0, "Must provide explainable match reasons");
  assert.ok(
    matchReasons.some((r) => r.includes("Frontend Developer")),
    "Matches role explainability"
  );
  assert.ok(
    matchReasons.some((r) => r.includes("Bengaluru")),
    "Matches location explainability"
  );
  assert.ok(
    matchReasons.some((r) => r.includes("React")),
    "Matches skill explainability"
  );
});

test("7. Missing Branch Metadata Does NOT Reject Relevant Opportunities", () => {
  const intent = buildCareerSearchIntent({
    role: "Frontend Developer",
    branch: "Computer Science & Engineering (CSE)",
  });

  // A job that does NOT mention CSE in description
  const jobWithoutBranchMention = {
    id: "job_no_branch_1",
    canonicalId: "SAARVI-JOB-NOBRANCH",
    title: "Junior Frontend Developer",
    company: "TechNova",
    companyName: "TechNova",
    location: "Remote",
    remoteType: "remote",
    remote: true,
    employmentType: "full-time",
    opportunityType: "JOB",
    experienceLevel: "fresher",
    salary: "₹ 6 LPA",
    description: "Build user interfaces with React and HTML/CSS. Open to all engineering graduates.",
    skills: ["React", "CSS"],
    datePosted: new Date().toISOString(),
    applicationDeadline: "Rolling admission",
    sourceName: "Company Careers",
    sourceUrl: "https://technova.com",
    applyUrl: "https://technova.com/apply",
    sourceJobId: "tn1",
    sourceKey: "ats-company-feeds",
    sourceType: "COMPANY_DIRECT",
    sourceAttribution: "Source: Company Careers",
    verifiedStatus: "source_checked",
    verificationTier: "SOURCE_DISCOVERY",
    verificationState: "NOT_VERIFIED",
    isInternship: false,
    fetchedAt: new Date().toISOString(),
    sourceReferences: [],
  };

  const { rankedJobs } = CareerRelevanceEngine.rankAndFilter([jobWithoutBranchMention], intent);

  assert.equal(
    rankedJobs.length,
    1,
    "Missing explicit branch mention must NOT reject a relevant job!"
  );
});

// ============================================================================
// 4. SOURCE PLANNER & ZERO UNAUTHORIZED SCRAPING
// ============================================================================

test("8. Source Planning Intelligence avoids blind queries", () => {
  // Scenario A: Training scope
  const trainingIntent = buildCareerSearchIntent({ opportunityType: "training" });
  const trainingPlan = CareerSourcePlanner.planSources(trainingIntent);
  const trainingKeys = trainingPlan.primaryConnectors.map((c) => c.sourceKey);
  assert.ok(trainingKeys.includes("training-programs"), "Training query includes training connector");
  assert.ok(!trainingKeys.includes("google-jobs"), "Training query does NOT query Google Jobs");

  // Scenario B: Job/Internship scope
  const jobIntent = buildCareerSearchIntent({ opportunityType: "job" });
  const jobPlan = CareerSourcePlanner.planSources(jobIntent);
  const jobKeys = jobPlan.primaryConnectors.map((c) => c.sourceKey);
  assert.ok(jobKeys.includes("saarvi-db"), "Job query includes Saarvi DB");
  assert.ok(!jobKeys.includes("training-programs"), "Job query does NOT query training connector");
});

test("9. Strict Anti-Scraping Invariant: LinkedIn and Naukri are OUTBOUND_ONLY", async () => {
  const linkedIn = new LinkedInSourceConnector();
  assert.equal(linkedIn.isEnabled, false, "LinkedIn connector must be disabled from scraping");
  const linkedInHealth = await linkedIn.healthCheck();
  assert.equal(linkedInHealth.status, "OUTBOUND_ONLY", "LinkedIn must be marked OUTBOUND_ONLY");

  const naukri = new NaukriApnaSourceConnector();
  assert.equal(naukri.isEnabled, false, "Naukri connector must be disabled from scraping");
  const naukriHealth = await naukri.healthCheck();
  assert.equal(naukriHealth.status, "NOT_CONNECTED", "Naukri must be marked NOT_CONNECTED");
});

// ============================================================================
// 5. ADMIN CONTROL CENTERS & PAGES INTEGRITY
// ============================================================================

test("10. Admin Career Sources & Intelligence pages exist and use real telemetry", () => {
  const sourcesPage = fs.readFileSync(
    path.join(ROOT, "src/app/admin/career-sources/page.tsx"),
    "utf8"
  );
  assert.ok(sourcesPage.includes("Career Sources Control Center"), "Must render sources control center");
  assert.ok(sourcesPage.includes("CareerSourcePlanner.getAllConnectors()"), "Must query registered connectors");
  assert.ok(sourcesPage.includes("rateLimitPerMin"), "Must display rate limit telemetry");

  const intelPage = fs.readFileSync(
    path.join(ROOT, "src/app/admin/career-intelligence/page.tsx"),
    "utf8"
  );
  assert.ok(intelPage.includes("Platform Career Intelligence"), "Must render career intelligence page");
  assert.ok(intelPage.includes("Multi-Source Deduplication Architecture"), "Must describe deduplication policy");
  assert.ok(intelPage.includes("jobRepository.getLiveVerifiedOpportunities"), "Must use real database metrics");
});
