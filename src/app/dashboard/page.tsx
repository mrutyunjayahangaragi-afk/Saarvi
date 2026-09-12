"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  FileImage,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Plus,
  BarChart3,
  BookOpen,
  Zap,
  GraduationCap,
  Briefcase,
  Trophy,
  Calendar,
  Calculator,
  CheckSquare,
  Award,
  FileEdit,
  MessageSquare,
  Pin,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { conversionHistoryService } from "@/lib/services/conversionHistoryService";
import { resumeService } from "@/lib/services/resumeService";
import { studentService } from "@/lib/services/studentService";
import { conversationService } from "@/lib/services/conversationService";
import { ConversionHistoryRecord, SavedResumeDraft } from "@/types/auth";
import { Conversation } from "@/types/conversation";
import { formatBytes } from "@/lib/utils";
import StatCard from "@/components/dashboard/StatCard";
import SkeletonCard from "@/components/dashboard/SkeletonCard";

const QUICK_TOOLS = [
  {
    name: "JPG → PDF",
    desc: "Convert photos to clean PDF documents.",
    route: "/tools/jpg-to-pdf",
    icon: FileText,
    badge: "Popular",
  },
  {
    name: "PDF → JPG",
    desc: "Extract high-resolution image pages from PDF.",
    route: "/tools/pdf-to-jpg",
    icon: FileImage,
    badge: "Popular",
  },
  {
    name: "Compress PDF",
    desc: "Reduce document size for portal uploads.",
    route: "/tools/compress-pdf",
    icon: Layers,
    badge: "Popular",
  },
  {
    name: "Resume Builder",
    desc: "Draft and customize ATS-compliant resumes.",
    route: "/student/resume",
    icon: Sparkles,
    badge: "Student",
  },
];

