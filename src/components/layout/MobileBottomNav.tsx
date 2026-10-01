"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Briefcase, Search, MoreHorizontal } from "lucide-react";
import MobileMoreSheet from "./MobileMoreSheet";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Suppress bottom nav when mobile virtual keyboard is open
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.innerHeight - window.visualViewport.height > 180;
        setKeyboardVisible(isKeyboard);
      }
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  // Close more sheet on route change
  useEffect(() => {
    setMoreSheetOpen(false);
  }, [pathname]);

  // Listen to global open/close events for coordination
  useEffect(() => {
    const handleCloseOverlays = () => setMoreSheetOpen(false);
    window.addEventListener("saarvi:close-navigation-overlays", handleCloseOverlays);
    return () => window.removeEventListener("saarvi:close-navigation-overlays", handleCloseOverlays);
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
  
  // More is active if user is currently inside any of the routes grouped under More
  const isMoreActive =
    moreSheetOpen ||
    pathname?.startsWith("/student") ||
    pathname?.startsWith("/pricing") ||
    pathname?.startsWith("/career") ||
    pathname?.startsWith("/contact") ||
    pathname?.startsWith("/privacy") ||
    pathname?.startsWith("/terms");

  const handleOpenSearch = () => {
    setMoreSheetOpen(false);
    window.dispatchEvent(new CustomEvent("saarvi:open-global-search"));
  };

  const handleToggleMore = () => {
    // Notify other overlays to close first
    window.dispatchEvent(new CustomEvent("saarvi:close-profile-overlay"));
    setMoreSheetOpen((prev) => !prev);
  };

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-transform duration-200"
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

          {/* 4. Search */}
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

          {/* 5. More ⋯ (Replaces Profile in Bottom Nav) */}
          <button
            type="button"
            onClick={handleToggleMore}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-1.5 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
              isMoreActive
                ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/60"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
            }`}
            aria-label="More navigation"
            aria-expanded={moreSheetOpen}
          >
            <MoreHorizontal className={`w-4.5 h-4.5 transition-transform ${isMoreActive ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Dynamic Mobile More Navigation Sheet */}
      <MobileMoreSheet isOpen={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} />
    </>
  );
}
