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
  Settings2,
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
  allowAudioFallback?: boolean;
  allowTextFallback?: boolean;
  onSwitchToTextMode?: () => void;
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
  allowAudioFallback = true,
  allowTextFallback = true,
  onSwitchToTextMode,
  onReadyToStart,
  onCancel,
}: InterviewPermissionGateProps) {
  // Preflight setup initiation state
  const [setupStarted, setSetupStarted] = useState(false);

  // Secure context detection (navigator.mediaDevices requires HTTPS or localhost)
  const [isSecureContext, setIsSecureContext] = useState(true);

  // Available devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedMicId, setSelectedMicId] = useState<string>("");

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
  const [isSimulatedMode, setIsSimulatedMode] = useState(false);
  const [locationCoordinates, setLocationCoordinates] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  // Privacy & Consent
  const [privacyMode, setPrivacyMode] = useState<CandidatePrivacyMode>("FULL_VIDEO");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Comprehensive hardware stream cleanup helper
  const stopAllMediaTracks = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  }, []);

  // Cleanup media streams on unmount
  useEffect(() => {
    return () => {
      stopAllMediaTracks();
    };
  }, [stopAllMediaTracks]);

  // Check browser API compatibility and secure context on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const secure = window.isSecureContext ?? true;
      setIsSecureContext(secure);

      const isSupported =
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        !!navigator.mediaDevices.getUserMedia;

      if (!isSupported) {
        setPermissions((prev) => ({ ...prev, browserSupported: false }));
        setErrorMessage(
          secure
            ? "Your browser does not support modern WebRTC media APIs. Please use Chrome, Edge, Safari, or Firefox."
            : "Media capture is blocked by your browser because this page is not served over a secure connection (HTTPS or localhost)."
        );
      }
    }
  }, []);

  // Enumerate connected hardware devices
  const enumerateConnectedDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      setVideoDevices(cams);
      setAudioDevices(mics);

      if (cams.length > 0 && !selectedCameraId) {
        setSelectedCameraId(cams[0].deviceId);
      }
      if (mics.length > 0 && !selectedMicId) {
        setSelectedMicId(mics[0].deviceId);
      }
    } catch (e) {
      console.warn("[Device Enumeration Notice]:", e);
    }
  }, [selectedCameraId, selectedMicId]);

  // Enable simulated practice hardware (for devices without camera/mic or restricted browser permissions)
  const handleEnableSimulatedHardware = useCallback(() => {
    setIsSimulatedMode(true);
    setErrorMessage(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Saarvi Candidate Video Feed", 320, 220);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("Simulated Practice Media Active", 320, 260);
      }
      const stream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
      if (stream && videoPreviewRef.current) {
        cameraStreamRef.current = stream;
        videoPreviewRef.current.srcObject = stream;
      }
    } catch {}

    setMicLevel(68);
    setPermissions((prev) => ({
      ...prev,
      camera: "granted",
      microphone: "granted",
    }));
  }, []);

  // 1. Camera Verification with device switching support
  const verifyCamera = useCallback(
    async (overrideDeviceId?: string) => {
      if (!requireCamera) return;
      setIsCheckingCamera(true);
      setErrorMessage(null);
      try {
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop());
          cameraStreamRef.current = null;
        }

        const deviceConstraint = overrideDeviceId || selectedCameraId;
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          ...(deviceConstraint ? { deviceId: { exact: deviceConstraint } } : {}),
        };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
        });

        cameraStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }

        setPermissions((prev) => ({ ...prev, camera: "granted" }));
        await enumerateConnectedDevices();
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
    },
    [requireCamera, selectedCameraId, enumerateConnectedDevices]
  );

  // 2. Microphone Verification with Live Audio Meter & device switching
  const verifyMicrophone = useCallback(
    async (overrideDeviceId?: string) => {
      if (!requireMicrophone) return;
      setIsCheckingMic(true);
      setErrorMessage(null);
      try {
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }

        const deviceConstraint = overrideDeviceId || selectedMicId;
        const audioConstraints = deviceConstraint ? { deviceId: { exact: deviceConstraint } } : true;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        micStreamRef.current = stream;

        // Setup real Web Audio analyzer
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
            if (!analyser) return;
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
        await enumerateConnectedDevices();
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
    },
    [requireMicrophone, selectedMicId, enumerateConnectedDevices]
  );

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

  // User-gesture triggered verification
  const handleEnableHardware = async () => {
    setSetupStarted(true);
    if (requireCamera && permissions.camera !== "granted") {
      await verifyCamera();
    }
    if (requireMicrophone && permissions.microphone !== "granted") {
      await verifyMicrophone();
    }
    if (requireLocation && permissions.location !== "granted") {
      await verifyLocation();
    }
    if (requireScreenShare && permissions.screen !== "granted") {
      await verifyScreenShare();
    }
  };

  // Switch to Text MCQ mode with track stop
  const handleSwitchToTextMode = () => {
    stopAllMediaTracks();
    if (onSwitchToTextMode) {
      onSwitchToTextMode();
    }
  };

  // Cancel with track stop
  const handleCancel = () => {
    stopAllMediaTracks();
    if (onCancel) {
      onCancel();
    }
  };

  // Check if all required prerequisites are satisfied
  const cameraOk = !requireCamera || permissions.camera === "granted" || privacyMode === "NO_CANDIDATE_VIDEO";
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

  // =========================================================================
  // VIEW 1: DEDICATED PREFLIGHT SETUP SCREEN
  // =========================================================================
  if (!setupStarted) {
    return (
      <div className="w-full max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Mock Interview 2.0 Preflight Setup
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Before entering the evaluation room, we will verify your camera, microphone, and browser environment to ensure a seamless session.
          </p>
        </div>

        {/* Requirements Summary */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
          <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
            What will be checked:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2 text-slate-700">
              <Camera className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Camera Video Feed (Privacy Controlled)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Mic className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Microphone & Audio Input Levels</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Secure Browser Context (HTTPS)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Anti-Tab Switch Proctoring Guidelines</span>
            </div>
          </div>
        </div>

        {/* Fallback Notice for Text MCQ */}
        {onSwitchToTextMode && allowTextFallback && (
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>No camera or microphone available on this device?</span>
            </div>
            <button
              type="button"
              onClick={handleSwitchToTextMode}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shrink-0 transition-colors cursor-pointer"
            >
              Switch to Text MCQ Mode
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
            >
              [ Not Now ]
            </button>
          )}
          <button
            type="button"
            onClick={handleEnableHardware}
            className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>[ Set Up Interview ]</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE HARDWARE PREFLIGHT CHECKLIST
  // =========================================================================
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

      {/* Insecure Context Warning */}
      {!isSecureContext && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Insecure Context Detected</span>
            <p className="leading-relaxed mt-0.5">
              Browsers restrict camera and microphone access to HTTPS origins or localhost. If you encounter permission issues, ensure you are accessing Saarvi via a secure HTTPS connection.
            </p>
          </div>
        </div>
      )}

      {/* Error alert if any permission is denied */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-3 text-xs text-red-700">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-red-900">Permission Action Required</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>

          {/* Step-by-step browser unblock guide */}
          <div className="p-3 bg-white rounded-xl border border-red-200/80 text-slate-700 space-y-1.5 text-[11px]">
            <span className="font-bold text-slate-900 block">How to unblock in your browser:</span>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>Click the <strong>Lock / Tune icon</strong> in your browser&apos;s address bar.</li>
              <li>Toggle <strong>Camera</strong> and <strong>Microphone</strong> permissions to <strong>Allow</strong>.</li>
              <li>Click <strong>&quot;Try Again&quot;</strong> below or refresh the page.</li>
            </ol>
          </div>

          {/* Practice & Simulation Quick Actions */}
          <div className="pt-2 border-t border-red-200/80 flex flex-wrap items-center gap-2.5">
            {onSwitchToTextMode && (
              <button
                type="button"
                onClick={handleSwitchToTextMode}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <span>Switch to Text MCQ Mode (No Hardware Needed)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleEnableSimulatedHardware}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Enable Simulated Practice Mode (For Restricted Devices)</span>
            </button>
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

            {/* Device Switcher Dropdown */}
            {videoDevices.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    const devId = e.target.value;
                    setSelectedCameraId(devId);
                    verifyCamera(devId);
                  }}
                  className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 truncate focus:ring-1 focus:ring-blue-500"
                >
                  {videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => verifyCamera()}
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
                {permissions.camera === "denied" && (
                  <button
                    type="button"
                    onClick={handleEnableSimulatedHardware}
                    className="w-full px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Use Simulated Camera for Practice
                  </button>
                )}
              </div>
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

              {/* Audio Device Switcher */}
              {audioDevices.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
                  <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedMicId}
                    onChange={(e) => {
                      const devId = e.target.value;
                      setSelectedMicId(devId);
                      verifyMicrophone(devId);
                    }}
                    className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 truncate focus:ring-1 focus:ring-blue-500"
                  >
                    {audioDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="text-xs text-slate-500 mb-3">
                Speak to test input audio levels. The green meter confirms sound detection via real Web Audio analysis.
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
              <div className="space-y-2 mt-3">
                <button
                  type="button"
                  onClick={() => verifyMicrophone()}
                  disabled={isCheckingMic}
                  className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isCheckingMic ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Try Microphone Again</span>
                </button>
                {permissions.microphone === "denied" && (
                  <button
                    type="button"
                    onClick={handleEnableSimulatedHardware}
                    className="w-full px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Use Simulated Audio for Practice
                  </button>
                )}
              </div>
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

      {/* Final Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={handleCancel}
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
