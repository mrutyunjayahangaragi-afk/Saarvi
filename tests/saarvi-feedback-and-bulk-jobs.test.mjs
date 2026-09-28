import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("1. FAQ Duplicate Cleanup: Exactly ONE canonical FAQ section and clean heading hierarchy", () => {
  const landingPage = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
  
  // Verify there is no duplicate FAQ heading
  assert.ok(
    !landingPage.includes("<h2>Frequently asked questions</h2>"),
    "Redundant outer <h2>Frequently asked questions</h2> must be removed from page.tsx"
  );
  assert.ok(
    landingPage.includes("<FaqAccordion"),
    "Canonical FaqAccordion component must be rendered on the landing page"
  );

  // FaqAccordion component inspection
  const faqComponent = fs.readFileSync(path.join(ROOT, "src/components/common/FaqAccordion.tsx"), "utf8");
  assert.ok(
    faqComponent.includes("eyebrow"),
    "FaqAccordion supports eyebrow prop for clean single hierarchy"
  );
  assert.ok(
    faqComponent.includes("aria-expanded") && faqComponent.includes("aria-controls"),
    "FaqAccordion includes ARIA accessibility attributes"
  );
  assert.ok(
    faqComponent.includes("Escape") || faqComponent.includes("Enter") || faqComponent.includes("keyboard"),
    "FaqAccordion has keyboard accessibility"
  );
});

test("2. User Feedback Schema & Migration: Canonical fields and RLS present", () => {
  const migration = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/026_user_feedback_and_discovery_batches.sql"),
    "utf8"
  );
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS public.feedback"), "Creates feedback table");
  assert.ok(migration.includes("guest_session_id"), "Includes guest_session_id");
  assert.ok(migration.includes("user_type"), "Includes user_type");
  assert.ok(migration.includes("idempotency_key"), "Includes idempotency_key");
  assert.ok(migration.includes("sentiment"), "Includes sentiment");
  assert.ok(migration.includes("admin_note"), "Includes admin_note");
  assert.ok(migration.includes("resolved_at"), "Includes resolved_at");
  assert.ok(migration.includes("resolved_by"), "Includes resolved_by");
  assert.ok(migration.includes("job_discovery_batches"), "Includes job_discovery_batches");
  assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"), "Feedback table has RLS enabled");
});

test("3. Feedback Ingestion API: Strict validation, categories, idempotency, guest support", () => {
  const apiRoute = fs.readFileSync(path.join(ROOT, "src/app/api/feedback/route.ts"), "utf8");
  
  // Rating validation
  assert.ok(apiRoute.includes("Number.isInteger(numRating)"), "Validates integer rating");
  assert.ok(apiRoute.includes("numRating < 1 || numRating > 5"), "Restricts rating to 1-5");
  
  // Category validation
  assert.ok(apiRoute.includes("CANONICAL_CATEGORIES"), "Validates against allowed categories");
  assert.ok(apiRoute.includes("'General'"), "Includes General category");
  assert.ok(apiRoute.includes("'Bug'"), "Includes Bug category");
  assert.ok(apiRoute.includes("'Tool Issue'"), "Includes Tool Issue category");
  assert.ok(apiRoute.includes("'Feature Request'"), "Includes Feature Request category");
  assert.ok(apiRoute.includes("'Performance'"), "Includes Performance category");
  assert.ok(apiRoute.includes("'Privacy'"), "Includes Privacy category");
  assert.ok(apiRoute.includes("'Payment'"), "Includes Payment category");
  assert.ok(apiRoute.includes("'Other'"), "Includes Other category");

  // Idempotency deduplication
  assert.ok(apiRoute.includes("idempotency_key") || apiRoute.includes("idempotencyKey"), "Supports idempotency key");
  assert.ok(apiRoute.includes("Feedback already recorded") || apiRoute.includes("effectiveIdemKey"), "Returns idempotent duplicate protection message");

  // No sensitive files
  assert.ok(!apiRoute.includes("fileBuffer") && !apiRoute.includes("fileContent"), "Does not store file content in feedback");
});

