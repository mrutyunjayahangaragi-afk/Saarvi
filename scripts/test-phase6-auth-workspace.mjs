import assert from 'node:assert';
import { MockStorageProvider } from '../src/lib/supabase/mock-storage.ts';
import { conversionHistoryService } from '../src/lib/services/conversionHistoryService.ts';
import { resumeService } from '../src/lib/services/resumeService.ts';
import { preferencesService } from '../src/lib/services/preferencesService.ts';

// Mock browser global localStorage & document.cookie in node environment
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};
globalThis.document = {
  cookie: '',
};

console.log("=========================================");
console.log("RUNNING DOCEASE PHASE 6 AUTH & WORKSPACE TESTS");
console.log("=========================================\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}\n`);
    failed++;
  }
}

// 1. Signup validation
await test("Signup: Creates user profile & active session", async () => {
  localStorage.clear();
  const res = MockStorageProvider.signUp({
    fullName: "Alice Johnson",
    email: "alice@example.com",
    password: "Password123!",
  });

  assert.strictEqual(res.user.email, "alice@example.com");
  assert.strictEqual(res.user.fullName, "Alice Johnson");
  assert.strictEqual(res.profile.role, "USER");

  const session = MockStorageProvider.getCurrentSession();
  assert.ok(session);
  assert.strictEqual(session.id, res.user.id);
});

// 2. Duplicate signup rejection
await test("Signup: Rejects duplicate email registration", async () => {
  assert.throws(
    () => {
      MockStorageProvider.signUp({
        fullName: "Alice Duplicate",
        email: "alice@example.com",
        password: "AnotherPassword123!",
      });
    },
    (err) => err.message.includes("already exists")
  );
});

// 3. Login success
await test("Login: Successfully authenticates valid credentials", async () => {
  MockStorageProvider.signOut();
  assert.strictEqual(MockStorageProvider.getCurrentSession(), null);

  const res = MockStorageProvider.signIn({
    email: "alice@example.com",
    password: "Password123!",
  });

  assert.strictEqual(res.user.email, "alice@example.com");
  const session = MockStorageProvider.getCurrentSession();
  assert.strictEqual(session.id, res.user.id);
});

// 4. Login failure (safe generic error)
await test("Login: Rejects invalid password with generic security message", async () => {
  assert.throws(
    () => {
      MockStorageProvider.signIn({
        email: "alice@example.com",
        password: "WrongPassword999",
      });
    },
    (err) => err.message.includes("couldn't sign you in")
  );
});

// 5. Logout
await test("Logout: Completely clears active session", async () => {
  MockStorageProvider.signOut();
  assert.strictEqual(MockStorageProvider.getCurrentSession(), null);
});

// 6. Conversion History Privacy: stores metadata ONLY, 0 bytes
await test("History Privacy: Stores operational metadata and zero file contents", async () => {
  const alice = MockStorageProvider.signIn({
    email: "alice@example.com",
    password: "Password123!",
  });

  const record = await conversionHistoryService.recordConversion({
    toolId: "jpg-to-pdf",
    toolName: "JPG to PDF",
    inputFilename: "lecture_photo.jpg",
    outputFilename: "lecture_notes.pdf",
    inputSize: 2048500,
    outputSize: 1540200,
    status: "Completed",
    processingTimeMs: 420,
  });

  assert.ok(record);
  assert.strictEqual(record.userId, alice.user.id);
  assert.strictEqual(record.toolId, "jpg-to-pdf");
  assert.strictEqual(record.inputSize, 2048500);
  assert.strictEqual(record.outputSize, 1540200);
  assert.strictEqual(record.processingTimeMs, 420);
  // Ensure NO blob or raw bytes were stored in the metadata record
  assert.strictEqual(record.blob, undefined);
  assert.strictEqual(record.fileBytes, undefined);
  assert.strictEqual(record.fileContent, undefined);
});

