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
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [, startTransition] = useTransition();

  // Initialize theme: strictly default to light-first
  useEffect(() => {
    try {
      const stored = localStorage.getItem("doc_ease_theme") as Theme | null;
      const activeTheme: Theme = stored === "dark" ? "light" : (stored || "light");
      
      startTransition(() => {
        setThemeState(activeTheme);
        setResolvedTheme("light");
      });

      // Ensure dark class is removed
      document.documentElement.classList.remove("dark");
    } catch {
      // Ignore in non-browser environments
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("doc_ease_theme", newTheme);
    } catch {
      // Storage might be restricted
    }

    let nextResolved: "light" | "dark";
    if (newTheme === "system") {
      nextResolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      nextResolved = newTheme;
    }

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
