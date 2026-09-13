"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  CareerProfile,
  ResumeVersion,
  JobApplication,
  InterviewRecord,
  SkillGapAnalysis,
} from "@/types/career";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { careerService } from "@/lib/services/careerService";
import { formatCountdownText } from "@/lib/student/algorithms/deadline-engine";
import { AIJobDescriptionModal } from "@/components/career/AIJobDescriptionModal";
import {
  Briefcase,
  FileText,
  Calendar,
  Sparkles,
  TrendingUp,
  Award,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Clock,
  ArrowRight,
  Layers,
  ChevronRight,
  BookOpen,
  Check,
} from "lucide-react";

export default function CareerDashboardPage() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Skill Gap role selector
  const [selectedTargetRole, setSelectedTargetRole] = useState("Frontend Developer");
  const [showAiJdModal, setShowAiJdModal] = useState(false);

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");

  const refreshAll = useCallback(async () => {
    try {
      const [prof, rVers, apps, ints] = await Promise.all([
        careerService.getOrCreateProfile(),
        academicStorage.getAllResumeVersions(),
        academicStorage.getAllJobApplications(),
        academicStorage.getAllInterviews(),
      ]);
      setProfile(prof);
      setResumeVersions(rVers);
      setApplications(apps);
      setInterviews(ints);
    } catch (err) {
      console.error("Failed to load career dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Funnel counts
  const funnel = useMemo(() => {
    return careerService.calculateApplicationFunnel(applications);
  }, [applications]);

  // Deterministic insights
  const insights = useMemo(() => {
    if (!profile) return [];
    return careerService.generateCareerInsights({
      applications,
      interviews,
      versions: resumeVersions,
      profile,
    });
  }, [applications, interviews, resumeVersions, profile]);

  // Skill Gap Analysis
  const skillGap = useMemo<SkillGapAnalysis>(() => {
    const userSkillNames = profile ? profile.skills.map((s) => s.name) : [];
    return careerService.analyzeSkillGap(selectedTargetRole, userSkillNames);
  }, [selectedTargetRole, profile]);

  // Upcoming interviews (Scheduled & upcoming)
  const upcomingInterviews = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return interviews
      .filter((i) => i.date >= todayStr && i.status === "SCHEDULED")
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [interviews]);

  // Upcoming deadlines (Saved applications with approaching deadlines)
  const upcomingDeadlines = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return applications
      .filter((a) => a.deadline && a.deadline >= todayStr)
      .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
  }, [applications]);

  // Export JSON
  const handleExportJson = async () => {
    try {
      const json = await academicStorage.exportCareerWorkspace();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Saarvi_Career_Workspace_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setNotice("Career workspace exported.");
      setTimeout(() => setNotice(null), 2500);
    } catch {
      alert("Failed to export career workspace.");
    }
  };

  // Export CSV for applications
  const handleExportCsv = () => {
    if (applications.length === 0) {
      alert("No applications to export.");
      return;
    }
    const headers = ["Company", "Role", "Status", "Application Date", "Deadline", "Location", "Priority", "Notes"];
    const rows = applications.map((a) => [
      `"${(a.company || "").replace(/"/g, '""')}"`,
      `"${(a.role || "").replace(/"/g, '""')}"`,
      `"${a.status}"`,
      `"${a.applicationDate || ""}"`,
      `"${a.deadline || ""}"`,
      `"${(a.location || "").replace(/"/g, '""')}"`,
      `"${a.priority}"`,
      `"${(a.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Job_Applications_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setNotice("Applications exported to CSV.");
    setTimeout(() => setNotice(null), 2500);
  };

  // Import JSON
  const handleImportJson = async () => {
    if (!importJsonText.trim()) return;
    try {
      const res = await academicStorage.importCareerWorkspace(importJsonText);
      if (res.success) {
        setShowImportModal(false);
        setImportJsonText("");
        setNotice("Career workspace imported successfully.");
        setTimeout(() => setNotice(null), 3000);
        await refreshAll();
      } else {
        alert(`Import errors: ${res.errors.join(", ")}`);
      }
    } catch {
      alert("Malformed JSON payload.");
    }
  };

  // Reset Career Workspace
  const handleResetWorkspace = async () => {
    if (
      !confirm(
        "Are you sure you want to reset your career workspace? This removes career profiles, resumes, cover letters, applications, and interviews, but keeps your academic grades, timetable, and attendance intact."
      )
    ) {
      return;
    }
    await academicStorage.resetCareerWorkspace();
    setNotice("Career workspace reset.");
    setTimeout(() => setNotice(null), 3000);
    await refreshAll();
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-600">
        Loading Career Dashboard...
      </div>
    );
  }

  const activeOffers = applications.filter((a) => a.status === "OFFER").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      {notice && (
        <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm font-medium shadow-sm transition-all">
          {notice}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
          <Link href="/student/dashboard" className="hover:text-blue-600 transition-colors">
            Student Hub
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Career Suite</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Career & Placement Suite</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Local-First
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Connect your academic records, projects, hackathons, and certifications to targeted resumes and interview tracking.
            </p>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/student/resume"
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Resume Builder
            </Link>

            <Link
              href="/student/applications"
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Briefcase className="w-4 h-4 mr-1.5 text-slate-500" />
              Applications
            </Link>

            <Link
              href="/student/cover-letter"
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-slate-500" />
              Cover Letters
            </Link>
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 my-6">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Resumes</span>
            <strong className="text-xl font-bold text-slate-900 mt-1 block">{resumeVersions.length}</strong>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Applications</span>
            <strong className="text-xl font-bold text-blue-600 mt-1 block">{applications.length}</strong>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Interviews</span>
            <strong className="text-xl font-bold text-amber-600 mt-1 block">{upcomingInterviews.length}</strong>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Offers</span>
            <strong className="text-xl font-bold text-emerald-600 mt-1 block">{activeOffers}</strong>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Projects</span>
            <strong className="text-xl font-bold text-slate-900 mt-1 block">{profile.projects.length}</strong>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Certificates</span>
            <strong className="text-xl font-bold text-slate-900 mt-1 block">{profile.certifications.length}</strong>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Hackathons</span>
            <strong className="text-xl font-bold text-slate-900 mt-1 block">{profile.hackathons.length}</strong>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
            <span className="text-xs text-slate-500 block font-medium">Skills</span>
            <strong className="text-xl font-bold text-slate-900 mt-1 block">{profile.skills.length}</strong>
          </div>
        </div>

        {/* Deterministic Insights Banner */}
        {insights.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50/70 border border-blue-200 rounded-xl shadow-sm space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Career Workspace Insights</span>
            </div>
            <ul className="space-y-1 text-xs text-blue-800 list-disc list-inside">
              {insights.map((ins, idx) => (
                <li key={idx}>{ins}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Application Funnel Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Application Pipeline Funnel
              </h2>
            </div>
            <Link
              href="/student/applications"
              className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center"
            >
              View Pipeline <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 italic">
              No applications tracked yet. Add job or internship opportunities to see pipeline metrics.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <span className="text-xs text-slate-500 block">Saved</span>
                <strong className="text-lg font-bold text-slate-700">{funnel.SAVED}</strong>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <span className="text-xs text-blue-700 block">Applied</span>
                <strong className="text-lg font-bold text-blue-900">{funnel.APPLIED}</strong>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                <span className="text-xs text-purple-700 block">Assessment</span>
                <strong className="text-lg font-bold text-purple-900">{funnel.ONLINE_ASSESSMENT}</strong>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <span className="text-xs text-amber-800 block">Interview</span>
                <strong className="text-lg font-bold text-amber-900">{funnel.INTERVIEW}</strong>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                <span className="text-xs text-emerald-800 block">Offer</span>
                <strong className="text-lg font-bold text-emerald-900">{funnel.OFFER}</strong>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Section: Upcoming Schedules & Skill Gap Matching */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Left: Upcoming Deadlines & Interviews */}
          <div className="lg:col-span-6 space-y-6">
            {/* Upcoming Interviews */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  Upcoming Scheduled Interviews
                </h3>
                <span className="text-xs font-semibold text-slate-500">{upcomingInterviews.length}</span>
              </div>

              {upcomingInterviews.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  No upcoming interviews scheduled.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingInterviews.slice(0, 4).map((intv) => (
                    <div
                      key={intv.id}
                      className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <strong className="text-xs text-slate-900 block">{intv.company} — {intv.round}</strong>
                        <span className="text-[11px] text-slate-600">
                          {intv.date} at {intv.time || "10:00"} ({intv.type})
                        </span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                        {formatCountdownText(intv.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approaching Application Deadlines */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Approaching Application Deadlines
                </h3>
                <span className="text-xs font-semibold text-slate-500">{upcomingDeadlines.length}</span>
              </div>

              {upcomingDeadlines.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  No pending application deadlines.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingDeadlines.slice(0, 4).map((app) => (
                    <div
                      key={app.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <strong className="text-xs text-slate-900 block">{app.role}</strong>
                        <span className="text-[11px] text-slate-500">{app.company}</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {formatCountdownText(app.deadline!)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Skill Gap Analysis View */}
          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-purple-600" />
                    Target Role Skill Gap Analysis
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deterministic comparison of your profile skills against role expectations.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAiJdModal(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 shadow-2xs"
                    title="Analyze specific job description with AI"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    AI Match JD
                  </button>

                  <select
                    value={selectedTargetRole}
                    onChange={(e) => setSelectedTargetRole(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-800 font-semibold focus:outline-none"
                  >
                    <option value="Frontend Developer">Frontend Developer</option>
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Backend Developer">Backend Developer</option>
                    <option value="Full Stack Developer">Full Stack Developer</option>
                    <option value="Data Scientist">Data Scientist</option>
                    <option value="DevOps Engineer">DevOps Engineer</option>
                    <option value="Mobile Developer">Mobile Developer</option>
                  </select>
                </div>
              </div>

              {/* Match Percentage */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Role Skill Coverage</span>
                  <strong className="text-slate-900 font-bold">{skillGap.matchPercentage}%</strong>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      skillGap.matchPercentage >= 70
                        ? "bg-emerald-500"
                        : skillGap.matchPercentage >= 40
                        ? "bg-blue-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${skillGap.matchPercentage}%` }}
                  />
                </div>
              </div>

              {/* Matched Skills */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-emerald-800 block mb-1">
                    Matched Skills ({skillGap.matchedSkills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {skillGap.matchedSkills.map((sk) => (
                      <span
                        key={sk}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800"
                      >
                        <Check className="w-3 h-3 mr-1 text-emerald-600" />
                        {sk}
                      </span>
                    ))}
                    {skillGap.matchedSkills.length === 0 && (
                      <span className="text-slate-400 italic">No direct matches found.</span>
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div>
                  <span className="font-semibold text-rose-800 block mb-1">
                    Recommended to Learn ({skillGap.missingSkills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {skillGap.missingSkills.map((sk) => (
                      <span
                        key={sk}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Optional Strengths */}
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">
                    Optional / Nice to Have ({skillGap.optionalSkills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {skillGap.optionalSkills.map((sk) => (
                      <span
                        key={sk}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <Link
                href="/student/resume"
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center"
              >
                Manage Profile Skills <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Workspace Backup, Export & Reset Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <strong className="text-sm text-slate-900 block">Career Workspace Data & Privacy</strong>
            <p className="text-xs text-slate-500 mt-0.5">
              All profile, resume, and application data remains strictly local in your browser IndexedDB.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportJson}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Export JSON
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Export CSV
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              Import Workspace
            </button>

            <button
              onClick={handleResetWorkspace}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Reset Workspace
            </button>
          </div>
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200/90">
            <h3 className="text-lg font-bold text-slate-900">Import Career Workspace</h3>
            <p className="text-xs text-slate-600">
              Paste your exported JSON backup below. This will restore your career profile, resumes, and applications.
            </p>
            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON workspace payload here..."
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleImportJson}
                disabled={!importJsonText.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Restore Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Job Description Modal */}
      {showAiJdModal && profile && (
        <AIJobDescriptionModal
          isOpen={showAiJdModal}
          onClose={() => setShowAiJdModal(false)}
          candidateSkills={profile.skills.map((s) => s.name)}
        />
      )}

      <Footer />
    </div>
  );
}
