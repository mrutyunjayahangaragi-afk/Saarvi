"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MapPin,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  ArrowRight,
  Info,
  Check,
} from "lucide-react";
import {
  InterviewPermissionState,
  PermissionCheckStatus,
  CandidatePrivacyMode,
  InterviewLocationCapture,
} from "@/types/interview";

interface InterviewPermissionGateProps {
  requireCamera?: boolean;
  requireMicrophone?: boolean;
  requireLocation?: boolean;
  requireScreenShare?: boolean;
  userEmailVerified?: boolean;
  userIsAuthenticated?: boolean;
  centerName?: string;
  onReadyToStart: (config: {
    privacyMode: CandidatePrivacyMode;
    permissionState: InterviewPermissionState;
    locationData?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  }) => void;
  onCancel?: () => void;
}

export default function InterviewPermissionGate({
  requireCamera = true,
  requireMicrophone = true,
  requireLocation = false,
  requireScreenShare = false,
  userEmailVerified = true,
  userIsAuthenticated = true,
  centerName,
  onReadyToStart,
  onCancel,
}: InterviewPermissionGateProps) {
  // Permission states
  const [permissions, setPermissions] = useState<InterviewPermissionState>({
    camera: "requested",
    microphone: "requested",
    location: requireLocation ? "requested" : "unavailable",
    screen: requireScreenShare ? "requested" : "unavailable",
    consent: "pending",
    browserSupported: true,
  });

  // Hardware & live preview refs
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Live indicators
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isCheckingCamera, setIsCheckingCamera] = useState(false);
  const [isCheckingMic, setIsCheckingMic] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [isCheckingScreen, setIsCheckingScreen] = useState(false);
  const [locationCoordinates, setLocationCoordinates] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  // Privacy & Consent
  const [privacyMode, setPrivacyMode] = useState<CandidatePrivacyMode>("FULL_VIDEO");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check browser API compatibility on mount
  useEffect(() => {
    const isSupported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia;

    if (!isSupported) {
      setPermissions((prev) => ({ ...prev, browserSupported: false }));
      setErrorMessage(
        "Your browser does not support modern WebRTC media APIs. Please use Chrome, Edge, Safari, or Firefox."
      );
    }
  }, []);

  // Cleanup media streams on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // 1. Camera Verification
  const verifyCamera = useCallback(async () => {
    if (!requireCamera) return;
    setIsCheckingCamera(true);
    setErrorMessage(null);
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setPermissions((prev) => ({ ...prev, camera: "granted" }));
    } catch (err: unknown) {
      const errName = (err as Error)?.name || "";
      const isDenied = errName === "NotAllowedError" || errName === "PermissionDeniedError";
      setPermissions((prev) => ({
        ...prev,
        camera: isDenied ? "denied" : "unavailable",
      }));
      setErrorMessage(
        isDenied
          ? "Camera permission was denied in your browser. Click the site settings or lock icon in the address bar to allow camera access."
          : "Camera hardware is unavailable or already in use by another application."
      );
    } finally {
      setIsCheckingCamera(false);
    }
  }, [requireCamera]);

  // 2. Microphone Verification with Live Audio Meter
  const verifyMicrophone = useCallback(async () => {
    if (!requireMicrophone) return;
    setIsCheckingMic(true);
    setErrorMessage(null);
    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Setup audio analyzer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          setMicLevel(normalized);
          animFrameRef.current = requestAnimationFrame(checkAudio);
        };
        checkAudio();
      }

      setPermissions((prev) => ({ ...prev, microphone: "granted" }));
    } catch (err: unknown) {
      const errName = (err as Error)?.name || "";
      const isDenied = errName === "NotAllowedError" || errName === "PermissionDeniedError";
      setPermissions((prev) => ({
        ...prev,
        microphone: isDenied ? "denied" : "unavailable",
      }));
      setErrorMessage(
        isDenied
          ? "Microphone access was denied. Please allow microphone permissions in your browser to proceed with voice checks."
          : "Microphone hardware was not detected or is blocked by system settings."
      );
    } finally {
      setIsCheckingMic(false);
    }
  }, [requireMicrophone]);

  // 3. Location Verification (Only when required by policy)
  const verifyLocation = useCallback(async () => {
    if (!requireLocation) return;
    setIsCheckingLocation(true);
    setErrorMessage(null);

    if (!navigator.geolocation) {
      setPermissions((prev) => ({ ...prev, location: "unavailable" }));
      setErrorMessage("Geolocation is not supported by your browser.");
      setIsCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationCoordinates({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setPermissions((prev) => ({ ...prev, location: "granted" }));
        setIsCheckingLocation(false);
      },
      (err) => {
        const isDenied = err.code === err.PERMISSION_DENIED;
        setPermissions((prev) => ({
          ...prev,
          location: isDenied ? "denied" : "unavailable",
        }));
        setErrorMessage(
          isDenied
            ? "Location permission was denied. The assessment center requires location verification to confirm on-premise attendance."
            : "Could not obtain location. Please ensure location services are enabled on your device."
        );
        setIsCheckingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [requireLocation]);

  // 4. Optional Screen-Share Verification
  const verifyScreenShare = useCallback(async () => {
    if (!requireScreenShare) return;
    setIsCheckingScreen(true);
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      // Immediately stop screen share test track
      stream.getTracks().forEach((track) => track.stop());
      setPermissions((prev) => ({ ...prev, screen: "granted" }));
    } catch (err: unknown) {
      setPermissions((prev) => ({ ...prev, screen: "denied" }));
      setErrorMessage("Screen share permission was cancelled or denied.");
    } finally {
      setIsCheckingScreen(false);
    }
  }, [requireScreenShare]);

  // Initial trigger for checks on mount
  useEffect(() => {
    if (permissions.browserSupported) {
      if (requireCamera && permissions.camera === "requested") verifyCamera();
      if (requireMicrophone && permissions.microphone === "requested") verifyMicrophone();
      if (requireLocation && permissions.location === "requested") verifyLocation();
      if (requireScreenShare && permissions.screen === "requested") verifyScreenShare();
    }
  }, [
    permissions.browserSupported,
    requireCamera,
    requireMicrophone,
    requireLocation,
    requireScreenShare,
    verifyCamera,
    verifyMicrophone,
    verifyLocation,
    verifyScreenShare,
  ]);

  // Check if all required prerequisites are satisfied
  const cameraOk = !requireCamera || permissions.camera === "granted";
  const micOk = !requireMicrophone || permissions.microphone === "granted";
  const locationOk = !requireLocation || permissions.location === "granted";
  const screenOk = !requireScreenShare || permissions.screen === "granted";
  const consentOk = termsAccepted;
  const authOk = userIsAuthenticated && userEmailVerified;

  const allChecksPassed =
    permissions.browserSupported &&
    cameraOk &&
    micOk &&
    locationOk &&
    screenOk &&
    consentOk &&
    authOk;

  const handleStartInterview = () => {
    if (!allChecksPassed) return;

    onReadyToStart({
      privacyMode,
      permissionState: {
        ...permissions,
        consent: "accepted",
      },
      locationData: locationCoordinates || undefined,
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Interview Readiness & Permission Gate</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Hardware, Device & Privacy Verification
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete the required device checks below before entering the active interview room.
          </p>
        </div>

        <span
          className={`self-start text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
            allChecksPassed
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {allChecksPassed ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ready to Enter</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Checks Incomplete</span>
            </>
          )}
        </span>
      </div>

      {/* Error alert if any permission is denied */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-red-900">Permission Action Required</p>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Verification Checklist Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Camera Card */}
        {requireCamera && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-800">Camera Check</span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  permissions.camera === "granted"
                    ? "bg-emerald-100 text-emerald-800"
                    : permissions.camera === "denied"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {permissions.camera === "granted"
                  ? "Connected"
                  : permissions.camera === "denied"
                  ? "Denied"
                  : "Checking..."}
              </span>
            </div>

            {/* Video Preview */}
            <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-300">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  privacyMode === "BLURRED_CANDIDATE_VIDEO" ? "filter blur-md" : ""
                }`}
              />
              {permissions.camera !== "granted" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 p-4 text-center">
                  <CameraOff className="w-6 h-6" />
                  <span>
                    {isCheckingCamera
                      ? "Requesting camera access..."
                      : "Camera not connected"}
                  </span>
                </div>
              )}
            </div>

            {permissions.camera !== "granted" && (
              <button
                type="button"
                onClick={verifyCamera}
                disabled={isCheckingCamera}
                className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {isCheckingCamera ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Try Camera Again</span>
              </button>
            )}
          </div>
        )}

        {/* 2. Microphone Card */}
        {requireMicrophone && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-800">Microphone & Audio</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    permissions.microphone === "granted"
                      ? "bg-emerald-100 text-emerald-800"
                      : permissions.microphone === "denied"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {permissions.microphone === "granted"
                    ? "Working"
                    : permissions.microphone === "denied"
                    ? "Denied"
                    : "Checking..."}
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Speak to test input audio levels. The green meter confirms sound detection.
              </p>

              {/* Audio Volume Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Input Signal:</span>
                  <span>{permissions.microphone === "granted" ? `${micLevel}%` : "0%"}</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            </div>

            {permissions.microphone !== "granted" && (
              <button
                type="button"
                onClick={verifyMicrophone}
                disabled={isCheckingMic}
                className="w-full min-h-[38px] mt-3 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {isCheckingMic ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Try Microphone Again</span>
              </button>
            )}
          </div>
        )}

        {/* 3. Location Card (Only when enabled by policy) */}
        {requireLocation && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">Assessment Center Location</span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  permissions.location === "granted"
                    ? "bg-emerald-100 text-emerald-800"
                    : permissions.location === "denied"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {permissions.location === "granted"
                  ? "Verified"
                  : permissions.location === "denied"
                  ? "Denied"
                  : "Checking..."}
              </span>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                Center Policy Notice:
              </p>
              <p className="text-[11px] leading-relaxed">
                {centerName
                  ? `Assigned to: ${centerName}. Location verification confirms attendance for proctored evaluation.`
                  : "Location verification is required by the interview policy to confirm regional compliance."}
              </p>
            </div>

            {locationCoordinates && (
              <p className="text-[10px] text-slate-500 font-mono">
                Coordinates: {locationCoordinates.latitude.toFixed(4)}°,{" "}
                {locationCoordinates.longitude.toFixed(4)}° (±{locationCoordinates.accuracy.toFixed(0)}m)
              </p>
            )}

            {permissions.location !== "granted" && (
              <button
                type="button"
                onClick={verifyLocation}
                disabled={isCheckingLocation}
                className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {isCheckingLocation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Verify Location</span>
              </button>
            )}
          </div>
        )}

        {/* 4. Screen-Share Card (If required) */}
        {requireScreenShare && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800">Screen Share Capability</span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  permissions.screen === "granted"
                    ? "bg-emerald-100 text-emerald-800"
                    : permissions.screen === "denied"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {permissions.screen === "granted"
                  ? "Supported"
                  : permissions.screen === "denied"
                  ? "Required"
                  : "Pending"}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Your interview policy specifies live screen sharing for technical walkthroughs.
            </p>

            {permissions.screen !== "granted" && (
              <button
                type="button"
                onClick={verifyScreenShare}
                disabled={isCheckingScreen}
                className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {isCheckingScreen ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Test Screen Share</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Candidate Video Privacy Mode Selection */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Candidate Video Privacy Mode
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">Privacy First</span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Choose how your video is displayed to interviewers during the session. We respect candidate privacy: zero emotion profiling, zero facial analysis, and zero secret recording.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setPrivacyMode("FULL_VIDEO")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              privacyMode === "FULL_VIDEO"
                ? "bg-white border-blue-600 shadow-xs ring-1 ring-blue-600"
                : "bg-white/60 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" /> Full Video
              </span>
              {privacyMode === "FULL_VIDEO" && (
                <Check className="w-3.5 h-3.5 text-blue-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Clear video displayed to verified interviewer.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPrivacyMode("BLURRED_CANDIDATE_VIDEO")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              privacyMode === "BLURRED_CANDIDATE_VIDEO"
                ? "bg-white border-blue-600 shadow-xs ring-1 ring-blue-600"
                : "bg-white/60 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-indigo-600" /> Blurred Video
              </span>
              {privacyMode === "BLURRED_CANDIDATE_VIDEO" && (
                <Check className="w-3.5 h-3.5 text-blue-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Deliberately blurred video to protect personal environment.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPrivacyMode("NO_CANDIDATE_VIDEO")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              privacyMode === "NO_CANDIDATE_VIDEO"
                ? "bg-white border-blue-600 shadow-xs ring-1 ring-blue-600"
                : "bg-white/60 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CameraOff className="w-3.5 h-3.5 text-slate-600" /> Audio Only
              </span>
              {privacyMode === "NO_CANDIDATE_VIDEO" && (
                <Check className="w-3.5 h-3.5 text-blue-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Video feed hidden after device readiness check.
            </p>
          </button>
        </div>
      </div>

      {/* Terms, Proctoring Policy & Consent */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="leading-relaxed">
            I agree to the <strong>Mock Interview Proctoring Guidelines</strong>: I understand that window blur and tab switching are monitored (4 warnings maximum before session termination), and all evaluation criteria are applied fairly without biometric profiling.
          </span>
        </label>
      </div>

      {/* Final Action Button */}
      <div className="flex items-center justify-between pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel & Return
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={handleStartInterview}
          disabled={!allChecksPassed}
          aria-label="Start Mock Interview"
          className={`min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${
            allChecksPassed
              ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          <span>Start Mock Interview</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
