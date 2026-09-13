"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { TimetableEntry } from "@/types/student";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  CalendarDays,
  Plus,
  Trash2,
  Printer,
  FileDown,
  Clock,
  MapPin,
  X,
  RotateCcw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { detectIntervalConflicts } from "@/lib/student/algorithms/conflict-detector";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayType = (typeof DAYS)[number];

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<DayType>("Monday");
  const [showAddModal, setShowAddModal] = useState(false);

  // Export & Download state
  const [exporting, setExporting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Form State
  const [subject, setSubject] = useState("");
  const [day, setDay] = useState<DayType>("Monday");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");

  const loadTimetable = useCallback(async () => {
    try {
      const data = await studentService.getTimetable();
      setEntries(data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    const newEntry: TimetableEntry = {
      id: `tt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      day,
      subject: subject.trim(),
      startTime,
      endTime,
      room: room.trim() || undefined,
      notes: notes.trim() || undefined,
      color: "bg-blue-50 border-blue-200 text-blue-800",
    };

    const updated = [...entries, newEntry];
    setEntries(updated);
    setShowAddModal(false);
    setSubject("");
    setRoom("");
    setNotes("");

    try {
      await studentService.saveTimetable(updated);
    } catch {
      // Local fallback
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    try {
      await studentService.saveTimetable(updated);
    } catch {
      // Local fallback
    }
  };

  const handleClearTimetable = async () => {
    if (confirm("Are you sure you want to clear your weekly timetable?")) {
      setEntries([]);
      try {
        await studentService.saveTimetable([]);
      } catch {
        // Local fallback
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate vector PDF of the weekly timetable using pdf-lib
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([842, 595]); // A4 Landscape
      const { width, height } = page.getSize();

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Header Banner
      page.drawRectangle({
        x: 40,
        y: height - 70,
        width: width - 80,
        height: 40,
        color: rgb(0.12, 0.38, 0.88),
      });

      page.drawText("WEEKLY CLASS TIMETABLE", {
        x: 55,
        y: height - 54,
        size: 16,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText("Generated with Saarvi — Private by design", {
        x: width - 290,
        y: height - 52,
        size: 10,
        font: fontRegular,
        color: rgb(0.85, 0.9, 1),
      });

      // Table Geometry
      const startX = 40;
      const startY = height - 90;
      const dayColWidth = (width - 80) / 7;

      // Draw Day Headers
      DAYS.forEach((d, i) => {
        const colX = startX + i * dayColWidth;
        page.drawRectangle({
          x: colX,
          y: startY - 25,
          width: dayColWidth,
          height: 25,
          color: rgb(0.95, 0.96, 0.98),
          borderColor: rgb(0.82, 0.85, 0.9),
          borderWidth: 1,
        });

        page.drawText(d.substring(0, 3).toUpperCase(), {
          x: colX + 12,
          y: startY - 17,
          size: 9,
          font: fontBold,
          color: rgb(0.2, 0.25, 0.35),
        });
      });

      // Populate entries per day
      DAYS.forEach((d, colIndex) => {
        const dayEntries = entries
          .filter((e) => e.day === d)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        let currentY = startY - 35;

        dayEntries.forEach((entry) => {
          const colX = startX + colIndex * dayColWidth + 3;
          const boxWidth = dayColWidth - 6;
          const boxHeight = 55;

          if (currentY - boxHeight > 40) {
            // Entry Box
            page.drawRectangle({
              x: colX,
              y: currentY - boxHeight,
              width: boxWidth,
              height: boxHeight,
              color: rgb(0.97, 0.98, 1),
              borderColor: rgb(0.75, 0.83, 0.95),
              borderWidth: 1,
            });

            // Subject name truncated
            const subTitle = entry.subject.length > 15 ? `${entry.subject.slice(0, 13)}...` : entry.subject;
            page.drawText(subTitle, {
              x: colX + 6,
              y: currentY - 16,
              size: 8.5,
              font: fontBold,
              color: rgb(0.1, 0.15, 0.25),
            });

            // Timing
            page.drawText(`${entry.startTime} - ${entry.endTime}`, {
              x: colX + 6,
              y: currentY - 30,
              size: 7.5,
              font: fontRegular,
              color: rgb(0.35, 0.4, 0.5),
            });

            // Room
            if (entry.room) {
              page.drawText(`Room: ${entry.room}`, {
                x: colX + 6,
                y: currentY - 44,
                size: 7,
                font: fontRegular,
                color: rgb(0.2, 0.4, 0.8),
              });
            }

            currentY -= boxHeight + 6;
          }
        });
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      // 3-second auto-download
      setCountdown(3);
    } catch (err) {
      console.error("PDF generation failed", err);
      setExporting(false);
    }
  };

  // Countdown timer for 3-second auto-download
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (countdown === 0 && downloadUrl) {
      triggerBrowserDownload(downloadUrl);
      setCountdown(null);
      setExporting(false);
    }
  }, [countdown, downloadUrl]);

  const triggerBrowserDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_weekly_timetable.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCancelAutoDownload = () => {
    setCountdown(null);
    setExporting(false);
  };

  const conflictResult = useMemo(() => {
    const items = entries.map((e) => ({
      id: e.id,
      title: e.subject,
      groupKey: e.day,
      startTime: e.startTime,
      endTime: e.endTime,
    }));
    return detectIntervalConflicts(items);
  }, [entries]);

  const dayEntries = useMemo(() => {
    return entries
      .filter((e) => e.day === activeDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [entries, activeDay]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8 print:p-0 print:m-0">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 print:hidden">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Weekly Schedule Generator</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Timetable Generator
            </h1>
            <p className="text-sm text-slate-600">
              Build your weekly schedule with course timings, room numbers, and clean PDF / print export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print View</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{exporting ? "Generating PDF..." : "Export PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDay(activeDay);
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Class</span>
            </button>
          </div>
        </div>

        {/* 3-Second Auto-Download Card */}
        {countdown !== null && downloadUrl && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in print:hidden">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-900">
                <span className="font-bold">Timetable PDF Ready!</span> Auto-downloading in{" "}
                <span className="font-extrabold text-emerald-700">{countdown}s</span>...
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerBrowserDownload(downloadUrl);
                  setCountdown(null);
                  setExporting(false);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Download Now
              </button>
              <button
                type="button"
                onClick={handleCancelAutoDownload}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Schedule Conflict Alert Banner */}
        {conflictResult.hasAnyConflict && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900 print:hidden">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Schedule Conflict Detected:</span> You have overlapping class times on your timetable. Overlapping slots are flagged with warning badges.
            </div>
          </div>
        )}

        {/* Day Selector Tabs for mobile / focused view */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none print:hidden">
          {DAYS.map((d) => {
            const count = entries.filter((e) => e.day === d).length;
            const isSelected = activeDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDay(d)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <span>{d}</span>
                <span
                  className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Full Weekly Grid (Desktop View & Print View) */}
        <div className="hidden lg:grid grid-cols-7 gap-3 print:grid print:grid-cols-7">
          {DAYS.map((d) => {
            const dayList = entries
              .filter((e) => e.day === d)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            return (
              <div
                key={d}
                className="bg-white border border-slate-200/90 rounded-2xl p-3 space-y-2.5 min-h-[380px] shadow-xs flex flex-col"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">{d.substring(0, 3)}</span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {dayList.length} classes
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  {dayList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-300 italic">
                      No classes
                    </div>
                  ) : (
                    dayList.map((e) => {
                      const hasConflict = conflictResult.conflictingIds.has(e.id);
                      return (
                        <div
                          key={e.id}
                          className={`p-2.5 rounded-xl space-y-1 transition-colors group relative ${
                            hasConflict
                              ? "bg-amber-50/80 border border-amber-300 text-amber-900"
                              : "bg-blue-50/60 border border-blue-100/90 text-slate-900 hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-bold line-clamp-1">
                              {e.subject}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(e.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-0.5 rounded transition-opacity cursor-pointer print:hidden"
                              aria-label={`Remove ${e.subject}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            <span>
                              {e.startTime} - {e.endTime}
                            </span>
                          </div>
                          {hasConflict && (
                            <span className="inline-block text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              Overlap conflict
                            </span>
                          )}
                          {e.room && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-700 font-semibold">
                              <MapPin className="w-2.5 h-2.5" />
                              <span>{e.room}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile / Day Card View */}
        <div className="lg:hidden space-y-3 print:hidden">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-base font-bold text-slate-900">{activeDay} Classes</h2>
            <button
              type="button"
              onClick={() => {
                setDay(activeDay);
                setShowAddModal(true);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {dayEntries.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200/80 rounded-2xl text-center space-y-2">
              <p className="text-xs text-slate-500">No scheduled classes for {activeDay}.</p>
              <button
                type="button"
                onClick={() => {
                  setDay(activeDay);
                  setShowAddModal(true);
                }}
                className="text-xs font-bold text-blue-600"
              >
                + Add a class to {activeDay}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dayEntries.map((e) => (
                <div
                  key={e.id}
                  className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">{e.subject}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {e.startTime} – {e.endTime}
                      </span>
                      {e.room && (
                        <span className="flex items-center gap-1 text-blue-600 font-semibold">
                          <MapPin className="w-3.5 h-3.5" />
                          {e.room}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(e.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                    aria-label={`Remove ${e.subject}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timetable count and clear action */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-200/70 print:hidden">
          <span>{entries.length} weekly classes recorded</span>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleClearTimetable}
              className="flex items-center gap-1 hover:text-red-600 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Schedule</span>
            </button>
          )}
        </div>

        {/* Add Class Modal */}
        {showAddModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-tt-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 id="modal-tt-title" className="text-base font-bold text-slate-900">Add Class to Timetable</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close modal"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEntry} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="modal-tt-subject" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Subject / Course
                  </label>
                  <input
                    id="modal-tt-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Operating Systems"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-tt-day" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Day of Week
                  </label>
                  <select
                    id="modal-tt-day"
                    value={day}
                    onChange={(e) => setDay(e.target.value as DayType)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800 font-semibold"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-tt-starttime" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Start Time
                    </label>
                    <input
                      id="modal-tt-starttime"
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-tt-endtime" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      End Time
                    </label>
                    <input
                      id="modal-tt-endtime"
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-tt-room" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Room / Hall / Lab (Optional)
                  </label>
                  <input
                    id="modal-tt-room"
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. LH-201 / Lab 4"
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
                    Add Class
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
