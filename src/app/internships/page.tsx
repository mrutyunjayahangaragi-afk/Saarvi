"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function InternshipsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [featureGated, setFeatureGated] = useState<{
    status: "DISABLED" | "BETA" | "PRO_REQUIRED";
    reason: string;
    maintenanceMessage?: string;
  } | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/jobs/feature-control");
        if (res.ok) {
          const data = await res.json();
          if (data.mode === "DISABLED" || data.enabled === false || data.visible === false) {
            setFeatureGated({
              status: "DISABLED",
              reason: "Jobs & Internships is currently unavailable.",
              maintenanceMessage: data.maintenance_message,
            });
            setLoading(false);
            return;
          }
          // Feature is enabled, forward to verified internships on Jobs board
          router.replace("/jobs?category=internship");
        } else {
          router.replace("/jobs?category=internship");
        }
      } catch {
        router.replace("/jobs?category=internship");
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1329] text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (featureGated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1329] text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16 flex items-center justify-center">
          <div className="w-full bg-white dark:bg-[#111c38] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center shadow-xs space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <Lock className="w-7 h-7" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Jobs &amp; Internships
            </h1>

            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">This feature is currently unavailable.</p>
              <p className="text-slate-500 dark:text-slate-400">
                {featureGated.maintenanceMessage || "Please check back later."}
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-700"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}
