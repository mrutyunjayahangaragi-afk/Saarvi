"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isAdminRoute: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "doc_ease_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = Boolean(pathname?.startsWith("/admin"));

  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Helper to calculate resolved theme for public routes
  const getPublicResolvedTheme = useCallback((currentTheme: Theme): "light" | "dark" => {
    if (currentTheme === "dark") return "dark";
    if (currentTheme === "light") return "light";
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }, []);

  // Synchronize DOM with the computed active appearance
  const applyThemeToDOM = useCallback((resolved: "light" | "dark", isForcedLight: boolean) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (isForcedLight || resolved === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    }
  }, []);

  // Initialize theme from localStorage and bind media query + storage events
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initialTheme: Theme = stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
      setThemeState(initialTheme);

      const publicResolved = getPublicResolvedTheme(initialTheme);
      const activeResolved = isAdminRoute ? "light" : publicResolved;
      setResolvedTheme(activeResolved);
      applyThemeToDOM(activeResolved, isAdminRoute);

      // Listen for OS system theme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleSystemChange = () => {
        const currentStored = localStorage.getItem(STORAGE_KEY) as Theme | null;
        if (!currentStored || currentStored === "system") {
          const nextPublic = mediaQuery.matches ? "dark" : "light";
          if (!isAdminRoute) {
            setResolvedTheme(nextPublic);
            applyThemeToDOM(nextPublic, false);
          }
        }
      };

      // Listen for cross-tab theme changes (Requirement Part 22)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
          const val = (e.newValue as Theme) || "system";
          setThemeState(val);
          const nextPublic = getPublicResolvedTheme(val);
          if (!isAdminRoute) {
            setResolvedTheme(nextPublic);
            applyThemeToDOM(nextPublic, false);
          }
        }
      };

      mediaQuery.addEventListener("change", handleSystemChange);
      window.addEventListener("storage", handleStorageChange);

      return () => {
        mediaQuery.removeEventListener("change", handleSystemChange);
        window.removeEventListener("storage", handleStorageChange);
      };
    } catch {
      // Fallback for non-standard environments
    }
  }, [isAdminRoute, getPublicResolvedTheme, applyThemeToDOM]);

  // Handle route transitions between Admin (forced-light) and Public routes (respect user preference)
  useEffect(() => {
    if (isAdminRoute) {
      // Admin route: lock DOM to light without touching stored user preference
      setResolvedTheme("light");
      applyThemeToDOM("light", true);
    } else {
      // Public route: restore user's saved preference
      const publicResolved = getPublicResolvedTheme(theme);
      setResolvedTheme(publicResolved);
      applyThemeToDOM(publicResolved, false);
    }
  }, [isAdminRoute, theme, getPublicResolvedTheme, applyThemeToDOM]);

  // Explicit user action to change preference
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      if (newTheme === "system") {
        localStorage.setItem(STORAGE_KEY, "system");
      } else {
        localStorage.setItem(STORAGE_KEY, newTheme);
      }
    } catch {}

    const publicResolved = getPublicResolvedTheme(newTheme);
    if (!isAdminRoute) {
      setResolvedTheme(publicResolved);
      applyThemeToDOM(publicResolved, false);
    }
  }, [isAdminRoute, getPublicResolvedTheme, applyThemeToDOM]);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme: isAdminRoute ? "light" : resolvedTheme,
      setTheme,
      toggleTheme,
      isAdminRoute,
    }),
    [theme, resolvedTheme, isAdminRoute, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
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
