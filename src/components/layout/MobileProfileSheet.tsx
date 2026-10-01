"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  User,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Bell,
  Shield,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/components/theme/ThemeProvider";

interface MobileProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileProfileSheet({ isOpen, onClose }: MobileProfileSheetProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  // Handle Escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPro = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const userInitial = (profile?.fullName || user?.fullName || user?.email || "U").charAt(0).toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account & Profile Settings"
      className="fixed inset-0 z-50 md:hidden flex flex-col justify-end animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Bottom Sheet Surface */}
      <div
        className="relative w-full max-h-[88vh] bg-white dark:bg-[#0c1322] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 z-10"
        style={{
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
        }}
      >
        {/* Drag Handle & Close */}
        <div className="flex items-center justify-between px-6 pt-3.5 pb-2 shrink-0">
          <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close profile menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-5 py-2 space-y-4">
          {/* Header Profile Identity */}
          {user ? (
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111b2c] border border-slate-200/80 dark:border-slate-800/80">
              <div className="w-12 h-12 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-sm">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {profile?.fullName || user.fullName || "Saarvi Scholar"}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                      isPro
                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60"
                        : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200/80 dark:border-blue-800/60"
                    }`}
                  >
                    {isAdmin ? "Admin" : isPro ? "Pro" : "Free"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/70 dark:border-blue-800/50 space-y-2.5 text-center">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Welcome to Saarvi</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Sign in to save your career preferences, bookmark opportunities, and access Pro tools.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Link
                  href="/login"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs hover:bg-slate-50 transition"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={onClose}
                  className="saarvi-btn-primary px-4 py-2 text-xs font-bold shadow-2xs"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          )}

          {/* Navigation Action Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 overflow-hidden">
            {user && (
              <Link
                href="/dashboard/profile"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold">Profile Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            )}

            <Link
              href="/pricing"
              onClick={onClose}
              className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
            >
              <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold">Plans &amp; Subscription</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {isPro ? "Active Plan" : "Upgrade"}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </Link>

            <Link
              href="/notifications"
              onClick={onClose}
              className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer min-h-[48px]"
            >
              <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold">Notifications</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center justify-between p-3.5 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3 text-purple-700 dark:text-purple-300">
                  <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold">Admin Control Center</span>
                </div>
                <ChevronRight className="w-4 h-4 text-purple-400" />
              </Link>
            )}
          </div>

          {/* Theme / Appearance Segment */}
          <div className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Appearance
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  theme === "system"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>System</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  theme === "light"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  theme === "dark"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Legal & Support Links */}
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400 py-1">
            <Link href="/privacy" onClick={onClose} className="hover:text-blue-600 dark:hover:text-blue-400">
              Privacy
            </Link>
            <span>&bull;</span>
            <Link href="/terms" onClick={onClose} className="hover:text-blue-600 dark:hover:text-blue-400">
              Terms
            </Link>
            <span>&bull;</span>
            <Link href="/contact" onClick={onClose} className="hover:text-blue-600 dark:hover:text-blue-400">
              Support
            </Link>
          </div>

          {/* Log Out Button */}
          {user && (
            <button
              type="button"
              onClick={async () => {
                onClose();
                await signOut();
                router.push("/");
              }}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-900/40 text-xs font-bold hover:bg-red-100 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out of Saarvi</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
