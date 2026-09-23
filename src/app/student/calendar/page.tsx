"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  CalendarEvent,
  CalendarEventType,
  EVENT_TYPE_METADATA,
  ExpandedCalendarEventInstance,
  generateIcsCalendar,
} from "@/lib/calendar/calendar-model";
import { calendarStorage } from "@/lib/calendar/calendar-storage";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  AlertTriangle,
  Download,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  GraduationCap,
  Briefcase,
  Sparkles,
  FileText,
  Award,
  BookOpen,
  Video,
  Bell,
  ArrowRight,
  Filter,
} from "lucide-react";

type CalendarViewMode = "month" | "week" | "day" | "agenda";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SmartCalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [instances, setInstances] = useState<ExpandedCalendarEventInstance[]>([]);
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [conflictingIds, setConflictingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Editor Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<CalendarEventType>("academic");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high">("medium");

  // Calculate window start and end based on current date & view
  const { windowStart, windowEnd } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    if (viewMode === "month") {
      // Pad to cover 42 grid cells (previous month overlap + current + next month overlap)
      const firstDay = new Date(y, m, 1);
      const startDayOfWeek = firstDay.getDay();
      const start = new Date(firstDay);
      start.setDate(start.getDate() - startDayOfWeek);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 42);
      end.setHours(23, 59, 59, 999);
      return { windowStart: start, windowEnd: end };
    } else if (viewMode === "week") {
      const dayOfWeek = currentDate.getDay();
      const start = new Date(currentDate);
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { windowStart: start, windowEnd: end };
    } else if (viewMode === "day") {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return { windowStart: start, windowEnd: end };
    } else {
      // Agenda: Next 60 days
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 60);
      end.setHours(23, 59, 59, 999);
      return { windowStart: start, windowEnd: end };
    }
  }, [currentDate, viewMode]);

  // Load consolidated events
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsList, consolidated] = await Promise.all([
        calendarStorage.getCalendarEvents(),
        calendarStorage.getConsolidatedEvents(windowStart, windowEnd),
      ]);
      setRawEvents(eventsList);
      setInstances(consolidated.instances);
      setConflictingIds(consolidated.conflictingIds);
    } catch (err) {
      console.error("Failed to load calendar events:", err);
    } finally {
      setLoading(false);
    }
  }, [windowStart, windowEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter instances by type
  const filteredInstances = useMemo(() => {
    if (selectedTypeFilter === "ALL") return instances;
    return instances.filter((i) => i.event.type === selectedTypeFilter);
  }, [instances, selectedTypeFilter]);

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() - 1);
    else if (viewMode === "week") next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Sync Timetable
  const handleSyncTimetable = async () => {
    try {
      await calendarStorage.syncWithTimetable();
      await loadData();
      setNotice("Weekly timetable synchronized into Smart Academic Calendar.");
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice("Could not sync timetable. Check local entries.");
    }
  };

  // Export ICS
  const handleExportIcs = () => {
    try {
      const ics = generateIcsCalendar(rawEvents, "Saarvi Smart Academic Calendar");
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saarvi-calendar-${new Date().toISOString().split("T")[0]}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice("iCalendar (.ics) downloaded. Compatible with Apple Calendar, Outlook, and Google Calendar.");
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice("Failed to generate ICS calendar file.");
    }
  };

  // Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const startAt = formAllDay
      ? `${formDate}T00:00:00.000Z`
      : new Date(`${formDate}T${formStartTime}:00`).toISOString();

    const endAt = formAllDay
      ? `${formDate}T23:59:59.999Z`
      : new Date(`${formDate}T${formEndTime}:00`).toISOString();

    if (editingEventId) {
      await calendarStorage.updateCalendarEvent(editingEventId, {
        title: formTitle.trim(),
        type: formType,
        startAt,
        endAt,
        allDay: formAllDay,
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        priority: formPriority,
      });
      setNotice("Calendar event updated.");
    } else {
      await calendarStorage.addCalendarEvent({
        title: formTitle.trim(),
        type: formType,
        startAt,
        endAt,
        allDay: formAllDay,
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        priority: formPriority,
        source: "manual",
        status: "confirmed",
        reminderMinutesBefore: 15,
      });
      setNotice("New event scheduled.");
    }

    setShowEventModal(false);
    resetForm();
    await loadData();
    setTimeout(() => setNotice(null), 4000);
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm("Are you sure you want to remove this event?")) {
      await calendarStorage.deleteCalendarEvent(id);
      await loadData();
      setShowEventModal(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setEditingEventId(null);
    setFormTitle("");
    setFormType("academic");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setFormAllDay(false);
    setFormLocation("");
    setFormDescription("");
    setFormPriority("medium");
  };

  const openCreateModal = (dateStr?: string) => {
    resetForm();
    if (dateStr) setFormDate(dateStr);
    setShowEventModal(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setFormTitle(event.title);
    setFormType(event.type);
    const datePart = event.startAt.split("T")[0];
    setFormDate(datePart);

    if (event.allDay) {
      setFormAllDay(true);
    } else {
      setFormAllDay(false);
      const s = new Date(event.startAt);
      const e = new Date(event.endAt);
      setFormStartTime(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
      setFormEndTime(`${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`);
    }

    setFormLocation(event.location || "");
    setFormDescription(event.description || "");
    setFormPriority(event.priority);
    setShowEventModal(true);
  };

  // Generate 42 calendar grid cells for month view
  const monthGridDays = useMemo(() => {
    const days: Array<{ date: Date; isCurrentMonth: boolean; dateStr: string }> = [];
    const cursor = new Date(windowStart);

    for (let i = 0; i < 42; i++) {
      days.push({
        date: new Date(cursor),
        isCurrentMonth: cursor.getMonth() === currentDate.getMonth(),
        dateStr: cursor.toISOString().split("T")[0],
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [windowStart, currentDate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <Link href="/student" className="hover:text-blue-600">Student Portal</Link>
              <span>/</span>
              <span className="text-blue-600">Smart Academic Calendar</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Smart Academic Calendar</h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Unified academic classes, exams, assignments, job deadlines & interviews. Private & local-first.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/student/timetable"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition"
            >
              Weekly Timetable Generator
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={handleSyncTimetable}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition shadow-sm"
              title="Sync classes from Timetable Generator"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Timetable
            </button>
            <button
              onClick={handleExportIcs}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
              title="Download standard RFC 5545 .ics file"
            >
              <Download className="w-3.5 h-3.5" />
              Export .ICS
            </button>
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm text-blue-800 flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-blue-500 hover:text-blue-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Schedule Conflict Banner */}
        {conflictingIds.size > 0 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold">Schedule Conflict Detected</h2>
              <p className="text-xs text-amber-700 mt-0.5">
                Deterministic interval-overlap algorithm identified overlapping classes or commitments. Check the highlighted red badges on your timeline.
              </p>
            </div>
          </div>
        )}

        {/* Controls Bar: Navigation & Views */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Month / Period Header & Pager */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-md hover:bg-white text-slate-700 transition"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-md hover:bg-white text-slate-700 transition"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-md hover:bg-white text-slate-700 transition"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(["month", "week", "day", "agenda"] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                    viewMode === mode
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Type Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedTypeFilter("ALL")}
            className={`px-3 py-1.5 rounded-full font-medium transition whitespace-nowrap ${
              selectedTypeFilter === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Events ({instances.length})
          </button>
          {Object.entries(EVENT_TYPE_METADATA).map(([typeKey, meta]) => {
            const count = instances.filter((i) => i.event.type === typeKey).length;
            if (count === 0 && selectedTypeFilter !== typeKey) return null;
            return (
              <button
                key={typeKey}
                onClick={() => setSelectedTypeFilter(typeKey)}
                className={`px-3 py-1.5 rounded-full font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                  selectedTypeFilter === typeKey
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                <span>{meta.label}</span>
                <span className="opacity-75 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* View Mode: Month Grid */}
        {viewMode === "month" && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {WEEKDAY_NAMES.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* 42-cell Month Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {monthGridDays.map((dayObj, idx) => {
                const dayStr = dayObj.dateStr;
                const isToday = dayStr === new Date().toISOString().split("T")[0];
                const dayInstances = filteredInstances.filter(
                  (i) => i.startAt.toISOString().split("T")[0] === dayStr
                );

                return (
                  <div
                    key={idx}
                    onClick={() => openCreateModal(dayStr)}
                    className={`min-h-[105px] sm:min-h-[125px] p-1.5 sm:p-2 transition group hover:bg-blue-50/30 cursor-pointer ${
                      !dayObj.isCurrentMonth ? "bg-slate-50/50 text-slate-400" : "bg-white text-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          isToday
                            ? "bg-blue-600 text-white font-bold"
                            : dayObj.isCurrentMonth
                            ? "text-slate-700"
                            : "text-slate-400"
                        }`}
                      >
                        {dayObj.date.getDate()}
                      </span>
                      {dayInstances.some((i) => conflictingIds.has(i.instanceId)) && (
                        <span className="inline-flex items-center text-[10px] text-amber-600 font-bold bg-amber-50 px-1 rounded" title="Conflict">
                          !
                        </span>
                      )}
                    </div>

                    {/* Event chips */}
                    <div className="space-y-1">
                      {dayInstances.slice(0, 3).map((inst) => {
                        const meta = EVENT_TYPE_METADATA[inst.event.type] || EVENT_TYPE_METADATA.academic;
                        const isConflict = conflictingIds.has(inst.instanceId);

                        return (
                          <div
                            key={inst.instanceId}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(inst.event);
                            }}
                            className={`text-[11px] leading-tight px-1.5 py-1 rounded border truncate flex items-center justify-between gap-1 transition ${
                              isConflict
                                ? "bg-red-50 border-red-300 text-red-800 font-medium"
                                : `${meta.bgClass} ${meta.borderClass} ${meta.textClass}`
                            }`}
                            title={`${inst.event.title} (${inst.event.type})`}
                          >
                            <span className="truncate">{inst.event.title}</span>
                            {!inst.event.allDay && (
                              <span className="text-[9px] opacity-75 whitespace-nowrap">
                                {String(inst.startAt.getHours()).padStart(2, "0")}:
                                {String(inst.startAt.getMinutes()).padStart(2, "0")}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {dayInstances.length > 3 && (
                        <div className="text-[10px] text-slate-500 font-medium pl-1">
                          +{dayInstances.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode: Week / Day View */}
        {(viewMode === "week" || viewMode === "day") && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="space-y-4">
              {Array.from(
                new Set(filteredInstances.map((i) => i.startAt.toISOString().split("T")[0]))
              )
                .sort()
                .map((dateStr) => {
                  const dayInsts = filteredInstances.filter(
                    (i) => i.startAt.toISOString().split("T")[0] === dateStr
                  );
                  const dateObj = new Date(`${dateStr}T00:00:00`);

                  return (
                    <div key={dateStr} className="border-b border-slate-100 pb-4 last:border-b-0">
                      <h2 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-blue-600" />
                        {dateObj.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </h2>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dayInsts.map((inst) => {
                          const meta = EVENT_TYPE_METADATA[inst.event.type] || EVENT_TYPE_METADATA.academic;
                          const isConflict = conflictingIds.has(inst.instanceId);

                          return (
                            <div
                              key={inst.instanceId}
                              onClick={() => openEditModal(inst.event)}
                              className={`p-3 rounded-xl border cursor-pointer hover:shadow-xs transition ${
                                isConflict
                                  ? "bg-red-50 border-red-300 text-red-900"
                                  : `${meta.bgClass} ${meta.borderClass} ${meta.textClass}`
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/70">
                                  {meta.label}
                                </span>
                                {isConflict && (
                                  <span className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Conflict
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-sm line-clamp-1">{inst.event.title}</h3>
                              <div className="flex items-center gap-2 mt-2 text-xs opacity-85">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {inst.event.allDay
                                    ? "All Day"
                                    : `${String(inst.startAt.getHours()).padStart(2, "0")}:${String(
                                        inst.startAt.getMinutes()
                                      ).padStart(2, "0")} – ${String(inst.endAt.getHours()).padStart(2, "0")}:${String(
                                        inst.endAt.getMinutes()
                                      ).padStart(2, "0")}`}
                                </span>
                              </div>
                              {inst.event.location && (
                                <div className="flex items-center gap-2 mt-1 text-xs opacity-75">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span className="truncate">{inst.event.location}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              {filteredInstances.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No scheduled events in this period.</p>
                  <button
                    onClick={() => openCreateModal()}
                    className="mt-3 text-xs text-blue-600 font-semibold hover:underline"
                  >
                    + Schedule an event
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* View Mode: Agenda View */}
        {viewMode === "agenda" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Upcoming Academic & Career Agenda (Next 60 Days)
            </h2>

            <div className="divide-y divide-slate-100">
              {filteredInstances.map((inst) => {
                const meta = EVENT_TYPE_METADATA[inst.event.type] || EVENT_TYPE_METADATA.academic;
                const isConflict = conflictingIds.has(inst.instanceId);

                return (
                  <div
                    key={inst.instanceId}
                    onClick={() => openEditModal(inst.event)}
                    className="py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-xl transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                        style={{ backgroundColor: meta.color }}
                      >
                        {inst.event.type === "academic" && <GraduationCap className="w-5 h-5" />}
                        {inst.event.type === "job_deadline" && <Briefcase className="w-5 h-5" />}
                        {inst.event.type === "internship_deadline" && <Sparkles className="w-5 h-5" />}
                        {inst.event.type === "assignment" && <FileText className="w-5 h-5" />}
                        {inst.event.type === "exam" && <Award className="w-5 h-5" />}
                        {inst.event.type === "study_session" && <BookOpen className="w-5 h-5" />}
                        {inst.event.type === "interview" && <Video className="w-5 h-5" />}
                        {inst.event.type === "reminder" && <Bell className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {meta.label}
                          </span>
                          {isConflict && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              Conflict
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{inst.event.title}</h3>
                        {inst.event.description && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{inst.event.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right sm:text-right text-xs text-slate-600 sm:flex-shrink-0">
                      <div className="font-semibold text-slate-800">
                        {inst.startAt.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {inst.event.allDay
                          ? "All Day"
                          : `${String(inst.startAt.getHours()).padStart(2, "0")}:${String(
                              inst.startAt.getMinutes()
                            ).padStart(2, "0")} – ${String(inst.endAt.getHours()).padStart(2, "0")}:${String(
                              inst.endAt.getMinutes()
                            ).padStart(2, "0")}`}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredInstances.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No upcoming agenda items.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create / Edit Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEventId ? "Edit Calendar Event" : "Create Calendar Event"}
              </h2>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Operating Systems Lab, Google Interview, Assignment 3"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as CalendarEventType)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {Object.entries(EVENT_TYPE_METADATA).map(([k, meta]) => (
                      <option key={k} value={k}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDayCheckbox"
                  checked={formAllDay}
                  onChange={(e) => setFormAllDay(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="allDayCheckbox" className="text-xs font-medium text-slate-700">
                  All-day event (e.g. assignment or application deadline)
                </label>
              </div>

              {!formAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location / Video Link (Optional)
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Room 302 or https://meet.google.com/..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Notes, syllabus topics, or preparation check-list..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEventId)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Event
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEventModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                  >
                    {editingEventId ? "Save Changes" : "Create Event"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
