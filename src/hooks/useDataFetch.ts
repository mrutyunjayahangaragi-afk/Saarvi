"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { dataClient, FetchOptions } from "@/lib/data/data-client";

export type AsyncState =
  | "IDLE"
  | "INITIALIZING"
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "ERROR"
  | "RETRYING";

export interface UseDataFetchOptions<T> extends FetchOptions<T> {
  enabled?: boolean;
  isEmpty?: (data: T) => boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseDataFetchResult<T> {
  data: T | null;
  state: AsyncState;
  isLoading: boolean;
  isReady: boolean;
  isEmpty: boolean;
  isError: boolean;
  error: Error | null;
  retry: () => Promise<void>;
  mutate: (updater: T | ((prev: T | null) => T)) => void;
}

export function useDataFetch<T>(
  endpoint: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseDataFetchOptions<T> = {}
): UseDataFetchResult<T> {
  const {
    enabled = true,
    userId,
    scope = "default",
    ttlMs,
    timeoutMs,
    isEmpty: customIsEmpty,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<AsyncState>("INITIALIZING");
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const fetchCountRef = useRef(0);

  const defaultIsEmptyCheck = useCallback((val: T): boolean => {
    if (customIsEmpty) return customIsEmpty(val);
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (Array.isArray(obj.items)) return obj.items.length === 0;
      if (Array.isArray(obj.notifications)) return obj.notifications.length === 0;
      return Object.keys(obj).length === 0;
    }
    return false;
  }, [customIsEmpty]);

  const executeFetch = useCallback(
    async (isRetry: boolean = false) => {
      if (!enabled) {
        setState("IDLE");
        return;
      }

      const currentFetchId = ++fetchCountRef.current;
      setState(isRetry ? "RETRYING" : data ? "READY" : "LOADING");
      setError(null);

      try {
        const result = await dataClient.fetch(endpoint, fetcher, {
          userId,
          scope,
          ttlMs,
          timeoutMs,
          forceRefresh: isRetry,
          onBackgroundUpdate: (freshData) => {
            if (isMountedRef.current && currentFetchId === fetchCountRef.current) {
              setData(freshData);
              const empty = defaultIsEmptyCheck(freshData);
              setState(empty ? "EMPTY" : "READY");
              if (onSuccess) onSuccess(freshData);
            }
          },
        });

        if (!isMountedRef.current || currentFetchId !== fetchCountRef.current) {
          return;
        }

        setData(result.data);
        const empty = defaultIsEmptyCheck(result.data);
        setState(empty ? "EMPTY" : "READY");
        if (onSuccess) onSuccess(result.data);
      } catch (err: unknown) {
        if (!isMountedRef.current || currentFetchId !== fetchCountRef.current) {
          return;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setState("ERROR");
        if (onError) onError(errorObj);
      }
    },
    [enabled, endpoint, fetcher, userId, scope, ttlMs, timeoutMs, data, defaultIsEmptyCheck, onSuccess, onError]
  );

  useEffect(() => {
    isMountedRef.current = true;
    executeFetch();

    return () => {
      isMountedRef.current = false;
    };
  }, [executeFetch]);

  const retry = useCallback(async () => {
    await executeFetch(true);
  }, [executeFetch]);

  const mutate = useCallback(
    (updater: T | ((prev: T | null) => T)) => {
      setData((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T | null) => T)(prev) : updater;
        dataClient.mutate(endpoint, next, userId || "guest", scope);
        const empty = defaultIsEmptyCheck(next);
        setState(empty ? "EMPTY" : "READY");
        return next;
      });
    },
    [endpoint, userId, scope, defaultIsEmptyCheck]
  );

  return {
    data,
    state,
    isLoading: state === "LOADING" || state === "INITIALIZING" || state === "RETRYING",
    isReady: state === "READY",
    isEmpty: state === "EMPTY",
    isError: state === "ERROR",
    error,
    retry,
    mutate,
  };
}