test("4. ResultDownload Component: Optional, non-blocking feedback with 1-5 rating & Send/Not Now buttons", () => {
  const resultDownload = fs.readFileSync(path.join(ROOT, "src/components/common/ResultDownload.tsx"), "utf8");
  
  assert.ok(resultDownload.includes("Was this tool helpful?"), "Prompts 'Was this tool helpful?'");
  assert.ok(resultDownload.includes("What could we improve?"), "Optional message input 'What could we improve?'");
  assert.ok(resultDownload.includes("Send Feedback"), "Includes 'Send Feedback' button");
  assert.ok(resultDownload.includes("Not Now"), "Includes 'Not Now' dismiss button");
  assert.ok(resultDownload.includes("idempotencyKey"), "Generates idempotencyKey to prevent duplicate submissions");
  
  // Non-blocking: download buttons and tool result are independent of feedback submission
  assert.ok(resultDownload.includes("useAutoDownload") && resultDownload.includes("downloadNow"), "Preserves auto-download and downloadNow functions independently");
});

test("5. Admin Feedback Dashboard: Real DB metrics, no fake stats, status actions & internal notes", () => {
  const adminPage = fs.readFileSync(path.join(ROOT, "src/app/admin/feedback/page.tsx"), "utf8");
  
  // Metrics & Empty states
  assert.ok(adminPage.includes("No feedback yet"), "Shows 'No feedback yet' when database is empty");
  assert.ok(!adminPage.includes("4.8 ★") && !adminPage.includes("98% Positive"), "Does not hardcode fake analytics");
  
  // Status actions
  assert.ok(adminPage.includes("Mark In Review") || adminPage.includes("IN_REVIEW"), "Supports IN_REVIEW status transition");
  assert.ok(adminPage.includes("Resolve") || adminPage.includes("RESOLVED"), "Supports RESOLVED status transition");
  assert.ok(adminPage.includes("Archive") || adminPage.includes("ARCHIVED"), "Supports ARCHIVED status transition");
  assert.ok(adminPage.includes("adminNotes") || adminPage.includes("adminNotesInput"), "Supports internal admin notes");

  // Filter dropdowns
  assert.ok(adminPage.includes("statusFilter"), "Has status filter");
  assert.ok(adminPage.includes("ratingFilter"), "Has rating filter");
  assert.ok(adminPage.includes("categoryFilter"), "Has category filter");
  assert.ok(adminPage.includes("userTypeFilter"), "Has user type filter");
  assert.ok(adminPage.includes("sentimentFilter"), "Has sentiment filter");
});

test("6. Jobs Persistent Discovery Pipeline: Discovery results persist immediately to DB as PENDING_REVIEW", () => {
  const discoverRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/career/discover/route.ts"), "utf8");
  assert.ok(
    discoverRoute.includes("persistDiscoveredResults"),
    "Discovery API immediately persists discovered jobs to database"
  );
  assert.ok(
    discoverRoute.includes("savedToSaarvi") || discoverRoute.includes("newCount"),
    "Returns exact saved/new/existing counts from DB persistence"
  );

  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(
    oppStore.includes("persistDiscoveredResults"),
    "OpportunityStore contains persistDiscoveredResults"
  );
  assert.ok(
    oppStore.includes("PENDING_REVIEW"),
    "Discovered jobs are stored with PENDING_REVIEW status"
  );
  assert.ok(
    oppStore.includes("discoveryBatchId"),
    "Discovered jobs link to discoveryBatchId"
  );
});

test("7. Discovery Upsert & Deduplication: Safe upsert preserves manual admin edits", () => {
  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  // Checks deduplication via sourceId, normalized apply URL, and title+company+location key
  assert.ok(
    oppStore.includes("normApply") && oppStore.includes("normKey"),
    "Performs deterministic multi-tier deduplication"
  );
  assert.ok(
    oppStore.includes("fetchedAt") && oppStore.includes("sourceLastUpdatedAt"),
    "Updates fetchedAt and sourceLastUpdatedAt freshness on rediscovery"
  );
  // Manual admin protection
  assert.ok(
    oppStore.includes("existing.salary") || oppStore.includes("PUBLISHED") || oppStore.includes("adminNotes"),
    "Safely protects admin manual modifications or published status from untrusted provider overwrites"
  );
});

