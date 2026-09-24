"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SaarviLoadingLogo } from "@/components/brand/SaarviLoadingLogo";

export default function Loading() {
  const [tookTooLong, setTookTooLong] = useState(false);

  useEffect(() => {
    // 8-second safety timeout to ensure user is never trapped on an infinite loading screen
    const timer = setTimeout(() => {
      setTookTooLong(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[60vh] flex flex-col items-center justify-center p-6 animate-in fade-in duration-200"
    >
      <SaarviLoadingLogo
        size="lg"
        state={tookTooLong ? "working" : "loading"}
        message={
          tookTooLong
            ? "Saarvi is finishing up your request..."
            : "Saarvi is preparing your workspace..."
        }
      />
      {tookTooLong && (
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            If this takes longer than expected, you can continue or return home.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
          >
            Return to Saarvi Home
          </Link>
        </div>
      )}
    </div>
  );
}
