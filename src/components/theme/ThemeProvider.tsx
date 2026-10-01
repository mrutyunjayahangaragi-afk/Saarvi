"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("doc_ease_theme") as Theme | null;
      const initialTheme: Theme = stored || "system";
      setThemeState(initialTheme);

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      const applyTheme = (t: Theme) => {
        const isDark =
          t === "dark" || (t === "system" && mediaQuery.matches);
        const resolved: "light" | "dark" = isDark ? "dark" : "light";
        setResolvedTheme(resolved);
        if (resolved === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      };

      applyTheme(initialTheme);

      // Listen for system theme changes in real time
      const handleSystemChange = () => {
        const currentStored = localStorage.getItem("doc_ease_theme") as Theme | null;
        if (!currentStored || currentStored === "system") {
          applyTheme("system");
        }
      };

      mediaQuery.addEventListener("change", handleSystemChange);
      return () => mediaQuery.removeEventListener("change", handleSystemChange);
    } catch {
      // Non-browser or SSR fallback
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      if (newTheme === "system") {
        localStorage.removeItem("doc_ease_theme");
      } else {
        localStorage.setItem("doc_ease_theme", newTheme);
      }
    } catch {}

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const isDark =
      newTheme === "dark" || (newTheme === "system" && mediaQuery.matches);
    const nextResolved: "light" | "dark" = isDark ? "dark" : "light";
    setResolvedTheme(nextResolved);

    if (nextResolved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