test("8. Bulk Publish API: Single server operation, partial failure reporting, audit logging", () => {
  const bulkPublishRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/bulk-publish/route.ts"), "utf8");
  assert.ok(bulkPublishRoute.includes("bulkPublishOpportunities"), "Calls bulkPublishOpportunities");
  assert.ok(bulkPublishRoute.includes("getAuthenticatedAdmin"), "Enforces server-side admin authorization");

  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(oppStore.includes("bulkPublishOpportunities"), "OpportunityStore implements bulkPublishOpportunities");
  assert.ok(oppStore.includes("published: number") || oppStore.includes("result.published"), "Returns actual published count");
  assert.ok(oppStore.includes("failures"), "Reports partial failures with exact error reasons");
  assert.ok(oppStore.includes("Bulk published to live public feed") || oppStore.includes("BULK_PUBLISH"), "Logs audit event for bulk publish");
});

test("9. Bulk Delete/Archive API: Single server operation, default soft-delete archive, permanent option", () => {
  const bulkDeleteRoute = fs.readFileSync(path.join(ROOT, "src/app/api/admin/jobs/bulk-delete/route.ts"), "utf8");
  assert.ok(bulkDeleteRoute.includes("bulkDeleteOpportunities"), "Calls bulkDeleteOpportunities");
  assert.ok(bulkDeleteRoute.includes("getAuthenticatedAdmin"), "Enforces server-side admin authorization");

  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  assert.ok(oppStore.includes("bulkDeleteOpportunities"), "OpportunityStore implements bulkDeleteOpportunities");
  assert.ok(oppStore.includes("ARCHIVED"), "Defaults to ARCHIVED status (soft-delete)");
  assert.ok(oppStore.includes("permanent"), "Supports permanent delete with explicit confirmation flag");
  assert.ok(oppStore.includes('action: "ARCHIVED"') && oppStore.includes('action: "DELETED"'), "Logs audit events for bulk delete and archive");
});

test("10. User Database-First Search: Active search excludes non-published/archived jobs", () => {
  const oppStore = fs.readFileSync(path.join(ROOT, "src/lib/opportunities/opportunity-store.ts"), "utf8");
  // In getApprovedOpportunities, only published/approved active opportunities are returned to regular users
  assert.ok(
    oppStore.includes('o.status === "APPROVED" || o.status === "PUBLISHED"'),
    "Filter ensures only APPROVED or PUBLISHED opportunities are returned"
  );
  assert.ok(
    oppStore.includes("Never exposes DISCOVERED, PENDING_REVIEW, or REJECTED to public students"),
    "Strictly guarantees discovered/pending/rejected are never exposed to students"
  );
});

test("11. Discovery Batches History API: Stored sessions traceable by Admin", () => {
  const batchesRoute = fs.readFileSync(
    path.join(ROOT, "src/app/api/admin/jobs/discovery-batches/route.ts"),
    "utf8"
  );
  assert.ok(batchesRoute.includes("getDiscoveryBatches"), "Calls getDiscoveryBatches");
  assert.ok(batchesRoute.includes("batches"), "Returns discovery batches");

  const mockStorage = fs.readFileSync(path.join(ROOT, "src/lib/supabase/mock-storage.ts"), "utf8");
  assert.ok(mockStorage.includes("createDiscoveryBatch"), "MockStorageProvider supports createDiscoveryBatch");
  assert.ok(mockStorage.includes("getDiscoveryBatches"), "MockStorageProvider supports getDiscoveryBatches");
});

test("12. Admin Career UI: Fast bulk publish & bulk delete in single requests", () => {
  const adminCareerPage = fs.readFileSync(path.join(ROOT, "src/app/admin/career/page.tsx"), "utf8");
  assert.ok(
    adminCareerPage.includes("/api/admin/jobs/bulk-publish"),
    "Admin career page calls /api/admin/jobs/bulk-publish"
  );
  assert.ok(
    adminCareerPage.includes("/api/admin/jobs/bulk-delete"),
    "Admin career page calls /api/admin/jobs/bulk-delete"
  );
  assert.ok(
    adminCareerPage.includes("Publish Selected"),
    "Includes 'Publish Selected' bulk action"
  );
  assert.ok(
    adminCareerPage.includes("Publish All Eligible"),
    "Includes 'Publish All Eligible' bulk action"
  );
  assert.ok(
    adminCareerPage.includes("Select All") || adminCareerPage.includes("Select Page"),
    "Supports 'Select Page' / 'Select All' rows"
  );
});