// 7. RLS Data Isolation: User B cannot access User A's history
await test("RLS Isolation: User A and User B conversion histories are strictly isolated", async () => {
  // Create User B
  const bob = MockStorageProvider.signUp({
    fullName: "Bob Smith",
    email: "bob@example.com",
    password: "BobPassword123!",
  });

  // User B records their own conversion
  await conversionHistoryService.recordConversion({
    toolId: "compress-pdf",
    toolName: "Compress PDF",
    inputFilename: "thesis.pdf",
    outputFilename: "thesis_compressed.pdf",
    inputSize: 5000000,
    outputSize: 2500000,
    status: "Completed",
    processingTimeMs: 850,
  });

  // Fetch history while signed in as Bob
  const bobHistory = await conversionHistoryService.getHistory();
  assert.strictEqual(bobHistory.length, 1);
  assert.strictEqual(bobHistory[0].toolId, "compress-pdf");
  assert.strictEqual(bobHistory[0].userId, bob.user.id);

  // Switch back to Alice
  MockStorageProvider.signIn({
    email: "alice@example.com",
    password: "Password123!",
  });

  const aliceHistory = await conversionHistoryService.getHistory();
  assert.strictEqual(aliceHistory.length, 1);
  assert.strictEqual(aliceHistory[0].toolId, "jpg-to-pdf");
  // Alice CANNOT see Bob's records
  assert.ok(!aliceHistory.some((r) => r.userId === bob.user.id));
});

// 8. Resumes CRUD & Isolation
await test("Resumes: Create, update, duplicate, and isolate drafts between users", async () => {
  // Alice creates a resume draft
  const draft = await resumeService.createResume("Alice Software Resume", "ats-classic", {
    personalInfo: { fullName: "Alice Johnson" },
  });
  assert.ok(draft);
  assert.strictEqual(draft.title, "Alice Software Resume");

  // Duplicate draft
  const dupe = await resumeService.duplicateResume(draft.id);
  assert.ok(dupe);
  assert.strictEqual(dupe.title, "Alice Software Resume (Copy)");

  // Rename draft
  const updated = await resumeService.updateResume(draft.id, { title: "Alice Lead Engineer 2026" });
  assert.strictEqual(updated.title, "Alice Lead Engineer 2026");

  // Check Alice sees 2 resumes
  const aliceResumes = await resumeService.getResumes();
  assert.strictEqual(aliceResumes.length, 2);

  // Switch to Bob: Bob should see 0 resumes
  const bob = MockStorageProvider.signIn({ email: "bob@example.com", password: "BobPassword123!" });
  const bobResumes = await resumeService.getResumes();
  assert.strictEqual(bobResumes.length, 0);

  // Bob attempts to modify Alice's resume directly -> Must throw / fail RLS check
  assert.throws(
    () => {
      MockStorageProvider.updateResume(bob.user.id, draft.id, { title: "Hacked by Bob" });
    },
    (err) => err.message.includes("unauthorized") || err.message.includes("not found")
  );
});

// 9. Preferences sync & isolation
await test("Preferences: Auto-download preference updates and persists", async () => {
  MockStorageProvider.signIn({ email: "alice@example.com", password: "Password123!" });
  await preferencesService.updatePreferences({ autoDownload: false });

  const prefs = await preferencesService.getPreferences();
  assert.strictEqual(prefs.autoDownload, false);
});

// 10. Account deletion cascade
await test("Account Deletion: Cascades and cleans profile, history, and resumes", async () => {
  const aliceSession = MockStorageProvider.getCurrentSession();
  assert.ok(aliceSession);

  MockStorageProvider.deleteAccount(aliceSession.id);

  // Session must be cleared
  assert.strictEqual(MockStorageProvider.getCurrentSession(), null);

  // Attempting to sign in with deleted account must fail
  assert.throws(
    () => {
      MockStorageProvider.signIn({ email: "alice@example.com", password: "Password123!" });
    },
    (err) => err.message.includes("couldn't sign you in")
  );

  // Alice's history and resumes must be completely deleted
  const remainingHistory = MockStorageProvider.getConversionHistory(aliceSession.id);
  assert.strictEqual(remainingHistory.length, 0);

  const remainingResumes = MockStorageProvider.getResumes(aliceSession.id);
  assert.strictEqual(remainingResumes.length, 0);
});

// 11. Guest Non-interference
await test("Guest Flow: Conversions complete without failure when unauthenticated", async () => {
  MockStorageProvider.signOut();
  assert.strictEqual(MockStorageProvider.getCurrentSession(), null);

  // Calling recordConversion as a guest must not throw and must return null gracefully
  const guestRecord = await conversionHistoryService.recordConversion({
    toolId: "merge-pdf",
    toolName: "Merge PDF",
    inputFilename: "2 files",
    outputFilename: "merged.pdf",
    inputSize: 1000,
    outputSize: 2000,
    status: "Completed",
    processingTimeMs: 150,
  });

  assert.strictEqual(guestRecord, null);
});

console.log(`\nResults: ${passed}/${passed + failed} tests passed.`);
if (failed > 0) {
  process.exit(1);
}
