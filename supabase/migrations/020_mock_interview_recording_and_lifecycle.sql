-- =============================================================================
-- SAARVI MIGRATION 020: MOCK INTERVIEW 2.0 RECORDING & SESSION LIFECYCLE
-- =============================================================================
-- Enhances interview_sessions and interview_settings for:
-- 1. Server-authoritative recording lifecycle & metadata
-- 2. Hardware readiness & safe device attribution
-- 3. Live session heartbeat & disconnection detection
-- 4. Private storage bucket configuration for secure recordings
-- =============================================================================

-- 1. EXTEND INTERVIEW SESSIONS WITH RECORDING & HARDWARE FIELDS
ALTER TABLE IF EXISTS public.interview_sessions
    ADD COLUMN IF NOT EXISTS camera_permission TEXT DEFAULT 'unrequested',
    ADD COLUMN IF NOT EXISTS microphone_permission TEXT DEFAULT 'unrequested',
    ADD COLUMN IF NOT EXISTS camera_device_label_safe TEXT,
    ADD COLUMN IF NOT EXISTS microphone_device_label_safe TEXT,
    ADD COLUMN IF NOT EXISTS camera_label TEXT,
    ADD COLUMN IF NOT EXISTS mic_label TEXT,
    ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS recording_consent BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS recording_status TEXT DEFAULT 'NOT_STARTED',
    ADD COLUMN IF NOT EXISTS recording_path TEXT,
    ADD COLUMN IF NOT EXISTS recording_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recording_size_bytes BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recording_file_size_bytes BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recording_mime_type TEXT,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS error_code TEXT,
    ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 2. CREATE INDEXES FOR FAST ADMIN LOOKUPS & METRICS
CREATE INDEX IF NOT EXISTS idx_interview_sessions_recording_status 
    ON public.interview_sessions(recording_status);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_heartbeat 
    ON public.interview_sessions(last_heartbeat_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_started_at 
    ON public.interview_sessions(started_at DESC);

-- 3. ENSURE SETTINGS SCHEMA SUPPORTS RECORDING POLICIES
-- Default settings JSON update
INSERT INTO public.interview_settings (key, value)
VALUES 
    ('general', jsonb_build_object(
        'defaultMcqTimeLimitSeconds', 60,
        'defaultVideoTimeLimitSeconds', 120,
        'maxProctoringWarnings', 4,
        'enableCameraDeviceCheck', true,
        'enableMicDeviceCheck', true,
        'cameraRequired', false,
        'microphoneRequired', false,
        'recordingEnabled', true,
        'recordingRequired', false,
        'audioOnlyAllowed', true,
        'textOnlyAllowed', true,
        'recordingRetentionDays', 30,
        'tabSwitchPolicy', 'warning',
        'maxUploadSizeBytes', 104857600,
        'maxSessionDurationMinutes', 60,
        'enableAiTtsFallback', true
    ))
ON CONFLICT (key) DO UPDATE SET 
    value = public.interview_settings.value || EXCLUDED.value,
    updated_at = NOW();

-- 4. PRIVATE RECORDINGS STORAGE BUCKET POLICIES (CONCEPTUAL SQL)
-- Note: Bucket 'mock-interviews' is private (public = false).
-- Access is strictly managed via server-generated signed URLs.
