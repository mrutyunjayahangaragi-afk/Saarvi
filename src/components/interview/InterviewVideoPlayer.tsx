"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  AlertCircle,
  Loader2,
  Settings,
  Clock,
  HardDrive,
  Calendar,
  User,
  ShieldCheck,
} from "lucide-react";

interface InterviewVideoPlayerProps {
  sessionId: string;
  initialPlaybackUrl?: string;
  expiresAt?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  candidateName?: string;
  role?: string;
  recordedAt?: string;
  canDownload?: boolean;
  onRefreshPlaybackUrl?: () => Promise<string>;
}

export default function InterviewVideoPlayer({
  sessionId,
  initialPlaybackUrl,
  expiresAt,
  durationSeconds,
  fileSizeBytes,
  candidateName,
  role,
  recordedAt,
  canDownload = true,
  onRefreshPlaybackUrl,
}: InterviewVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [playbackUrl, setPlaybackUrl] = useState<string>(initialPlaybackUrl || "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync initial URL if prop updates
  useEffect(() => {
    if (initialPlaybackUrl && initialPlaybackUrl !== playbackUrl) {
      setPlaybackUrl(initialPlaybackUrl);
      setErrorMessage(null);
    }
  }, [initialPlaybackUrl]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Format bytes to human readable string
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "Unknown size";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Video Event Handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || durationSeconds || 0);
      setIsLoading(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setIsPlaying(false);
    setErrorMessage("The playback URL may have expired or the video file is unavailable.");
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[Video Play Error]:", err);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
    if (!newMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.warn("[Fullscreen Request Failed]:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen to fullscreen changes
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Request new signed link if expired
  const handleRefresh = async () => {
    if (!onRefreshPlaybackUrl) return;
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const newUrl = await onRefreshPlaybackUrl();
      if (newUrl) {
        setPlaybackUrl(newUrl);
        setIsLoading(true);
        if (videoRef.current) {
          videoRef.current.load();
        }
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Failed to renew secure playback token.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl text-slate-100 flex flex-col">
      {/* Session Metadata Header */}
      <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Private Candidate Recording</span>
          </div>
          {role && (
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
              {role}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          {candidateName && (
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>{candidateName}</span>
            </div>
          )}
          {recordedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(recordedAt).toLocaleDateString()}</span>
            </div>
          )}
          {fileSizeBytes && (
            <div className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatBytes(fileSizeBytes)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Video Viewport */}
      <div
        ref={containerRef}
        className="relative aspect-video bg-black flex items-center justify-center group overflow-hidden"
      >
        {playbackUrl ? (
          <video
            ref={videoRef}
            src={playbackUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={handleError}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => {
              setIsLoading(false);
              setIsPlaying(true);
            }}
            onClick={togglePlay}
            playsInline
            className="w-full h-full object-contain cursor-pointer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No recording source available</p>
            <p className="text-xs text-slate-500 max-w-sm">
              The recording is either still processing, was conducted without video consent, or has expired.
            </p>
          </div>
        )}

        {/* Loading Spinner Overlay */}
        {isLoading && playbackUrl && !errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none gap-2">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="text-xs text-slate-300 font-medium">Buffering recording...</span>
          </div>
        )}

        {/* Error State Overlay */}
        {errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center space-y-3 z-10">
            <AlertCircle className="w-10 h-10 text-amber-400" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-100">Unable to stream recording</p>
              <p className="text-xs text-slate-400 max-w-md">{errorMessage}</p>
            </div>
            {onRefreshPlaybackUrl && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                {isRefreshing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Generate New Signed Playback Link</span>
              </button>
            )}
          </div>
        )}

        {/* Big Center Play/Pause Indicator (brief on click) */}
        {!errorMessage && playbackUrl && !isLoading && !isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play Recording"
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors cursor-pointer group-hover:opacity-100"
          >
            <div className="w-16 h-16 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
              <Play className="w-7 h-7 fill-white ml-1" />
            </div>
          </button>
        )}

        {/* Player Bottom Control Bar */}
        {playbackUrl && !errorMessage && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-4 flex flex-col gap-2 transition-opacity duration-200">
            {/* Seek Slider */}
            <div className="w-full flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
              />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                </button>

                {/* Volume & Mute */}
                <div className="flex items-center gap-1.5 group/vol">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={isMuted ? "Unmute (M)" : "Mute (M)"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hidden sm:block"
                  />
                </div>

                {/* Time Display */}
                <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-400">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2">
                {/* Playback Speed Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    {playbackRate}x
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-8 right-0 bg-slate-900 border border-slate-700 rounded-xl py-1 shadow-2xl z-20 w-24">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => changePlaybackRate(speed)}
                          className={`w-full px-3 py-1 text-left text-xs hover:bg-slate-800 transition-colors ${
                            playbackRate === speed
                              ? "text-blue-400 font-bold bg-slate-800/50"
                              : "text-slate-300"
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Download Button */}
                {canDownload && playbackUrl && (
                  <a
                    href={playbackUrl}
                    download={`mock-interview-${sessionId}.webm`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Download Private Recording"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security & Access Footer Notice */}
      <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {expiresAt
              ? `Signed token valid until ${new Date(expiresAt).toLocaleTimeString()}`
              : "Access controlled via short-lived signed URLs (1 hr TTL)"}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">Session ID: {sessionId}</span>
      </div>
    </div>
  );
}
