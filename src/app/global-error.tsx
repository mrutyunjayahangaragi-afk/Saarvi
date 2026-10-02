"use client";

import { useEffect } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global fatal layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1329] flex items-center justify-center p-4 font-sans antialiased text-slate-900 dark:text-white">
        <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-[#111c38] p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 ring-8 ring-red-50/50 dark:ring-red-900/30">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Application Error
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              A critical layout error occurred. You can reload the page or reset the application state.
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
                Digest: {error.digest}
              </p>
            )}
          </div>

          <div>
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Saarvi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
