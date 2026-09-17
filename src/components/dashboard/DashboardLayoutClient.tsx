"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  History,
  FileText,
  Settings,
  User,
  LogOut,
  Shield,
  Loader2,
  CreditCard
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DASHBOARD_TABS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/resumes", label: "Saved Resumes", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/billing", label: "Plans & Billing", icon: CreditCard },
];

export default function DashboardLayoutClient({ children }: DashboardLayoutProps) {
  const { user, profile, isLoading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Client-side session protection check
  useEffect(() => {
    if (!isLoading && !user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading your workspace...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = profile?.fullName || user.fullName || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const userAvatar =
    profile?.avatarUrl ||
    user.avatarUrl ||
    (user as any)?.user_metadata?.avatar_url ||
    null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      {/* DASHBOARD HEADER & SUB-NAVIGATION */}
      <div className="bg-white border-b border-slate-200/80 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Bar: User Welcome + Initials Badge + Logout */}
          <div className="pt-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={displayName}
                  className="w-11 h-11 rounded-2xl object-cover shadow-xs shrink-0 border border-slate-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                    const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className={`w-11 h-11 rounded-2xl bg-blue-600 text-white items-center justify-center font-bold text-sm shadow-xs shrink-0 ${
                  userAvatar ? "hidden" : "flex"
                }`}
              >
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                    {displayName}
                  </h1>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      (profile as any)?.plan === "PRO"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {(profile as any)?.plan === "PRO" ? "Pro Plan" : "Free Plan"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 mr-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Private browser execution</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar border-t border-slate-100 pt-1 -mb-px">
            {DASHBOARD_TABS.map((tab) => {
              const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
                    isActive
                      ? "border-blue-600 text-blue-600 bg-blue-50/50"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

        </div>
      </div>

      {/* DASHBOARD CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </main>

      <Footer />
    </div>
  );
}
