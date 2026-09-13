"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  JobApplication,
  JobApplicationStatus,
  JobApplicationPriority,
  InterviewRecord,
  InterviewType,
  ResumeVersion,
  CoverLetterVersion,
} from "@/types/career";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { sanitizeUrl } from "@/lib/security/url-security";
import {
  classifyDeadlineUrgency,
  calculateDaysRemaining,
  formatCountdownText,
} from "@/lib/student/algorithms/deadline-engine";
import { notificationService } from "@/lib/services/notificationService";
import {
  Briefcase,
  Search,
  Filter,
  Plus,
  Calendar,
  Clock,
  ExternalLink,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Layers,
  ChevronRight,
  ShieldCheck,
  Building,
  MapPin,
  FileText,
  Eye,
  Check,
} from "lucide-react";

const STATUS_CONFIG: Record<
  JobApplicationStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  SAVED: { label: "Saved", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  APPLIED: { label: "Applied", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  ONLINE_ASSESSMENT: { label: "Assessment", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  INTERVIEW: { label: "Interview", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  OFFER: { label: "Offer", bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  REJECTED: { label: "Rejected", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  WITHDRAWN: { label: "Withdrawn", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

const ALL_STATUSES: JobApplicationStatus[] = [
  "SAVED",
  "APPLIED",
  "ONLINE_ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

const INTERVIEW_TYPES: InterviewType[] = [
  "Online",
  "Phone",
  "Technical",
  "HR",
  "Managerial",
  "Other",
];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [coverLetters, setCoverLetters] = useState<CoverLetterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Search, filter, and sort
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"deadline" | "date" | "company" | "priority">("deadline");

  // View mode
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");

  // Modals
  const [showAppModal, setShowAppModal] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewTargetApp, setInterviewTargetApp] = useState<JobApplication | null>(null);

  // Application Form State
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formAppDate, setFormAppDate] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formJobUrl, setFormJobUrl] = useState("");
  const [formStatus, setFormStatus] = useState<JobApplicationStatus>("SAVED");
  const [formPriority, setFormPriority] = useState<JobApplicationPriority>("medium");
  const [formNotes, setFormNotes] = useState("");
  const [formFollowUpDate, setFormFollowUpDate] = useState("");
  const [formResumeVersionId, setFormResumeVersionId] = useState("");
  const [formCoverLetterId, setFormCoverLetterId] = useState("");
  const [formSalary, setFormSalary] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formScheduleDeadlineReminder, setFormScheduleDeadlineReminder] = useState(false);

  // Interview Form State
  const [intRound, setIntRound] = useState("Technical Round 1");
  const [intDate, setIntDate] = useState("");
  const [intTime, setIntTime] = useState("10:00");
  const [intType, setIntType] = useState<InterviewType>("Technical");
  const [intLocation, setIntLocation] = useState("");
  const [intNotes, setIntNotes] = useState("");
  const [intScheduleReminder, setIntScheduleReminder] = useState(true);

  // Load stored applications, interviews, and versions
  const refreshData = useCallback(async () => {
    try {
      const [apps, ints, rVers, cLets] = await Promise.all([
        academicStorage.getAllJobApplications(),
        academicStorage.getAllInterviews(),
        academicStorage.getAllResumeVersions(),
        academicStorage.getAllCoverLetterVersions(),
      ]);
      setApplications(apps);
      setInterviews(ints);
      setResumeVersions(rVers);
      setCoverLetters(cLets);
    } catch (err) {
      console.error("Failed to load application data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Open modal to add application
  const handleOpenAddModal = () => {
    setEditingApp(null);
    setFormCompany("");
    setFormRole("");
    setFormAppDate(new Date().toISOString().split("T")[0]);
    setFormDeadline("");
    setFormLocation("");
    setFormJobUrl("");
    setFormStatus("SAVED");
    setFormPriority("medium");
    setFormNotes("");
    setFormFollowUpDate("");
    setFormResumeVersionId(resumeVersions[0]?.id || "");
    setFormCoverLetterId(coverLetters[0]?.id || "");
    setFormSalary("");
    setFormSource("");
    setFormScheduleDeadlineReminder(false);
    setShowAppModal(true);
  };

  // Open modal to edit application
  const handleOpenEditModal = (app: JobApplication) => {
    setEditingApp(app);
    setFormCompany(app.company);
    setFormRole(app.role);
    setFormAppDate(app.applicationDate);
    setFormDeadline(app.deadline || "");
    setFormLocation(app.location || "");
    setFormJobUrl(app.jobUrl || "");
    setFormStatus(app.status);
    setFormPriority(app.priority);
    setFormNotes(app.notes || "");
    setFormFollowUpDate(app.followUpDate || "");
    setFormResumeVersionId(app.resumeVersionId || "");
    setFormCoverLetterId(app.coverLetterId || "");
    setFormSalary(app.salary || "");
    setFormSource(app.source || "");
    setFormScheduleDeadlineReminder(false);
    setShowAppModal(true);
  };

  // Save Application
  const handleSaveApplication = async () => {
    if (!formCompany.trim() || !formRole.trim()) {
      alert("Please enter company name and role.");
      return;
    }

    const now = new Date().toISOString();
    const appId = editingApp ? editingApp.id : `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Update timeline events
    let events = editingApp?.events ? [...editingApp.events] : [];
    if (!editingApp || editingApp.status !== formStatus) {
      events.push({
        id: `ev_${Date.now()}`,
        status: formStatus,
        date: formAppDate || now.split("T")[0],
        notes: `Stage changed to ${formStatus}`,
      });
    }

    const appRecord: JobApplication = {
      id: appId,
      company: formCompany.trim(),
      role: formRole.trim(),
      applicationDate: formAppDate || now.split("T")[0],
      deadline: formDeadline || undefined,
      location: formLocation || undefined,
      jobUrl: formJobUrl || undefined,
      status: formStatus,
      priority: formPriority,
      notes: formNotes || undefined,
      followUpDate: formFollowUpDate || undefined,
      resumeVersionId: formResumeVersionId || undefined,
      coverLetterId: formCoverLetterId || undefined,
      salary: formSalary || undefined,
      source: formSource || undefined,
      events,
      createdAt: editingApp ? editingApp.createdAt : now,
      updatedAt: now,
    };

    await academicStorage.saveJobApplication(appRecord);

    // Schedule notification if selected and deadline exists
    if (formScheduleDeadlineReminder && formDeadline) {
      try {
        await notificationService.scheduleReminder({
          eventId: appId,
          eventType: "application",
          eventTitle: `Application Deadline: ${appRecord.company} (${appRecord.role})`,
          scheduledDate: formDeadline,
          reminderTiming: "1_day_before",
        });
      } catch {}
    }

    setShowAppModal(false);
    setNotice(editingApp ? "Application updated." : "New application tracked.");
    setTimeout(() => setNotice(null), 2500);
    await refreshData();
  };

  // Delete Application
  const handleDeleteApplication = async (id: string) => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    await academicStorage.deleteJobApplication(id);
    setNotice("Application deleted.");
    setTimeout(() => setNotice(null), 2500);
    await refreshData();
  };

  // Update Status directly from board
  const handleQuickStatusChange = async (app: JobApplication, newStatus: JobApplicationStatus) => {
    const now = new Date().toISOString();
    const updated: JobApplication = {
      ...app,
      status: newStatus,
      events: [
        ...app.events,
        {
          id: `ev_${Date.now()}`,
          status: newStatus,
          date: now.split("T")[0],
          notes: `Moved to ${newStatus}`,
        },
      ],
      updatedAt: now,
    };
    await academicStorage.saveJobApplication(updated);
    await refreshData();
  };

  // Open Interview Modal
  const handleOpenInterviewModal = (app: JobApplication) => {
    setInterviewTargetApp(app);
    setIntRound("Technical Round 1");
    setIntDate(new Date().toISOString().split("T")[0]);
    setIntTime("10:00");
    setIntType("Technical");
    setIntLocation("");
    setIntNotes("");
    setIntScheduleReminder(true);
    setShowInterviewModal(true);
  };

  // Save Interview
  const handleSaveInterview = async () => {
    if (!interviewTargetApp || !intDate) {
      alert("Please select interview date.");
      return;
    }

    const now = new Date().toISOString();
    const intId = `intv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newInterview: InterviewRecord = {
      id: intId,
      applicationId: interviewTargetApp.id,
      company: interviewTargetApp.company,
      role: interviewTargetApp.role,
      round: intRound,
      date: intDate,
      time: intTime,
      type: intType,
      locationOrLink: intLocation || undefined,
      notes: intNotes || undefined,
      status: "SCHEDULED",
      reminderScheduled: intScheduleReminder,
      createdAt: now,
      updatedAt: now,
    };

    await academicStorage.saveInterview(newInterview);

    // If application not in INTERVIEW status, update it automatically
    if (interviewTargetApp.status !== "INTERVIEW") {
      await handleQuickStatusChange(interviewTargetApp, "INTERVIEW");
    }

    // Schedule notification
    if (intScheduleReminder && intDate) {
      try {
        await notificationService.scheduleReminder({
          eventId: intId,
          eventType: "interview",
          eventTitle: `Interview with ${interviewTargetApp.company}: ${intRound}`,
          scheduledDate: intDate,
          scheduledTime: intTime,
          reminderTiming: "2_hours_before",
        });
      } catch {}
    }

    setShowInterviewModal(false);
    setNotice(`Interview scheduled for ${intDate}.`);
    setTimeout(() => setNotice(null), 2500);
    await refreshData();
  };

  // Filtered and Sorted Applications
  const processedApplications = useMemo(() => {
    return applications
      .filter((app) => {
        // Status filter
        if (statusFilter !== "ALL" && app.status !== statusFilter) return false;

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCompany = app.company.toLowerCase().includes(q);
          const matchRole = app.role.toLowerCase().includes(q);
          const matchLocation = app.location?.toLowerCase().includes(q);
          const matchNotes = app.notes?.toLowerCase().includes(q);
          return matchCompany || matchRole || matchLocation || matchNotes;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "deadline") {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        }
        if (sortBy === "date") {
          return (b.applicationDate || "").localeCompare(a.applicationDate || "");
        }
        if (sortBy === "company") {
          return a.company.localeCompare(b.company);
        }
        if (sortBy === "priority") {
          const pOrder = { high: 3, medium: 2, low: 1 };
          return pOrder[b.priority] - pOrder[a.priority];
        }
        return 0;
      });
  }, [applications, statusFilter, searchQuery, sortBy]);

  // Upcoming Interviews List
  const upcomingInterviews = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return interviews
      .filter((i) => i.date >= todayStr && i.status === "SCHEDULED")
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [interviews]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-600">
        Loading Application Tracker...
      </div>
    );
  }

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
          <span className="text-slate-800 font-medium">Application Tracker</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Application Tracker</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Local-First
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Track job & internship pipelines, deadlines, scheduled interviews, and follow-ups securely.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setViewMode("pipeline")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  viewMode === "pipeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Pipeline View
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Table View
              </button>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Opportunity
            </button>
          </div>
        </div>

        {/* Top Upcoming Alert Banner (if interviews exist) */}
        {upcomingInterviews.length > 0 && (
          <div className="my-6 p-4 bg-amber-50/80 border border-amber-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-sm text-amber-900 block">
                  Next Interview: {upcomingInterviews[0].company} ({upcomingInterviews[0].round})
                </strong>
                <span className="text-xs text-amber-700">
                  Scheduled on {upcomingInterviews[0].date} at {upcomingInterviews[0].time || "10:00"}
                  {upcomingInterviews[0].locationOrLink ? ` • ${upcomingInterviews[0].locationOrLink}` : ""}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 bg-amber-200/70 text-amber-900 rounded-full">
              <Clock className="w-3.5 h-3.5 mr-1" />
              {formatCountdownText(upcomingInterviews[0].date)}
            </span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm my-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, role, location, or notes..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses ({applications.length})</option>
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label} ({applications.filter((a) => a.status === st).length})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="deadline">Deadline</option>
                <option value="date">Applied Date</option>
                <option value="company">Company</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empty State when 0 applications tracked */}
        {applications.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3 mb-8 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No applications tracked yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Track off-campus opportunities, referral pipelines, interviews, and deadlines in one place.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Track Your First Opportunity</span>
            </button>
          </div>
        ) : (
          <>
            {/* PIPELINE VIEW */}
            {viewMode === "pipeline" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">
            {ALL_STATUSES.slice(0, 5).map((status) => {
              const statusApps = processedApplications.filter((a) => a.status === status);
              const conf = STATUS_CONFIG[status];

              return (
                <div key={status} className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 flex flex-col min-h-[400px]">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${conf.bg.replace("50", "500")}`} />
                      {conf.label}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                      {statusApps.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {statusApps.map((app) => {
                      const daysRem = app.deadline ? calculateDaysRemaining(app.deadline) : null;
                      const urgency = app.deadline ? classifyDeadlineUrgency(app.deadline) : null;
                      const appInterviews = interviews.filter((i) => i.applicationId === app.id);

                      return (
                        <div
                          key={app.id}
                          className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm hover:shadow-md transition-shadow relative group"
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <strong className="text-sm text-slate-900 leading-snug line-clamp-1">
                              {app.role}
                            </strong>
                            <button
                              onClick={() => handleOpenEditModal(app)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs text-slate-600 font-medium flex items-center gap-1 mb-2">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            {app.company}
                          </div>

                          {/* Deadline & Location Chips */}
                          <div className="space-y-1 text-[11px] mb-3">
                            {app.deadline && (
                              <div
                                className={`flex items-center justify-between px-2 py-0.5 rounded font-medium ${
                                  urgency === "overdue"
                                    ? "bg-rose-50 text-rose-700"
                                    : urgency === "today"
                                    ? "bg-amber-50 text-amber-800"
                                    : "bg-slate-50 text-slate-600"
                                }`}
                              >
                                <span>Deadline:</span>
                                <span>{formatCountdownText(app.deadline)}</span>
                              </div>
                            )}

                            {app.location && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{app.location}</span>
                              </div>
                            )}
                          </div>

                          {/* Interviews Pill if present */}
                          {appInterviews.length > 0 && (
                            <div className="p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 mb-2">
                              <strong>{appInterviews[0].round}</strong>: {appInterviews[0].date}
                            </div>
                          )}

                          {/* Actions: Log Interview & Transition Status */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => handleOpenInterviewModal(app)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                            >
                              <Calendar className="w-3 h-3" /> Interview
                            </button>

                            <select
                              value={app.status}
                              onChange={(e) => handleQuickStatusChange(app, e.target.value as JobApplicationStatus)}
                              className="text-[10px] border border-slate-200 rounded p-1 bg-slate-50 text-slate-600"
                            >
                              {ALL_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {STATUS_CONFIG[st].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    {statusApps.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-400 italic">
                        No applications
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === "table" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs text-slate-700 min-w-[640px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Role & Company</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedApplications.map((app) => {
                  const conf = STATUS_CONFIG[app.status];
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="text-slate-900 block text-sm">{app.role}</strong>
                        <span className="text-slate-500">{app.company}</span>
                        {app.jobUrl && (
                          <a
                            href={sanitizeUrl(app.jobUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-[11px] text-blue-600 hover:underline ml-2"
                          >
                            Job Link <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${conf.bg} ${conf.text} border ${conf.border}`}>
                          {conf.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{app.applicationDate || "—"}</td>
                      <td className="py-3 px-4">
                        {app.deadline ? (
                          <span className="font-medium text-slate-800">
                            {formatCountdownText(app.deadline)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-slate-600">{app.priority}</span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenInterviewModal(app)}
                          className="text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Interview
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(app)}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteApplication(app.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {processedApplications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No applications found matching the criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Add / Edit Application Modal */}
      {showAppModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200/90">
            <h3 className="text-lg font-bold text-slate-900">
              {editingApp ? "Edit Opportunity" : "Track New Job or Internship"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Company *</label>
                <input
                  type="text"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="e.g. Microsoft"
                  className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Role *</label>
                <input
                  type="text"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g. Software Engineer Intern"
                  className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as JobApplicationStatus)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                >
                  {ALL_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_CONFIG[st].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as JobApplicationPriority)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Application Date</label>
                <input
                  type="date"
                  value={formAppDate}
                  onChange={(e) => setFormAppDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Application Deadline</label>
                <input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Location</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Bengaluru / Remote"
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Job / Listing URL</label>
                <input
                  type="text"
                  value={formJobUrl}
                  onChange={(e) => setFormJobUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
            </div>

            {/* Document Linking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Linked Resume Version</label>
                <select
                  value={formResumeVersionId}
                  onChange={(e) => setFormResumeVersionId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                >
                  <option value="">None Selected</option>
                  {resumeVersions.map((rv) => (
                    <option key={rv.id} value={rv.id}>
                      {rv.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Linked Cover Letter</label>
                <select
                  value={formCoverLetterId}
                  onChange={(e) => setFormCoverLetterId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                >
                  <option value="">None Selected</option>
                  {coverLetters.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Follow-up date & Notification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Follow-Up Date</label>
                <input
                  type="date"
                  value={formFollowUpDate}
                  onChange={(e) => setFormFollowUpDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="notif_chk"
                  checked={formScheduleDeadlineReminder}
                  onChange={(e) => setFormScheduleDeadlineReminder(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="notif_chk" className="text-xs text-slate-700 font-medium">
                  Remind 1 day before deadline (Free Email)
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Notes & Details</label>
              <textarea
                rows={3}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Key requirements, referral info, interview observations..."
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAppModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApplication}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Save Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showInterviewModal && interviewTargetApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200/90">
            <h3 className="text-lg font-bold text-slate-900">
              Schedule Interview with {interviewTargetApp.company}
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Round Description</label>
              <input
                type="text"
                value={intRound}
                onChange={(e) => setIntRound(e.target.value)}
                placeholder="e.g. Coding Round / HR Interview"
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Date *</label>
                <input
                  type="date"
                  value={intDate}
                  onChange={(e) => setIntDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Time</label>
                <input
                  type="time"
                  value={intTime}
                  onChange={(e) => setIntTime(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Type</label>
                <select
                  value={intType}
                  onChange={(e) => setIntType(e.target.value as InterviewType)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Link / Location</label>
                <input
                  type="text"
                  value={intLocation}
                  onChange={(e) => setIntLocation(e.target.value)}
                  placeholder="e.g. Google Meet link"
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="int_rem_chk"
                checked={intScheduleReminder}
                onChange={(e) => setIntScheduleReminder(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="int_rem_chk" className="text-xs text-slate-700 font-medium">
                Schedule planning reminder (Free Email, optional WhatsApp)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowInterviewModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInterview}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
