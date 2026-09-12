"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { sanitizeUrl } from "@/lib/security/url-security";
import { HackathonRecord, HackathonStatus } from "@/types/student";
import {
  Trophy,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  Users,
  Clock,
  X,
  AlertCircle,
  Award,
} from "lucide-react";

const STATUS_CONFIG: { id: HackathonStatus; label: string; color: string }[] = [
  { id: "interested", label: "Interested", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "registered", label: "Registered", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "selected", label: "Selected", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "finalist", label: "Finalist", color: "bg-amber-50 text-amber-800 border-amber-200" },
  { id: "winner", label: "Winner 🏆", color: "bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold" },
  { id: "completed", label: "Completed", color: "bg-gray-100 text-gray-600 border-gray-200" },
];

export default function HackathonTrackerPage() {
  const [hackathons, setHackathons] = useState<HackathonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [teamName, setTeamName] = useState("");
  const [status, setStatus] = useState<HackathonStatus>("registered");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadHackathons = useCallback(async () => {
    try {
      const data = await studentService.getHackathons();
      setHackathons(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHackathons();
  }, [loadHackathons]);

  const filteredHackathons = useMemo(() => {
    return hackathons.filter((item) => {
      if (filterStatus === "all") return true;
      return item.status === filterStatus;
    });
  }, [hackathons, filterStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organizer.trim()) {
      setErrorMsg("Please enter both hackathon name and organizer.");
      return;
    }
    try {
      await studentService.saveHackathon({
        name: name.trim(),
        organizer: organizer.trim(),
        startDate,
        endDate,
        registrationDeadline: registrationDeadline || undefined,
        teamName: teamName.trim() || undefined,
        status,
        link: link.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setShowAddModal(false);
      setName("");
      setOrganizer("");
      setRegistrationDeadline("");
      setTeamName("");
      setLink("");
      setNotes("");
      loadHackathons();
    } catch {
      setErrorMsg("Couldn't save hackathon. Local copy preserved.");
    }
  };

  const handleStatusChange = async (id: string, newStatus: HackathonStatus) => {
    const item = hackathons.find((h) => h.id === id);
    if (!item) return;
    try {
      await studentService.saveHackathon({
        ...item,
        status: newStatus,
      });
      loadHackathons();
    } catch {
      // Error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await studentService.deleteHackathon(id);
      loadHackathons();
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
              <Trophy className="w-3.5 h-3.5" />
              <span>Competitions & Hackathons</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Hackathon Tracker
            </h1>
            <p className="text-sm text-slate-600">
              Track hackathon registrations, submission deadlines, team members, and project placements.
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
            <span>Track Hackathon</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[{ id: "all", label: "All Hackathons" }, ...STATUS_CONFIG].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilterStatus(opt.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                filterStatus === opt.id
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Hackathons List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white rounded-3xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : filteredHackathons.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No hackathons tracked yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Keep track of university hackathons, national coding contests, and open-source sprints.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Track Your First Hackathon</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHackathons.map((item) => {
              const statusCfg =
                STATUS_CONFIG.find((s) => s.id === item.status) || STATUS_CONFIG[1];

              return (
                <div
                  key={item.id}
                  className="p-5 bg-white border border-slate-200/90 rounded-3xl shadow-xs hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900">
                          {item.name}
                        </span>
                        {item.link && (
                          <a
                            href={sanitizeUrl(item.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600"
                            aria-label="Hackathon portal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-blue-700">
                        Organized by {item.organizer} {item.teamName && `• Team: ${item.teamName}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleStatusChange(item.id, e.target.value as HackathonStatus)
                        }
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${statusCfg.color}`}
                        aria-label="Change status"
                      >
                        {STATUS_CONFIG.map((opt) => (
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
                      Dates: {item.startDate} – {item.endDate}
                    </span>
                    {item.registrationDeadline && (
                      <span className="flex items-center gap-1 text-amber-800 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Registration Closes: {item.registrationDeadline}
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
            aria-labelledby="modal-hack-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 id="modal-hack-title" className="text-base font-bold text-slate-900">Track Hackathon</h3>
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
                  <label htmlFor="modal-hack-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Hackathon Name
                  </label>
                  <input
                    id="modal-hack-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Smart India Hackathon / HackMIT"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-hack-org" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Organizer / College
                    </label>
                    <input
                      id="modal-hack-org"
                      type="text"
                      required
                      value={organizer}
                      onChange={(e) => setOrganizer(e.target.value)}
                      placeholder="e.g. MIT / ACM Student Chapter"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-hack-status" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Status
                    </label>
                    <select
                      id="modal-hack-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as HackathonStatus)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {STATUS_CONFIG.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-hack-start" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Start Date
                    </label>
                    <input
                      id="modal-hack-start"
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-hack-end" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      End Date
                    </label>
                    <input
                      id="modal-hack-end"
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-hack-regdeadline" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Registration Cutoff
                    </label>
                    <input
                      id="modal-hack-regdeadline"
                      type="date"
                      value={registrationDeadline}
                      onChange={(e) => setRegistrationDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-hack-team" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Team Name
                    </label>
                    <input
                      id="modal-hack-team"
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Binary Beasts"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-hack-link" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Hackathon Portal Link (Optional)
                  </label>
                  <input
                    id="modal-hack-link"
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://devpost.com/..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-hack-notes" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Notes / Project Idea
                  </label>
                  <textarea
                    id="modal-hack-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. AI-powered local document indexing track"
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
                    Save Hackathon
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
