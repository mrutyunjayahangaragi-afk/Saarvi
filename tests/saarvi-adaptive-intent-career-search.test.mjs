import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

test("1. No Text Query Search: Requirement-First Search Intent Formation", async () => {
  const { CareerFilterDependencyEngine } = await import("../src/lib/career/career-dependency-engine.ts");
  
  // Test Internship + Frontend Developer without any text query
  const intent1 = CareerFilterDependencyEngine.buildSearchIntent({
    opportunityType: "internship",
    role: "frontend-developer",
    branch: "cse",
    domain: "web-development",
    location: "bengaluru",
    query: "" // No text query
  });

  assert.equal(intent1.isValid, true, "Structured requirements without text query form valid intent");
  assert.deepEqual(intent1.opportunityTypes, ["INTERNSHIP"]);
  assert.equal(intent1.role, "frontend-developer");
  assert.equal(intent1.branch, "cse");
  assert.equal(intent1.domain, "web-development");
  assert.equal(intent1.location, "bengaluru");
  assert.equal(intent1.sourceQuery, "Frontend Developer Internship", "Constructs intelligent source query, not raw 'internship' keyword");

  // Test Opportunity Type alone is valid search intent
  const intent2 = CareerFilterDependencyEngine.buildSearchIntent({
    opportunityType: "internship",
    query: ""
  });
  assert.equal(intent2.isValid, true, "Opportunity Type alone constitutes a valid search intent");
  assert.deepEqual(intent2.opportunityTypes, ["INTERNSHIP"]);

  // Test Single structured requirement without opportunity type is valid
  const intent3 = CareerFilterDependencyEngine.buildSearchIntent({
    branch: "cse",
    domain: "software-saas",
    query: ""
  });
  assert.equal(intent3.isValid, true, "Branch + Domain alone constitutes a valid search intent");
});

test("2. Initial State & Adaptive Context Headings and Placeholders", async () => {
  const { CareerFilterDependencyEngine } = await import("../src/lib/career/career-dependency-engine.ts");

  // Initial unselected state
  const initial = CareerFilterDependencyEngine.getContextualHeadings("");
  assert.equal(initial.headline, "What are you looking for?");
  assert.equal(initial.typePlaceholder, "Choose an opportunity type");
  assert.equal(initial.searchPlaceholder, "Search jobs, internships, and training (or select requirements below)...");

  // Job selected state
  const jobState = CareerFilterDependencyEngine.getContextualHeadings("job");
  assert.equal(jobState.headline, "Find a job that fits");
  assert.equal(jobState.searchPlaceholder, "Search by role, skill, company, or keyword...");

  // Internship selected state
  const internState = CareerFilterDependencyEngine.getContextualHeadings("internship");
  assert.equal(internState.headline, "Find an internship that fits");
  assert.equal(internState.searchPlaceholder, "Search by role, skill, company, or keyword...");

  // Training selected state
  const trainState = CareerFilterDependencyEngine.getContextualHeadings("training");
  assert.ok(trainState.headline.toLowerCase().includes("training"), "Headline matches training context");
});

test("3. Search Button Invariant: Choose Requirements vs Search Opportunities", async () => {
  const { CareerFilterDependencyEngine } = await import("../src/lib/career/career-dependency-engine.ts");

  // Before any selection: disabled with "Choose requirements"
  const beforeSelection = CareerFilterDependencyEngine.getSearchButtonLabel({
    opportunityType: "",
    hasStructuredRequirements: false,
    liveCount: 0
  });
  assert.equal(beforeSelection.label, "Choose requirements");
  assert.equal(beforeSelection.enabled, false);

  // After Opportunity Type is selected: enabled with "Search Opportunities"
  const afterSelection = CareerFilterDependencyEngine.getSearchButtonLabel({
    opportunityType: "internship",
    hasStructuredRequirements: true,
    liveCount: 0
  });
  assert.equal(afterSelection.label, "Search Opportunities");
  assert.equal(afterSelection.enabled, true);

  // With real indexed count: "Search 128 opportunities"
  const withCount = CareerFilterDependencyEngine.getSearchButtonLabel({
    opportunityType: "job",
    hasStructuredRequirements: true,
    liveCount: 128
  });
  assert.equal(withCount.label, "Search 128 opportunities");
  assert.equal(withCount.enabled, true);
});

