import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Saarvi Mock Interview 2.0 — Admin Control Center, Live Session, Media Preflight & Recording Suite", () => {
  const rootDir = process.cwd();

  // =========================================================================
  // 1. Migration 020 & Database Schema
  // =========================================================================
  test("Requirement 1: Migration 020 establishes recording metadata, hardware readiness, and heartbeat columns", () => {
    const migrationPath = path.join(rootDir, "supabase/migrations/020_mock_interview_recording_and_lifecycle.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 020 must exist");

    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("recording_status"), "Must add recording_status column");
    assert.ok(sql.includes("recording_storage_path"), "Must add recording_storage_path column");
    assert.ok(sql.includes("recording_file_size_bytes"), "Must add recording_file_size_bytes column");
    assert.ok(sql.includes("recording_duration_seconds"), "Must add recording_duration_seconds column");
    assert.ok(sql.includes("recording_consent"), "Must add recording_consent column");
    assert.ok(sql.includes("camera_label"), "Must add camera_label column");
    assert.ok(sql.includes("mic_label"), "Must add mic_label column");
    assert.ok(sql.includes("last_heartbeat_at"), "Must add last_heartbeat_at column");
    assert.ok(sql.includes("mock-interviews"), "Must reference mock-interviews storage bucket");
  });

  // =========================================================================
  // 2. Domain Types & State Machines
  // =========================================================================
  test("Requirement 2: Core Domain Types support recording status and extended lifecycle states", () => {
    const typesPath = path.join(rootDir, "src/types/interview.ts");
    assert.ok(fs.existsSync(typesPath), "src/types/interview.ts must exist");

    const code = fs.readFileSync(typesPath, "utf8");
    assert.ok(code.includes("RecordingStatus"), "Must export RecordingStatus type");
    assert.ok(code.includes("READY"), "RecordingStatus must support READY");
    assert.ok(code.includes("RECORDING"), "RecordingStatus must support RECORDING");
    assert.ok(code.includes("DELETED"), "RecordingStatus must support DELETED");
    assert.ok(code.includes("PermissionStateDetailed"), "Must export PermissionStateDetailed");
    assert.ok(code.includes("recordingPolicy"), "InterviewSettings must support recordingPolicy");
    assert.ok(code.includes("recordingRetentionDays"), "InterviewSettings must support recordingRetentionDays");
    assert.ok(code.includes("cameraLabel"), "InterviewSession must support cameraLabel");
    assert.ok(code.includes("micLabel"), "InterviewSession must support micLabel");
  });

  // =========================================================================
  // 3. Preflight Media Gate & Recording Consent Dual CTAs
  // =========================================================================
  test("Requirement 3: InterviewPermissionGate provides preflight setup, Web Audio analysis, and Dual CTAs", () => {
    const gatePath = path.join(rootDir, "src/components/interview/InterviewPermissionGate.tsx");
    assert.ok(fs.existsSync(gatePath), "InterviewPermissionGate.tsx must exist");

    const code = fs.readFileSync(gatePath, "utf8");
    assert.ok(code.includes("getUserMedia"), "Must call getUserMedia API");
    assert.ok(code.includes("AudioContext"), "Must set up AudioContext analyzer");
    assert.ok(code.includes("recordingPolicy"), "Must accept recordingPolicy prop");
    assert.ok(code.includes("Allow camera & microphone"), "Must display Allow camera & microphone on preflight screen");
    assert.ok(code.includes("Start Interview & Recording"), "Must have Start Interview & Recording CTA");
    assert.ok(code.includes("Start Interview Without Recording"), "Must have Start Interview Without Recording CTA");
    assert.ok(code.includes("stopAllMediaTracks"), "Must implement clean track stopping helper");
  });

  // =========================================================================
  // 4. Video Player & Playback Control
  // =========================================================================
  test("Requirement 4: InterviewVideoPlayer provides custom controls, playback rate, and signed link renewal", () => {
    const playerPath = path.join(rootDir, "src/components/interview/InterviewVideoPlayer.tsx");
    assert.ok(fs.existsSync(playerPath), "InterviewVideoPlayer.tsx must exist");

    const code = fs.readFileSync(playerPath, "utf8");
    assert.ok(code.includes("togglePlay"), "Must implement play/pause control");
    assert.ok(code.includes("playbackRate"), "Must support playback speed adjustment");
    assert.ok(code.includes("onRefreshPlaybackUrl"), "Must support signed token renewal");
    assert.ok(code.includes("formatTime"), "Must format playback time mm:ss");
    assert.ok(code.includes("formatBytes"), "Must display human readable recording size");
  });

  // =========================================================================
  // 5. Recording Upload & Playback Endpoints
  // =========================================================================
  test("Requirement 5: Recording endpoints handle upload validation, secure storage, and signed URLs", () => {
    const uploadPath = path.join(rootDir, "src/app/api/interview/recording/upload/route.ts");
    const playbackPath = path.join(rootDir, "src/app/api/interview/recording/playback/route.ts");
    assert.ok(fs.existsSync(uploadPath), "upload API route must exist");
    assert.ok(fs.existsSync(playbackPath), "playback API route must exist");

    const uploadCode = fs.readFileSync(uploadPath, "utf8");
    assert.ok(uploadCode.includes("mock-interviews"), "Must store in mock-interviews bucket");
    assert.ok(uploadCode.includes("500 * 1024 * 1024"), "Must validate 500MB size limit");
    assert.ok(uploadCode.includes("finalizeRecording"), "Must call finalizeRecording");

    const playbackCode = fs.readFileSync(playbackPath, "utf8");
    assert.ok(playbackCode.includes("getRecordingPlaybackUrl"), "Must call getRecordingPlaybackUrl");
    assert.ok(playbackCode.includes("deleteRecording"), "Must support deleteRecording");
  });

  // =========================================================================
  // 6. Admin Control Center & Detailed Audit Page
  // =========================================================================
  test("Requirement 6: Admin Mock Interview Control Center provides Overview, Recordings, and live polling", () => {
    const adminPath = path.join(rootDir, "src/app/admin/mock-interview/page.tsx");
    const detailPath = path.join(rootDir, "src/app/admin/mock-interview/[sessionId]/page.tsx");
    assert.ok(fs.existsSync(adminPath), "Admin mock interview page must exist");
    assert.ok(fs.existsSync(detailPath), "Admin session detail page must exist");

    const adminCode = fs.readFileSync(adminPath, "utf8");
    assert.ok(adminCode.includes("Overview & Sessions") || adminCode.includes("OVERVIEW"), "Must have Overview tab");
    assert.ok(adminCode.includes("Live Interviews"), "Must preserve Live Interviews tab");
    assert.ok(adminCode.includes("Recordings"), "Must have Recordings tab");
    assert.ok(adminCode.includes("Question Bank"), "Must preserve Question Bank tab");
    assert.ok(adminCode.includes("Question Analytics"), "Must preserve Question Analytics tab");
    assert.ok(adminCode.includes("Assessment Centers"), "Must preserve Assessment Centers tab");
    assert.ok(adminCode.includes("Live Polling (10s)"), "Must support live polling toggle");

    const detailCode = fs.readFileSync(detailPath, "utf8");
    assert.ok(detailCode.includes("InterviewVideoPlayer"), "Must embed InterviewVideoPlayer in audit page");
    assert.ok(detailCode.includes("Proctoring Audit Log"), "Must display proctoring log in audit page");
  });

  // =========================================================================
  // 7. Canonical User Route & Student History
  // =========================================================================
  test("Requirement 7: Canonical /mock-interview and /student/interviews/history are available", () => {
    const userRoute = path.join(rootDir, "src/app/mock-interview/page.tsx");
    const historyRoute = path.join(rootDir, "src/app/student/interviews/history/page.tsx");
    assert.ok(fs.existsSync(userRoute), "/mock-interview route must exist");
    assert.ok(fs.existsSync(historyRoute), "/student/interviews/history route must exist");

    const historyCode = fs.readFileSync(historyRoute, "utf8");
    assert.ok(historyCode.includes("InterviewVideoPlayer"), "History must support video playback");
    assert.ok(historyCode.includes("Watch Recording"), "History must offer Watch Recording button");
  });

  // =========================================================================
  // 8. SerpApi Integration Consistency
  // =========================================================================
  test("Requirement 8: SerpApi adapter and provider support SERPAPI_API_KEY and next_page_token", () => {
    const providerPath = path.join(rootDir, "src/lib/jobs/providers/serpapi.ts");
    const adapterPath = path.join(rootDir, "src/lib/opportunities/adapters/serpapi-jobs-adapter.ts");
    assert.ok(fs.existsSync(providerPath), "serpapi provider must exist");
    assert.ok(fs.existsSync(adapterPath), "serpapi adapter must exist");

    const providerCode = fs.readFileSync(providerPath, "utf8");
    assert.ok(providerCode.includes("SERPAPI_API_KEY"), "Provider must check SERPAPI_API_KEY");
    assert.ok(providerCode.includes("next_page_token"), "Provider must support next_page_token pagination");

    const adapterCode = fs.readFileSync(adapterPath, "utf8");
    assert.ok(adapterCode.includes("SERPAPI_API_KEY"), "Adapter must check SERPAPI_API_KEY");
    assert.ok(adapterCode.includes("next_page_token"), "Adapter must support next_page_token pagination");
  });
});
