"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";
import { notificationService } from "@/lib/services/notificationService";
import {
  NotificationPreferences,
  NotificationHistoryEntry,
  ReminderTiming,
} from "@/types/notifications";
import {
  Bell,
  Mail,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  Send,
  History,
  ArrowLeft,
  Moon,
  Globe,
  Sliders,
} from "lucide-react";

export default function StudentNotificationSettingsPage() {
  const { user } = useAuth();
  const isGuest = !user || !user.email;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preferences State
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState("");
  const [defaultReminderTiming, setDefaultReminderTiming] = useState<ReminderTiming>("same_day");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");

  // Broadcast & Opportunity Categories Preferences
  const [prefAnnouncements, setPrefAnnouncements] = useState(true);
  const [prefFeatures, setPrefFeatures] = useState(true);
  const [prefOffers, setPrefOffers] = useState(true);
  const [prefCareer, setPrefCareer] = useState(true);
  const [prefAcademic, setPrefAcademic] = useState(true);
  const [prefInterview, setPrefInterview] = useState(true);

  // History State
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prefs, hist] = await Promise.all([
        notificationService.getPreferences(),
        notificationService.getHistory(),
      ]);

      setEmailEnabled(prefs.emailEnabled ?? true);
      setWhatsappEnabled(prefs.whatsappEnabled ?? false);
      setWhatsappPhoneNumber(prefs.whatsappPhoneNumber || "");
      setDefaultReminderTiming(prefs.defaultReminderTiming || "same_day");
      setTimezone(prefs.timezone || "Asia/Kolkata");
      setQuietHoursEnabled(prefs.quietHours?.enabled ?? false);
      setQuietHoursStart(prefs.quietHours?.start || "22:00");
      setQuietHoursEnd(prefs.quietHours?.end || "07:00");
      setHistory(hist || []);
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await notificationService.savePreferences({
        emailEnabled,
        whatsappEnabled,
        whatsappPhoneNumber: whatsappPhoneNumber.trim(),
        defaultReminderTiming,
        timezone,
        quietHours: {
          enabled: quietHoursEnabled,
          start: quietHoursStart,
          end: quietHoursEnd,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Fail safely
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (isGuest) {
      setTestMessage({
        type: "error",
        text: "Create a free Saarvi account to receive test email reminders.",
      });
      return;
    }

    try {
      setTestSending(true);
      setTestMessage(null);

      const result = await notificationService.scheduleReminder({
        eventId: `test_${Date.now()}`,
        eventType: "study_session",
        eventTitle: "Saarvi Test Reminder",
        scheduledDate: new Date().toISOString().split("T")[0],
        scheduledTime: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        reminderTiming: "same_day",
        channels: {
          email: true,
          whatsapp: whatsappEnabled,
        },
        phoneOverride: whatsappPhoneNumber,
      });

      if (result.success) {
        setTestMessage({
          type: "success",
          text: `Test reminder scheduled successfully for ${user?.email}.`,
        });
        loadData();
      } else {
        setTestMessage({
          type: "error",
          text: result.error || "Failed to schedule test reminder.",
        });
      }
    } catch {
      setTestMessage({
        type: "error",
        text: "Network error sending test reminder.",
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Workspace Dashboard
          </Link>

          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Phase 19 · Smart Notifications
          </span>
        </div>

        {/* Title Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200/80 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Notification Settings
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure automated study, assignment, exam, and deadline reminders.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero marks or notes shared</span>
            </div>
          </div>

          {/* Privacy Banner */}
          <div className="mt-6 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-700 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-900">Privacy Notice: </span>
              Your student workspace remains strictly local-first. External notifications transmit only minimum necessary reminder data (event title, scheduled date, and time).
            </div>
          </div>
        </div>

        {/* Guest Banner if not signed in */}
        {isGuest && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-slate-800 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Registration Required for External Delivery</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your planning workspace works fully offline in your browser. To have Saarvi dispatch automated email or WhatsApp reminders to your devices, please create a free account or sign in.
                </p>
                <div className="flex items-center gap-3 pt-3">
                  <Link
                    href="/signup"
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    Create free account
                  </Link>
                  <Link
                    href="/login"
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Settings Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-blue-600" />
              Notification Channels
            </h2>

            {/* Email Channel (Free & Default) */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Email Reminders</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Free Default
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Free for all registered users. Delivers study session, exam, and assignment alerts.
                  </p>
                  {user?.email && (
                    <p className="text-xs text-slate-700 font-medium mt-1">
                      Target address: <span className="font-semibold text-blue-600">{user.email}</span>
                    </p>
                  )}
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* WhatsApp Channel (Optional) */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">WhatsApp Reminders</span>
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Optional secondary channel. Operates independently — email continues to work even if WhatsApp is disabled.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {whatsappEnabled && (
                <div className="pt-3 border-t border-slate-200/60 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    WhatsApp Mobile Number (with Country Code):
                  </label>
                  <input
                    type="tel"
                    value={whatsappPhoneNumber}
                    onChange={(e) => setWhatsappPhoneNumber(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full sm:w-80 text-xs px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Uses official Meta WhatsApp Cloud API. No third-party scraping or unofficial automation.
                  </p>
                </div>
              )}
            </div>

            {/* Timing & Timezone */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Default Reminder Timing
                </label>
                <select
                  value={defaultReminderTiming}
                  onChange={(e) => setDefaultReminderTiming(e.target.value as ReminderTiming)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="same_day">Same day (Default)</option>
                  <option value="1_day_before">1 day before</option>
                  <option value="2_hours_before">2 hours before</option>
                  <option value="1_hour_before">1 hour before</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  Your Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Asia/Kolkata"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">Quiet Hours</span>
                    <p className="text-[11px] text-slate-500">Hold notifications during study or sleep hours.</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={quietHoursEnabled}
                    onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {quietHoursEnabled && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">From:</span>
                    <input
                      type="time"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">To:</span>
                    <input
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Platform & Broadcast Communication Categories */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                Platform & Opportunity Topics
              </h2>
              <p className="text-xs text-slate-500">
                Choose which types of platform notices, releases, and opportunities you receive. System and security notices remain active by default.
              </p>

              <div className="space-y-3">
                {/* System & Security Notifications */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>System & Security Notices</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-purple-50 text-purple-700">
                        Mandatory
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Critical security notices and essential account maintenance alerts.</p>
                  </div>
                  <div className="text-[11px] font-bold text-slate-400">Always On</div>
                </div>

                {/* Announcements */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Platform Announcements</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Important Saarvi updates and ecosystem news.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefAnnouncements}
                    onChange={(e) => setPrefAnnouncements(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                {/* Product Updates */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Product & Feature Updates</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">New tools, calculators, and workflow improvements.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefFeatures}
                    onChange={(e) => setPrefFeatures(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                {/* Offers & Promotions */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Offers & Benefits</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Discounts, student perks, and promotional opportunities.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefOffers}
                    onChange={(e) => setPrefOffers(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                {/* Interviews */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Mock Interview Releases</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Interview preparation drives, question bank additions, and test centers.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefInterview}
                    onChange={(e) => setPrefInterview(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                {/* Career & Scholarships */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Career & Scholarships</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Internship deadlines, campus drive notices, and scholarship openings.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefCareer}
                    onChange={(e) => setPrefCareer(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                {/* Academic & Exams */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Academic & Exam Alerts</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">VTU updates, examination schedules, and timetable reminders.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefAcademic}
                    onChange={(e) => setPrefAcademic(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Save Button & Feedback */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Saving Preferences..." : "Save Preferences"}
                </button>

                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testSending || isGuest}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  {testSending ? "Dispatching..." : "Send Test Reminder"}
                </button>
              </div>

              {saveSuccess && (
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Preferences updated successfully!
                </div>
              )}
            </div>

            {testMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  testMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {testMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{testMessage.text}</span>
              </div>
            )}
          </div>
        </form>

        {/* Notification History Log */}
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Notification History & Dispatch Log
            </h2>
            <span className="text-xs text-slate-500">
              {history.length} {history.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No notifications dispatched yet. Scheduled reminders will appear here truthfully once created.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="pb-2 font-medium">Event Title</th>
                    <th className="pb-2 font-medium">Channel</th>
                    <th className="pb-2 font-medium">Scheduled For</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((entry) => (
                    <tr key={entry.id} className="text-slate-700">
                      <td className="py-2.5 font-medium text-slate-900">
                        {entry.eventTitle}
                        <span className="ml-1.5 text-[10px] text-slate-400 capitalize">
                          ({entry.eventType.replace(/_/g, " ")})
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                            entry.channel === "email"
                              ? "bg-blue-50 text-blue-700 border border-blue-100"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}
                        >
                          {entry.channel}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {entry.scheduledDate} {entry.scheduledTime || ""}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium ${
                            entry.status === "SENT"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : entry.status === "FAILED"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : entry.status === "NOT_CONFIGURED"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
