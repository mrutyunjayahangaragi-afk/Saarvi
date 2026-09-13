"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { sanitizeUrl } from "@/lib/security/url-security";
import { InternshipApplication, InternshipStatus } from "@/types/student";
import {
  Briefcase,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  MapPin,
  Building,
  Clock,
  X,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

const STATUS_OPTIONS: { id: InternshipStatus; label: string; color: string }[] = [
  { id: "interested", label: "Interested", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "applied", label: "Applied", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "assessment", label: "Assessment", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "interview", label: "Interview", color: "bg-amber-50 text-amber-800 border-amber-200" },
  { id: "offer", label: "Offer Received", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "rejected", label: "Rejected", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "withdrawn", label: "Withdrawn", color: "bg-gray-100 text-gray-500 border-gray-200" },
];

export default function InternshipTrackerPage() {
  const [internships, setInternships] = useState<InternshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [applicationDate, setApplicationDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<InternshipStatus>("applied");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadInternships = useCallback(async () => {
    try {
      const data = await studentService.getInternships();
      setInternships(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInternships();
  }, [loadInternships]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Real Metrics Calculation (No fake numbers!)
  const stats = useMemo(() => {
    const totalApplied = internships.filter((i) => i.status !== "interested").length;
    const interviews = internships.filter((i) => i.status === "interview").length;
    const offers = internships.filter((i) => i.status === "offer").length;
    const upcomingDeadlines = internships.filter(
      (i) => i.deadline && i.deadline >= todayStr && i.status !== "rejected" && i.status !== "withdrawn"
    ).length;

    return { totalApplied, interviews, offers, upcomingDeadlines };
  }, [internships, todayStr]);

  const filteredInternships = useMemo(() => {
    return internships.filter((item) => {
      if (filterStatus === "all") return true;
      return item.status === filterStatus;
    });
  }, [internships, filterStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      setErrorMsg("Please enter both company name and role.");
      return;
    }
    try {
      await studentService.saveInternship({
        company: company.trim(),
        role: role.trim(),
        location: location.trim() || undefined,
        applicationDate,
        deadline: deadline || undefined,
        status,
        link: link.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setShowAddModal(false);
      setCompany("");
      setRole("");
      setLocation("");
      setDeadline("");
      setLink("");
      setNotes("");
      loadInternships();
    } catch {
      setErrorMsg("Couldn't save internship. Local changes preserved.");
    }
  };

  const handleStatusChange = async (id: string, newStatus: InternshipStatus) => {
    const item = internships.find((i) => i.id === id);
    if (!item) return;
    try {
      await studentService.saveInternship({
        ...item,
        status: newStatus,
      });
      loadInternships();
    } catch {
      // Error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await studentService.deleteInternship(id);
      loadInternships();
    } catch {
      // Error
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Career Tracker</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Internship Tracker
            </h1>
            <p className="text-sm text-slate-600">
              Track your summer internships, co-ops, and early career applications from initial interest to offer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Track Application</span>
          </button>
        </div>

        {/* Real Stats Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Applications
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats.totalApplied}
            </div>
            <div className="text-[11px] text-slate-500">submitted so far</div>
          </div>

          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Interviews
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">
              {stats.interviews}
            </div>
            <div className="text-[11px] text-slate-500">active rounds</div>
          </div>

          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Offers
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              {stats.offers}
            </div>
            <div className="text-[11px] text-slate-500">secured offers</div>
          </div>

          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Deadlines
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-600">
              {stats.upcomingDeadlines}
            </div>
            <div className="text-[11px] text-slate-500">upcoming cutoffs</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[{ id: "all", label: "All Records" }, ...STATUS_OPTIONS].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilterStatus(opt.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                filterStatus === opt.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white rounded-3xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : filteredInternships.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No applications yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start tracking companies you want to apply to or roles where you have already submitted your resume.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Track Your First Application</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInternships.map((item) => {
              const statusCfg =
                STATUS_OPTIONS.find((s) => s.id === item.status) || STATUS_OPTIONS[1];

              return (
                <div
                  key={item.id}
                  className="p-5 bg-white border border-slate-200/90 rounded-3xl shadow-xs hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900">
                          {item.company}
                        </span>
                        {item.link && (
                          <a
                            href={sanitizeUrl(item.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600"
                            aria-label="Job link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-blue-700">
                        {item.role} {item.location && `• ${item.location}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleStatusChange(item.id, e.target.value as InternshipStatus)
                        }
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${statusCfg.color}`}
                        aria-label="Change status"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Applied: {item.applicationDate}
                    </span>
                    {item.deadline && (
                      <span className="flex items-center gap-1 text-amber-800 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Deadline: {item.deadline}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {item.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-intern-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 id="modal-intern-title" className="text-base font-bold text-slate-900">Track Internship Application</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close modal"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="modal-intern-company" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Company Name
                  </label>
                  <input
                    id="modal-intern-company"
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Google, Microsoft, Startup"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-intern-role" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Role / Position
                  </label>
                  <input
                    id="modal-intern-role"
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Software Engineer Intern 2026"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-intern-appdate" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Application Date
                    </label>
                    <input
                      id="modal-intern-appdate"
                      type="date"
                      required
                      value={applicationDate}
                      onChange={(e) => setApplicationDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-intern-deadline" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Deadline (Optional)
                    </label>
                    <input
                      id="modal-intern-deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-intern-status" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Status
                    </label>
                    <select
                      id="modal-intern-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as InternshipStatus)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-intern-location" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Location
                    </label>
                    <input
                      id="modal-intern-location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Remote / New York"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-intern-link" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Job Post URL (Optional)
                  </label>
                  <input
                    id="modal-intern-link"
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-intern-notes" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Notes
                  </label>
                  <textarea
                    id="modal-intern-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Referred by alum; OA completed on Sep 10"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Save Application
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
