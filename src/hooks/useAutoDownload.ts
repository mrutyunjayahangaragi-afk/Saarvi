"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { downloadBlob, downloadZip } from "@/lib/utils";

export type AutoDownloadStatus =
  | "IDLE"
  | "COUNTDOWN"
  | "DOWNLOADING"
  | "COMPLETED"
  | "CANCELLED"
  | "BLOCKED";

interface UseAutoDownloadOptions {
  blob: Blob | null;
  filename: string;
  isZip?: boolean;
  delaySeconds?: number; // default: 3
  resultId?: string; // Optional unique result ID to prevent double-download across renders/remounts
}

const STORAGE_KEY = "saarvi_auto_download_enabled";
const LEGACY_STORAGE_KEY = "docease_auto_download_enabled";

// Global set tracking results that have completed their one-time automatic download
const completedResultIds = new Set<string>();

export function useAutoDownload({
  blob,
  filename,
  isZip = false,
  delaySeconds = 3,
  resultId,
}: UseAutoDownloadOptions) {
  // Generate deterministic result ID if not explicitly provided
  const activeResultId = useRef<string>(
    resultId || (blob ? `${filename}_${blob.size}_${isZip ? "zip" : "single"}` : "")
  );

  // Read preference from localStorage once on initial render
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const isAlreadyDownloaded = Boolean(activeResultId.current && completedResultIds.has(activeResultId.current));

  const [status, setStatus] = useState<AutoDownloadStatus>(() => {
    if (!blob) return "IDLE";
    if (isAlreadyDownloaded) return "COMPLETED";
    return autoDownloadEnabled ? "COUNTDOWN" : "CANCELLED";
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(delaySeconds);
  const [autoDownloadStarted, setAutoDownloadStarted] = useState<boolean>(false);
  const [autoDownloadCompleted, setAutoDownloadCompleted] = useState<boolean>(isAlreadyDownloaded);

  const [prevBlob, setPrevBlob] = useState<Blob | null>(blob);

  // Adjust state when blob changes to a distinct new file
  if (prevBlob !== blob) {
    setPrevBlob(blob);
    const newId = resultId || (blob ? `${filename}_${blob.size}_${isZip ? "zip" : "single"}` : "");
    activeResultId.current = newId;
    const alreadyDone = Boolean(newId && completedResultIds.has(newId));

    if (blob) {
      if (alreadyDone) {
        setStatus("COMPLETED");
        setAutoDownloadCompleted(true);
      } else {
        setStatus(autoDownloadEnabled ? "COUNTDOWN" : "CANCELLED");
        setAutoDownloadCompleted(false);
      }
      setSecondsRemaining(delaySeconds);
    } else {
      setStatus("IDLE");
      setAutoDownloadCompleted(false);
    }
  }

  const toggleAutoDownload = useCallback(() => {
    setAutoDownloadEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  /**
   * Executes download.
   * @param isAuto When true, guarantees exactly one execution per result ID.
   */
  const triggerDownload = useCallback(
    (isAuto = false) => {
      if (!blob) return false;

      const id = activeResultId.current;

      // Section 23 & 40 Invariant: Never trigger automatic download twice for the same result
      if (isAuto) {
        if (id && completedResultIds.has(id)) {
          return false;
        }
        if (id) {
          completedResultIds.add(id);
        }
        setAutoDownloadStarted(true);
      }

      setStatus("DOWNLOADING");

      const success = isZip ? downloadZip(blob, filename) : downloadBlob(blob, filename);

      if (success) {
        setStatus("COMPLETED");
        if (isAuto) {
          setAutoDownloadCompleted(true);
        }
        return true;
      } else {
        setStatus("BLOCKED");
        return false;
      }
    },
    [blob, filename, isZip]
  );

  const downloadNow = useCallback(() => {
    // Manual intentional download
    triggerDownload(false);
  }, [triggerDownload]);

  const cancelAutoDownload = useCallback(() => {
    setStatus("CANCELLED");
  }, []);

  const downloadAgain = useCallback(() => {
    // Intentional repeat manual download
    triggerDownload(false);
  }, [triggerDownload]);

  // Countdown timer effect: only active while status is COUNTDOWN
  useEffect(() => {
    if (status !== "COUNTDOWN" || !blob) {
      return;
    }

    const id = activeResultId.current;
    if (id && completedResultIds.has(id)) {
      setStatus("COMPLETED");
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          // Trigger automatic download once when countdown hits 0
          setTimeout(() => {
            triggerDownload(true);
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [status, blob, triggerDownload]);

  return {
    status,
    secondsRemaining,
    autoDownloadEnabled,
    toggleAutoDownload,
    downloadNow,
    cancelAutoDownload,
    downloadAgain,
    autoDownloadStarted,
    autoDownloadCompleted,
  };
}
