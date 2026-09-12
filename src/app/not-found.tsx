import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ArrowLeft, Home, Wrench, GraduationCap, LayoutDashboard } from "lucide-react";

export const metadata: Metadata = {
  title: "404 — Page Not Found | Saarvi",
  description: "The page you are looking for does not exist or has been moved.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-50 text-blue-600 font-extrabold text-3xl ring-8 ring-blue-50/50 shadow-sm">
            404
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Page not found
            </h1>
            <p className="text-base text-slate-600 max-w-md mx-auto">
              Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved, deleted, or never existed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 text-left">
            <Link
              href="/"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-sm transition-all group"
            >
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">Home</div>
                <div className="text-xs text-slate-500">Back to main page</div>
              </div>
            </Link>

            <Link
              href="/tools"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-sm transition-all group"
            >
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">All Tools</div>
                <div className="text-xs text-slate-500">PDF, images & utilities</div>
              </div>
            </Link>

            <Link
              href="/student"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-sm transition-all group"
            >
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">Student Hub</div>
                <div className="text-xs text-slate-500">CGPA, tasks, timetable</div>
              </div>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-sm transition-all group"
            >
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">Dashboard</div>
                <div className="text-xs text-slate-500">Your profile & usage</div>
              </div>
            </Link>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to safe territory
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
