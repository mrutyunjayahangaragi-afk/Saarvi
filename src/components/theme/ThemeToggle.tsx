"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme, Theme } from "./ThemeProvider";
import { Sun, Moon, Monitor, Check } from "lucide-react";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme, isAdminRoute } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Avoid hydration mismatch by waiting for mount
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Use a stable placeholder size before mounting to avoid layout shift
  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/60 animate-pulse" />
    );
  }

  // If in admin route, the appearance selector is either hidden or clearly displays Light / locked state (Part 4)
  if (isAdminRoute) {
    return (
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
        title="Admin theme is locked to Light"
        aria-label="Admin theme is locked to Light"
      >
        <Sun className="w-4 h-4 text-amber-500" />
      </div>
    );
  }

  const options: Array<{ id: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111c38] text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-95 cursor-pointer"
        aria-label={`Appearance: ${theme} (${resolvedTheme})`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Appearance: ${theme.charAt(0).toUpperCase() + theme.slice(1)} (Click to change)`}
      >
        {theme === "system" ? (
          <div className="relative">
            <Monitor className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                resolvedTheme === "dark" ? "bg-indigo-400" : "bg-amber-400"
              }`}
            />
          </div>
        ) : theme === "dark" ? (
          <Moon className="w-4 h-4 text-indigo-400" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
      </button>

      {/* Floating Theme Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Theme selector"
          className="absolute right-0 mt-2 w-36 py-1 bg-white dark:bg-[#111c38] rounded-2xl border border-slate-200/95 dark:border-slate-700 shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
            Appearance
          </div>
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      opt.id === "light"
                        ? "text-amber-500"
                        : opt.id === "dark"
                        ? "text-indigo-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