test("4. Progressive Disclosure & Canonical Filter Dependency Engine", async () => {
  const { CareerFilterDependencyEngine } = await import("../src/lib/career/career-dependency-engine.ts");

  // Job context: contextual filters must include salary, employmentType, company; MUST NOT include duration, stipend, fee
  const jobFilters = CareerFilterDependencyEngine.getFiltersForOpportunity("job");
  const jobFilterKeys = jobFilters.map(f => f.key);
  assert.ok(jobFilterKeys.includes("salary"), "Job includes salary");
  assert.ok(jobFilterKeys.includes("employmentType"), "Job includes employmentType");
  assert.ok(jobFilterKeys.includes("company"), "Job includes company");
  assert.ok(!jobFilterKeys.includes("duration"), "Job excludes duration");
  assert.ok(!jobFilterKeys.includes("stipend"), "Job excludes stipend");
  assert.ok(!jobFilterKeys.includes("feeType"), "Job excludes feeType");

  // Internship context: contextual filters must include duration, stipend, eligibility, startDate; MUST NOT include salary
  const internFilters = CareerFilterDependencyEngine.getFiltersForOpportunity("internship");
  const internFilterKeys = internFilters.map(f => f.key);
  assert.ok(internFilterKeys.includes("duration"), "Internship includes duration");
  assert.ok(internFilterKeys.includes("stipend"), "Internship includes stipend");
  assert.ok(internFilterKeys.includes("eligibility"), "Internship includes eligibility");
  assert.ok(internFilterKeys.includes("startDate"), "Internship includes startDate");
  assert.ok(!internFilterKeys.includes("salary"), "Internship excludes salary");

  // Training context: contextual filters must include deliveryMode, feeType, certificate, provider; MUST NOT include stipend or salary
  const trainFilters = CareerFilterDependencyEngine.getFiltersForOpportunity("training");
  const trainFilterKeys = trainFilters.map(f => f.key);
  assert.ok(trainFilterKeys.includes("deliveryMode"), "Training includes deliveryMode");
  assert.ok(trainFilterKeys.includes("feeType"), "Training includes feeType");
  assert.ok(trainFilterKeys.includes("certificate"), "Training includes certificate");
  assert.ok(trainFilterKeys.includes("provider"), "Training includes provider");
  assert.ok(!trainFilterKeys.includes("stipend"), "Training excludes stipend");
  assert.ok(!trainFilterKeys.includes("salary"), "Training excludes salary");

  // Any opportunity: shows shared filters only
  const anyFilters = CareerFilterDependencyEngine.getFiltersForOpportunity("any");
  const anyFilterKeys = anyFilters.map(f => f.key);
  assert.ok(anyFilterKeys.includes("role"), "Any includes role");
  assert.ok(anyFilterKeys.includes("branch"), "Any includes branch");
  assert.ok(anyFilterKeys.includes("domain"), "Any includes domain");
  assert.ok(anyFilterKeys.includes("location"), "Any includes location");
  assert.ok(!anyFilterKeys.includes("salary"), "Any excludes salary");
  assert.ok(!anyFilterKeys.includes("stipend"), "Any excludes stipend");
  assert.ok(!anyFilterKeys.includes("feeType"), "Any excludes feeType");
});

test("5. Admin Control: Dynamic Overrides for Filters Without Code Changes", async () => {
  const { CareerFilterDependencyEngine } = await import("../src/lib/career/career-dependency-engine.ts");

  // Admin disables salary for Job
  CareerFilterDependencyEngine.setFilterOverride("salary", { enabled: false });
  let jobFilters = CareerFilterDependencyEngine.getFiltersForOpportunity("job");
  assert.ok(!jobFilters.map(f => f.key).includes("salary"), "Disabled salary filter disappears dynamically");

  // Admin re-enables salary
  CareerFilterDependencyEngine.resetFilterOverrides();
  jobFilters = CareerFilterDependencyEngine.getFiltersForOpportunity("job");
  assert.ok(jobFilters.map(f => f.key).includes("salary"), "Reset restores salary filter");
});

test("6. Applied Filters UX: Never display default/any chips", () => {
  const jobsCode = fs.readFileSync(path.join(ROOT, "src/app/jobs/page.tsx"), "utf8");

  // Ensure default/any chips are strictly excluded
  assert.ok(
    jobsCode.includes('selectedLocation !== "all" && selectedLocation !== "any-location"'),
    "Location chip excludes all default/any sentinel values"
  );
  assert.ok(
    jobsCode.includes('selectedExperience !== "all" && selectedExperience !== "any"'),
    "Refinement chips exclude generic any values"
  );
  assert.ok(
    jobsCode.includes("resultsStreamHeading"),
    "Dynamic results stream heading is bound to main view"
  );
});
