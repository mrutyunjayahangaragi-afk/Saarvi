"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface GoogleSignInButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  text?: string;
}

export function GoogleIcon({ className = "w-5 h-5", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function GoogleSignInButton({
  onClick,
  loading = false,
  disabled = false,
  className = "",
  text,
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      id="google-signin-btn"
      onClick={onClick}
      disabled={loading || disabled}
      aria-label="Continue with Google"
      aria-busy={loading}
      className={`w-full min-h-[44px] px-4 py-3 bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 disabled:opacity-60 disabled:pointer-events-none text-slate-700 dark:text-slate-200 font-medium text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-3 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-slate-500 shrink-0" aria-hidden="true" />
          <span className="font-medium text-slate-600">Connecting to Google...</span>
        </>
      ) : (
        <>
          <GoogleIcon className="w-5 h-5 shrink-0" />
          <span className="font-medium text-slate-700">{text || "Continue with Google"}</span>
        </>
      )}
    </button>
  );
}
