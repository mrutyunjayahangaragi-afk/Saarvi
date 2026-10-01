"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Briefcase, Search, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Intelligently suppress bottom nav when virtual keyboard is open on mobile
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.visualViewport) {
        // If viewport height drops substantially (>180px), keyboard is likely open
        const isKeyboard = window.innerHeight - window.visualViewport.height > 180;
        setKeyboardVisible(isKeyboard);
      }
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  // Suppress on admin dashboard or full-screen immersive processing views
  const isImmersiveFullscreen =
    pathname?.startsWith("/admin") ||
    pathname?.includes("/copilot/interview") ||
    pathname?.includes("/fullscreen");

  if (isImmersiveFullscreen || keyboardVisible) {
    return null;
  }

  const isHomeActive = pathname === "/";
  const isToolsActive = pathname === "/tools" || (pathname?.startsWith("/tools/") && !pathname?.startsWith("/tools/search"));
  const isJobsActive = pathname?.startsWith("/jobs") || pathname?.startsWith("/internships");
  const isProfileActive = pathname?.startsWith("/profile") || pathname?.startsWith("/auth");

  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent("saarvi:open-global-search"));
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] transition-transform duration-200"
      style={{
        paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))",
      }}
    >
      <div className="max-w-md mx-auto px-2 grid grid-cols-5 items-center h-14">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-1.5 rounded-xl transition-all duration-150 active:scale-95 ${
            isHomeActive
              ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/60"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          }`}
          aria-current={isHomeActive ? "page" : undefined}
        >
          <Home className={`w-4.5 h-4.5 transition-transform ${isHomeActive ? "scale-110" : ""}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
        </Link>

        {/* 2. Tools */}
        <Link
          href="/tools"
          className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-1.5 rounded-xl transition-all duration-150 active:scale-95 ${
            isToolsActive
              ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/60"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          }`}
          aria-current={isToolsActive ? "page" : undefined}
        >
          <LayoutGrid className={`w-4.5 h-4.5 transition-transform ${isToolsActive ? "scale-110" : ""}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Tools</span>
        </Link>

        {/* 3. Jobs */}
        <Link
          href="/jobs"
          className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-1.5 rounded-xl transition-all duration-150 active:scale-95 ${
            isJobsActive
              ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/60"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          }`}
          aria-current={isJobsActive ? "page" : undefined}
        >
          <Briefcase className={`w-4.5 h-4.5 transition-transform ${isJobsActive ? "scale-110" : ""}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Jobs</span>
        </Link>

        {/* 4. Search — Signature Rotating Accent Button */}
        <button
          type="button"
          onClick={handleOpenSearch}
          className="flex flex-col items-center justify-center min-h-[44px] py-1 px-1.5 rounded-xl transition-all duration-150 active:scale-95 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium group cursor-pointer"
          aria-label="Search tools, jobs, calculators"
        >
          <div className="relative p-1 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 transition-colors">
            <Search className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400">Search</span>
        </button>

        {/* 5. Profile */}
        <Link
          href={user ? "/profile" : "/auth/login"}
          className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-1.5 rounded-xl transition-all duration-150 active:scale-95 ${
            isProfileActive
              ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/60"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          }`}
          aria-current={isProfileActive ? "page" : undefined}
        >
          <User className={`w-4.5 h-4.5 transition-transform ${isProfileActive ? "scale-110" : ""}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
