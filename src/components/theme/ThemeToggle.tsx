"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Avoid hydration mismatch by waiting for mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Use a stable placeholder size before mounting to avoid layout shift
  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-100/60 animate-pulse" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 bg-white text-slate-700 hover:text-blue-600 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all duration-150 active:scale-95 cursor-pointer"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-200 rotate-0 scale-100 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-200 rotate-0 scale-100 text-slate-700" />
      )}
    </button>
  );
}