export default function DashboardOverviewPage() {
  const { user, profile } = useAuth();
  const [recentHistory, setRecentHistory] = useState<ConversionHistoryRecord[]>([]);
  const [allHistory, setAllHistory] = useState<ConversionHistoryRecord[]>([]);
  const [resumes, setResumes] = useState<SavedResumeDraft[]>([]);
  const [studentSummary, setStudentSummary] = useState<{
    resumesCount: number;
    internshipsCount: number;
    hackathonsCount: number;
    studyTasksUpcoming: number;
    assignmentsUpcoming: number;
    latestCgpa?: number | null;
    latestSgpa?: number | null;
    completedSemesters?: number;
  }>({
    resumesCount: 0,
    internshipsCount: 0,
    hackathonsCount: 0,
    studyTasksUpcoming: 0,
    assignmentsUpcoming: 0,
    latestCgpa: null,
    latestSgpa: null,
    completedSemesters: 0,
  });
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName =
    profile?.fullName || user?.fullName
      ? (profile?.fullName || user?.fullName || "").split(" ")[0]
      : null;

  useEffect(() => {
    async function loadData() {
      try {
        const [h, r, sSummary, convs] = await Promise.all([
          conversionHistoryService.getHistory(),
          resumeService.getResumes(),
          studentService.getStudentSummary(),
          conversationService.listConversations(user?.id || "guest"),
        ]);
        setAllHistory(h);
        setRecentHistory(h.slice(0, 5));
        setResumes(r);
        setStudentSummary(sSummary);
        setRecentConversations(convs.slice(0, 3));
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  const successCount = allHistory.filter((h) => h.status === "Completed").length;

  return (
    <div className="space-y-8">

      {/* 1. WELCOME HEADER */}
      <div className="p-6 sm:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personal Workspace</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {displayName ? `Welcome back, ${displayName} 👋` : "Welcome back 👋"}
          </h2>
          {!loading && (
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl leading-relaxed">
              {allHistory.length > 0 || resumes.length > 0 ? (
                <>
                  You&apos;ve completed{" "}
                  <strong className="text-slate-700">{allHistory.length} conversion{allHistory.length !== 1 ? "s" : ""}</strong>{" "}
                  and have{" "}
                  <strong className="text-slate-700">{resumes.length} saved resume{resumes.length !== 1 ? "s" : ""}</strong> in your account.
                </>
              ) : (
                "Your Saarvi workspace is ready. Start converting, compressing, or building your resume."
              )}
            </p>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex items-start sm:items-center gap-3 shrink-0">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="text-xs text-blue-950">
            <p className="font-bold">100% In-Browser Processing</p>
            <p className="text-[11px] text-blue-700">Your documents stay on your machine.</p>
          </div>
        </div>
      </div>

      {/* 2. ACTIVITY STATS */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Your Activity
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </>
          ) : (
            <>
              <StatCard
                value={allHistory.length}
                label="Total Conversions"
                icon={BarChart3}
                iconColor="text-blue-600"
                iconBg="bg-blue-50"
              />
              <StatCard
                value={successCount}
                label="Successful Conversions"
                icon={CheckCircle2}
                iconColor="text-emerald-600"
                iconBg="bg-emerald-50"
              />
              <StatCard
                value={resumes.length}
                label="Saved Resumes"
                icon={BookOpen}
                iconColor="text-violet-600"
                iconBg="bg-violet-50"
              />
            </>
          )}
        </div>
      </section>

      {/* STUDENT WORKSPACE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Student Workspace
              </h3>
              <p className="text-xs text-slate-500">Track your academics, applications, and productivity</p>
            </div>
          </div>
          <Link
            href="/student"
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 hover:underline"
          >
            <span>Explore Student Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Academic Snapshot Banner / Cards */}
        {!loading && (
          studentSummary.latestCgpa !== null && studentSummary.latestCgpa !== undefined ? (
            <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/80 rounded-3xl shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100/80 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                    <Award className="w-3 h-3" />
                    <span>VTU Academic Intelligence</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    Academic Snapshot
                  </h4>
                  <p className="text-xs text-slate-500">
                    Official VTU 2022 Scheme weighted score &amp; progression
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-2xs text-center min-w-[110px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Cumulative CGPA
                    </span>
                    <span className="text-xl font-extrabold text-blue-600">
                      {studentSummary.latestCgpa.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      {((studentSummary.latestCgpa - 0.75) * 10).toFixed(1)}% VTU
                    </span>
                  </div>

                  <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-2xs text-center min-w-[110px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Latest SGPA
                    </span>
                    <span className="text-xl font-extrabold text-indigo-600">
                      {studentSummary.latestSgpa ? studentSummary.latestSgpa.toFixed(2) : "—"}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      Term Average
                    </span>
                  </div>

                  <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-2xs text-center min-w-[110px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Semesters
                    </span>
                    <span className="text-xl font-extrabold text-slate-800">
                      {studentSummary.completedSemesters || 1} <span className="text-xs text-slate-400 font-normal">/ 8</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      Completed
                    </span>
                  </div>

                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <Link
                      href="/student/cgpa-calculator"
                      className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors text-center shadow-xs cursor-pointer"
                    >
                      Update CGPA
                    </Link>
                    <Link
                      href="/student/sgpa-calculator"
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors text-center shadow-2xs cursor-pointer"
                    >
                      Calculate SGPA
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-blue-50/60 border border-blue-100 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
                  <Award className="w-3.5 h-3.5" />
                  <span>VTU Academic Intelligence</span>
                </div>
                <p className="text-xs text-slate-600">
                  Preloaded 2022 Scheme curriculum for CSE, ISE, AIML &amp; ECE. Calculate your semester SGPA or project cumulative CGPA.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/student/sgpa-calculator"
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Calculate SGPA
                </Link>
                <Link
                  href="/student/cgpa-calculator"
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Setup CGPA
                </Link>
              </div>
            </div>
          )
        )}

        {/* 4 Student Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </>
          ) : (
            <>
              <Link href="/student/internships" className="group block">
                <StatCard
                  value={studentSummary.internshipsCount}
                  label="Tracked Internships"
                  icon={Briefcase}
                  iconColor="text-indigo-600 group-hover:scale-110 transition-transform"
                  iconBg="bg-indigo-50"
                />
              </Link>
              <Link href="/student/hackathons" className="group block">
                <StatCard
                  value={studentSummary.hackathonsCount}
                  label="Active Hackathons"
                  icon={Trophy}
                  iconColor="text-amber-600 group-hover:scale-110 transition-transform"
                  iconBg="bg-amber-50"
                />
              </Link>
              <Link href="/student/study-planner" className="group block">
                <StatCard
                  value={studentSummary.studyTasksUpcoming}
                  label="Study Sessions"
                  icon={Calendar}
                  iconColor="text-emerald-600 group-hover:scale-110 transition-transform"
                  iconBg="bg-emerald-50"
                />
              </Link>
              <Link href="/student/assignment-planner" className="group block">
                <StatCard
                  value={studentSummary.assignmentsUpcoming}
                  label="Pending Assignments"
                  icon={CheckSquare}
                  iconColor="text-purple-600 group-hover:scale-110 transition-transform"
                  iconBg="bg-purple-50"
                />
              </Link>
            </>
          )}
        </div>

        {/* Student Quick Launch Shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {[
            { label: "VTU SGPA", route: "/student/sgpa-calculator", icon: Calculator, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "VTU CGPA", route: "/student/cgpa-calculator", icon: Award, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Attendance Target", route: "/student/attendance", icon: Clock, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Resume Builder", route: "/student/resume", icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Timetable Grid", route: "/student/timetable", icon: Calendar, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Certificates", route: "/student/certificates", icon: Award, color: "text-rose-600", bg: "bg-rose-50" },
          ].map((item) => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.route}
                className="p-3 bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl shadow-2xs hover:shadow-xs transition-all text-center flex flex-col items-center gap-2 group"
              >
                <div className={`w-8 h-8 rounded-xl ${item.bg} ${item.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <ItemIcon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 line-clamp-1">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. QUICK TOOLS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Quick Tools
          </h3>
          <Link
            href="/tools"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
          >
            <span>View all tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.name}
                href={tool.route}
                className="group p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all hover-3d-lift cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold transition-transform group-hover:scale-105">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {tool.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {tool.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                      {tool.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center text-xs font-semibold text-blue-600 gap-1 mt-2">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Open tool</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform ml-auto" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CONVERSATIONS & WORKSPACE MEMORY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Conversations & Notes
              </h3>
              <p className="text-xs text-slate-500">Persistent local workspace memory (IndexedDB)</p>
            </div>
          </div>
          <Link
            href="/dashboard/conversations"
            className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 hover:underline"
          >
            <span>View all conversations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <SkeletonCard lines={2} />
        ) : recentConversations.length === 0 ? (
          <div className="p-6 bg-white border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">No conversations yet</h4>
              <p className="text-xs text-slate-500 max-w-lg">
                Start private conversations, study outlines, and interview prep notes. Stored 100% locally in your browser.
              </p>
            </div>
            <Link
              href="/dashboard/conversations"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Start Conversation</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentConversations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/conversations/${c.id}`}
                className="p-4 bg-white border border-slate-200/90 hover:border-purple-300 rounded-2xl shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                      {c.messageCount} msg{c.messageCount === 1 ? "" : "s"}
                    </span>
                    {c.pinned && (
                      <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-1">
                    {c.title}
                  </h4>
                  {c.summary && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {c.summary}
                    </p>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1 text-purple-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. TWO COLUMN: RECENT ACTIVITY & RESUMES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Col: Recent Activity */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Activity
            </h3>
            {recentHistory.length > 0 && (
              <Link
                href="/dashboard/history"
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                View all history →
              </Link>
            )}
          </div>

          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs min-h-[220px] flex flex-col justify-center">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/2 bg-slate-100 rounded" />
                      <div className="h-2.5 w-3/4 bg-slate-100 rounded" />
                    </div>
                    <div className="w-12 h-3 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : recentHistory.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No activity yet</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Use any tool to convert, compress, or edit files. Your conversion
                  metadata will automatically appear here.
                </p>
                <div className="pt-2">
                  <Link
                    href="/tools"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    Explore Tools
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentHistory.map((item) => (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.toolName || item.toolId.replace(/-/g, " ")}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {item.inputFilename} → {item.outputFilename}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-mono font-medium text-slate-600">
                        {formatBytes(item.outputSize)}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {(item.processingTimeMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Col: Saved Resumes */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Saved Resumes
            </h3>
            <Link
              href="/dashboard/resumes"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Manage ({resumes.length})
            </Link>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs min-h-[220px] flex flex-col justify-between">
            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2].map((i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 animate-pulse">
                    <div className="h-3 w-3/4 bg-slate-100 rounded mb-1.5" />
                    <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : resumes.length === 0 ? (
              <div className="text-center py-8 space-y-3 my-auto">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">No resumes saved yet</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Create an ATS-friendly resume draft for job and internship applications.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/dashboard/resumes"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Resume</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {resumes.slice(0, 3).map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{r.title}</p>
                      <p className="text-[10px] text-slate-400 capitalize">
                        {r.template.replace(/-/g, " ")}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/resumes"
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold shrink-0 transition-colors"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between mt-4">
              <span>ATS Classic • Modern • Student</span>
              <Link href="/dashboard/resumes" className="text-blue-600 font-bold hover:underline">
                Open Builder →
              </Link>
            </div>
          </div>
        </section>

      </div>

    </div>
  );
}
