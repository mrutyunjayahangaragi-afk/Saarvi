"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, ArrowRight, VolumeX, AlertCircle } from 'lucide-react';
import { AdvertisementRecord, AdDisplaySettings, ActiveAdResponse } from '@/types/admin';
import { sanitizeUrl } from '@/lib/security/url-security';

const SESSION_STORAGE_KEY = 'saarvi_ad_session_viewed';
const DAILY_STORAGE_KEY = 'saarvi_ad_daily_viewed';

export default function AdvertisementGate() {
  const router = useRouter();

  const [activeAd, setActiveAd] = useState<AdvertisementRecord | null>(null);
  const [adSettings, setAdSettings] = useState<AdDisplaySettings | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(15);
  const [canSkip, setCanSkip] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const startTimestampRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTrackedStart = useRef(false);

  // Send analytics event to server
  const trackEvent = useCallback(
    async (
      adId: string,
      eventType:
        | 'AD_IMPRESSION'
        | 'AD_STARTED'
        | 'AD_SKIPPED'
        | 'AD_COMPLETED'
        | 'AD_CTA_CLICKED'
        | 'AD_MEDIA_ERROR',
      metadata?: Record<string, unknown>
    ) => {
      try {
        await fetch('/api/advertising/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adId, eventType, metadata }),
        });
      } catch (err) {
        // Non-blocking telemetry
      }
    },
    []
  );

  // Close ad gate and restore normal scroll
  const dismissAd = useCallback(
    (reason: 'SKIPPED' | 'COMPLETED' | 'ERROR') => {
      if (!activeAd) return;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Record event
      if (reason === 'SKIPPED') {
        trackEvent(activeAd.id, 'AD_SKIPPED');
      } else if (reason === 'COMPLETED') {
        trackEvent(activeAd.id, 'AD_COMPLETED');
      }

      // Record frequency marker
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
        localStorage.setItem(DAILY_STORAGE_KEY, Date.now().toString());
      } catch (e) {
        // Storage access safe fallback
      }

      // Restore body scroll
      document.body.style.overflow = '';
      setIsVisible(false);

      // Notify other floating components (like AI Assistant) to restore
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('saarvi:ad-state-changed', { detail: { active: false } })
        );
      }
    },
    [activeAd, trackEvent]
  );

  // Initial fetch and frequency evaluation
  useEffect(() => {
    let isMounted = true;

    async function checkEligibility() {
      // 1. Check local session frequency before network call if already seen this session
      try {
        const sessionSeen = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionSeen) {
          // Already seen in this browser session
          return;
        }
      } catch (e) {}

      try {
        const res = await fetch('/api/advertising/active');
        if (!res.ok) return;

        const data: ActiveAdResponse = await res.json();
        if (!isMounted) return;

        // Pro users are strictly exempt (showAd: false, isPro: true)
        if (!data.showAd || !data.ad) {
          return;
        }

        const ad = data.ad;
        const settings = data.settings;

        // 2. Frequency checks based on ad configuration
        if (ad.frequencyMode === 'ONCE_PER_DAY') {
          try {
            const lastSeen = localStorage.getItem(DAILY_STORAGE_KEY);
            if (lastSeen) {
              const diffMs = Date.now() - Number(lastSeen);
              if (diffMs < 24 * 60 * 60 * 1000) {
                return; // Suppressed for today
              }
            }
          } catch (e) {}
        }

        setActiveAd(ad);
        if (settings) setAdSettings(settings);
        setIsVisible(true);
        setSecondsRemaining(ad.durationSeconds);
        setCanSkip(!ad.skipEnabled || ad.skipAfterSeconds === 0);

        // Lock body scroll
        document.body.style.overflow = 'hidden';

        // Notify AI assistant to hide
        window.dispatchEvent(
          new CustomEvent('saarvi:ad-state-changed', { detail: { active: true } })
        );

        // Track impression
        trackEvent(ad.id, 'AD_IMPRESSION');
      } catch (err) {
        console.error('[Advertisement Gate] Error checking eligibility:', err);
      }
    }

    checkEligibility();

    return () => {
      isMounted = false;
      document.body.style.overflow = '';
    };
  }, [trackEvent]);

  // Real timestamp countdown timer
  useEffect(() => {
    if (!isVisible || !activeAd) return;

    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackEvent(activeAd.id, 'AD_STARTED');
    }

    startTimestampRef.current = Date.now();
    const durationMs = activeAd.durationSeconds * 1000;
    const skipMs = activeAd.skipAfterSeconds * 1000;

    timerRef.current = setInterval(() => {
      if (!startTimestampRef.current) return;
      const elapsed = Date.now() - startTimestampRef.current;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setSecondsRemaining(remaining);

      // Check skip threshold
      if (activeAd.skipEnabled && elapsed >= skipMs) {
        setCanSkip(true);
      }

      // Check completion
      if (elapsed >= durationMs) {
        if (timerRef.current) clearInterval(timerRef.current);
        dismissAd('COMPLETED');
      }
    }, 250);

    // Keyboard support: Escape to skip if available
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canSkip) {
        dismissAd('SKIPPED');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, activeAd, canSkip, dismissAd, trackEvent]);

  if (!isVisible || !activeAd) {
    return null;
  }

  const safeCtaUrl = activeAd.ctaUrl ? sanitizeUrl(activeAd.ctaUrl, '#') : null;

  const handleCtaClick = () => {
    trackEvent(activeAd.id, 'AD_CTA_CLICKED');
    if (!safeCtaUrl || safeCtaUrl === '#') return;

    if (safeCtaUrl.startsWith('/')) {
      dismissAd('SKIPPED');
      router.push(safeCtaUrl);
    } else {
      window.open(safeCtaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const skipWaitRemaining = Math.max(
    0,
    activeAd.skipAfterSeconds - (activeAd.durationSeconds - secondsRemaining)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sponsored Advertisement"
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl relative">
        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase text-white/90 border border-white/10 shadow-sm">
              Sponsored
            </span>
            {activeAd.advertiserName && (
              <span className="text-xs font-semibold text-white/90 drop-shadow px-2 py-0.5 rounded bg-black/40 backdrop-blur-md hidden sm:inline-block">
                {activeAd.advertiserName}
              </span>
            )}
          </div>

          {/* Real Countdown & Skip Button */}
          <div className="flex items-center gap-2">
            {activeAd.skipEnabled ? (
              <button
                disabled={!canSkip}
                onClick={() => dismissAd('SKIPPED')}
                aria-label={canSkip ? 'Skip advertisement' : `Skip available in ${skipWaitRemaining} seconds`}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  canSkip
                    ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-xl cursor-pointer scale-100'
                    : 'bg-black/60 text-white/75 border border-white/10 cursor-not-allowed'
                }`}
              >
                {canSkip ? (
                  <>
                    Skip <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  `Skip in ${skipWaitRemaining}`
                )}
              </button>
            ) : (
              <div className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-black/60 text-white/80 border border-white/10 flex items-center gap-1.5">
                <span>Ad finishes in {secondsRemaining}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Media Container */}
        <div className="flex-1 min-h-[300px] sm:min-h-[440px] relative bg-black flex items-center justify-center overflow-hidden">
          {mediaError ? (
            <div className="p-8 text-center text-white space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold">Media unavailable or format unsupported.</p>
              <button
                onClick={() => dismissAd('ERROR')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
              >
                Continue to Saarvi
              </button>
            </div>
          ) : activeAd.mediaType === 'IMAGE' ? (
            <img
              src={activeAd.mediaUrl}
              alt={activeAd.name}
              onError={() => {
                setMediaError(true);
                trackEvent(activeAd.id, 'AD_MEDIA_ERROR', { error: 'Image failed to load' });
              }}
              className="w-full h-full object-contain max-h-[70vh]"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                src={activeAd.mediaUrl}
                autoPlay
                muted
                playsInline
                onError={() => {
                  setMediaError(true);
                  trackEvent(activeAd.id, 'AD_MEDIA_ERROR', { error: 'Video autoplay/playback failed' });
                }}
                className="w-full h-full object-contain max-h-[70vh]"
              />
              <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 text-[10px] text-white/80 flex items-center gap-1">
                <VolumeX className="w-3 h-3" />
                Muted
              </div>
            </div>
          )}

          {/* Headline & CTA Overlay */}
          {(activeAd.headline || activeAd.ctaText) && (
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent text-white z-20">
              <div className="max-w-2xl">
                {activeAd.headline && (
                  <h3 className="text-base sm:text-lg font-bold drop-shadow-md text-white">
                    {activeAd.headline}
                  </h3>
                )}
                {activeAd.bodyText && (
                  <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 mt-1 drop-shadow">
                    {activeAd.bodyText}
                  </p>
                )}

                {activeAd.ctaText && safeCtaUrl && (
                  <div className="mt-3.5">
                    <button
                      onClick={handleCtaClick}
                      className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-white"
                    >
                      {activeAd.ctaText}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
