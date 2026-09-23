import { NextRequest, NextResponse } from "next/server";
import { interviewService } from "@/lib/services/interviewService";
import { getAuthenticatedNotificationUser } from "@/lib/notifications/auth-helper";
import { getSupabaseAdminClient, ensureStorageBucket } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Private storage bucket for mock interview recordings
const BUCKET_NAME = "mock-interviews";

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  "video/webm",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/mp4",
  "video/quicktime",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
]);

// 500 MB maximum upload limit
const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedNotificationUser(req);
    const rateLimit = enforceRateLimit(req, "interviewSession", user?.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const formData = await req.formData();
    const sessionId = formData.get("sessionId") as string | null;
    const file = formData.get("file") as File | null;
    const durationSeconds = Number(formData.get("durationSeconds") || 0);

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Recording file payload is required." },
        { status: 400 }
      );
    }

    // Validate Session
    const session = await interviewService.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Interview session not found." },
        { status: 404 }
      );
    }

    // Authorization: User must be candidate or admin
    let userRole = "STUDENT";
    if (user && isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role) userRole = profile.role;
      } catch {}
    }

    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
    if (user && session.userId !== "guest" && session.userId !== user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You do not have permission to upload recordings for this session." },
        { status: 403 }
      );
    }

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `Recording file exceeds max allowable size of 500MB (received ${(file.size / (1024 * 1024)).toFixed(1)}MB).` },
        { status: 413 }
      );
    }

    // Validate MIME type
    const mimeType = file.type || "video/webm";
    const baseMime = mimeType.split(";")[0].toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType) && !ALLOWED_MIME_TYPES.has(baseMime)) {
      return NextResponse.json(
        { success: false, error: `Unsupported recording MIME type: ${mimeType}. WebM or MP4 is required.` },
        { status: 415 }
      );
    }

    // Extension inference
    let ext = "webm";
    if (mimeType.includes("mp4")) ext = "mp4";
    else if (mimeType.includes("ogg")) ext = "ogg";

    const storagePath = `${sessionId}/recording_${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (isSupabaseConfigured()) {
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        // Ensure private bucket exists
        await ensureStorageBucket(BUCKET_NAME, { isPublic: false });

        const { error: uploadError } = await adminClient.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error("[Storage Upload Error]:", uploadError);
          await interviewService.markRecordingFailed(
            sessionId,
            uploadError.message || "Storage upload failure."
          );
          return NextResponse.json(
            { success: false, error: "Failed to store interview recording in secure storage." },
            { status: 500 }
          );
        }
      }
    }

    // Finalize recording metadata in domain layer & database
    const updatedSession = await interviewService.finalizeRecording(
      sessionId,
      storagePath,
      file.size,
      durationSeconds,
      mimeType
    );

    const response = NextResponse.json({
      success: true,
      recordingStatus: "READY",
      storagePath,
      fileSizeBytes: file.size,
      durationSeconds,
      session: updatedSession,
    });
    return withRateLimitHeaders(response, rateLimit);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal recording upload error.";
    console.error("[Recording Upload Handler Error]:", err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
