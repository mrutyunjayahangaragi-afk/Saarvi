"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
  Bell,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  Send,
  X,
  Eye,
  Calendar,
  Users,
  Search,
  Check,
  FileText,
  Clock,
  Settings,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Sliders,
  Radio,
} from "lucide-react";
import type {
  NotificationCategory,
  NotificationPriority,
  NotificationAudienceType,
  NotificationDeliveryChannel,
} from "@/types/notifications-v2";

interface BroadcastItem {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: string;
  audience_type: NotificationAudienceType;
  channels: NotificationDeliveryChannel[];
  recipient_count?: number;
  created_at: string;
  scheduled_at?: string;
  sent_at?: string;
  metrics?: {
    delivered: number;
    read: number;
    clicked: number;
    failed: number;
  };
}

interface AnalyticsData {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  failureRate: number;
}

interface UserCandidate {
  id: string;
  email: string;
  fullName: string;
  role: string;
  plan: string;
}

export default function AdminNotificationsPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "composer" | "campaigns" | "settings">("overview");
  const [loading, setLoading] = useState(true);

  // Broadcasts and Analytics
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Test Email State
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Composer State
  const [category, setCategory] = useState<NotificationCategory>("ANNOUNCEMENT");
  const [priority, setPriority] = useState<NotificationPriority>("NORMAL");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [channels, setChannels] = useState<NotificationDeliveryChannel[]>(["in_app", "email"]);
  const [audienceType, setAudienceType] = useState<NotificationAudienceType>("ALL_USERS");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState<"in_app" | "email">("in_app");

  // User Search State (for SELECTED_USERS)
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<UserCandidate[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Confirmation Safeguard Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);

  // SuperAdmin Settings State
  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [broadcastRes, settingsRes] = await Promise.all([
        fetch("/api/admin/notifications/broadcast", { credentials: "include" }),
        fetch("/api/admin/notifications/settings", { credentials: "include" }),
      ]);

      if (broadcastRes.ok) {
        const data = await broadcastRes.json();
        setBroadcasts(data.notifications || []);
        setAnalytics(data.analytics || null);
      }

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setSystemSettings(sData.settings || null);
      }
    } catch (err) {
      console.error("Failed to load admin notifications data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Search users for SELECTED_USERS
  useEffect(() => {
    if (audienceType !== "SELECTED_USERS") return;
    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(`/api/admin/notifications/users?q=${encodeURIComponent(userSearchQuery)}&limit=20`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setSearchedUsers(data.users || []);
        }
      } catch {
      } finally {
        setSearchingUsers(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [audienceType, userSearchQuery]);

  const toggleChannel = (channel: NotificationDeliveryChannel) => {
    if (channels.includes(channel)) {
      if (channels.length > 1) {
        setChannels(channels.filter((c) => c !== channel));
      }
    } else {
      setChannels([...channels, channel]);
    }
  };

  const [calculatingAudience, setCalculatingAudience] = useState(false);
  const [emailPreviewDevice, setEmailPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const handleOpenSendConfirmation = async () => {
    if (!title.trim() || !body.trim()) {
      alert("Title and body text are required.");
      return;
    }
    if (audienceType === "SELECTED_USERS" && selectedUserIds.length === 0) {
      alert("Please select at least one recipient user.");
      return;
    }

    setCalculatingAudience(true);
    try {
      const res = await fetch("/api/admin/notifications/audience-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          audience_type: audienceType,
          audience_definition: audienceType === "SELECTED_USERS" ? { userIds: selectedUserIds } : {},
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEstimatedRecipients(data.matchedCount ?? (audienceType === "SELECTED_USERS" ? selectedUserIds.length : 1));
      } else {
        setEstimatedRecipients(audienceType === "SELECTED_USERS" ? selectedUserIds.length : 1);
      }
    } catch {
      setEstimatedRecipients(audienceType === "SELECTED_USERS" ? selectedUserIds.length : 1);
    } finally {
      setCalculatingAudience(false);
      setConfirmModalOpen(true);
    }
  };

  const handleExecuteSend = async (isDraft = false) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          priority,
          title,
          subtitle,
          body,
          cta_text: ctaText,
          cta_url: ctaUrl,
          channels,
          audience_type: audienceType,
          audience_definition: audienceType === "SELECTED_USERS" ? { userIds: selectedUserIds } : {},
          sendNow: !isScheduled && !isDraft,
          scheduled_at: isScheduled ? scheduledAt : undefined,
          isDraft,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create broadcast.");
      }

      setConfirmModalOpen(false);
      // Reset composer
      setTitle("");
      setSubtitle("");
      setBody("");
      setCtaText("");
      setCtaUrl("");
      setSelectedUserIds([]);
      setActiveTab("campaigns");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to broadcast notification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryFailed = async (notificationId?: string) => {
    try {
      const res = await fetch("/api/admin/notifications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationId }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Retried failed deliveries.");
        await loadData();
      }
    } catch (err) {
      console.error("Failed to retry:", err);
    }
  };

  const handleSaveSettings = async () => {
    if (!isSuperAdmin) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(systemSettings),
      });
      if (res.ok) {
        alert("Global notification settings updated successfully.");
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update settings.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim() || testEmailSending) return;
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/admin/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientEmail: testEmailRecipient.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestEmailResult({ success: true, message: "Test email sent successfully via SMTP!" });
      } else {
        setTestEmailResult({ success: false, message: data.error || "Failed to send test email." });
      }
    } catch {
      setTestEmailResult({ success: false, message: "Network failure during SMTP test." });
    } finally {
      setTestEmailSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <span>Notification Center 2.0 & User Messaging Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create, target, schedule, and monitor platform broadcasts delivered across in-app notification centers and registered user emails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("composer")}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose Broadcast</span>
          </button>
          <button
            type="button"
            onClick={loadData}
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs cursor-pointer"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "overview" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Overview & Metrics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("composer")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "composer" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Create Notification
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("campaigns")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "campaigns" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Broadcast History ({broadcasts.length})
        </button>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "settings" ? "bg-purple-900 text-white" : "text-purple-700 hover:bg-purple-50"
            }`}
          >
            SuperAdmin Settings
          </button>
        )}
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Analytics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sent</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{analytics?.totalSent || 0}</div>
              <p className="text-[10px] text-slate-400 mt-1">Platform-wide broadcasts</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Delivered</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{analytics?.totalDelivered || 0}</div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">{analytics?.deliveryRate || 100}% delivery rate</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Read Rate</span>
              <div className="text-2xl font-bold text-blue-700 mt-1">{analytics?.readRate || 0}%</div>
              <p className="text-[10px] text-slate-400 mt-1">{analytics?.totalRead || 0} messages opened</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">CTA Click Rate</span>
              <div className="text-2xl font-bold text-purple-700 mt-1">{analytics?.clickRate || 0}%</div>
              <p className="text-[10px] text-slate-400 mt-1">{analytics?.totalClicked || 0} action clicks</p>
            </div>
          </div>

          {/* Quick Action / Recent Campaigns */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Broadcasts</h2>
              <button
                type="button"
                onClick={() => setActiveTab("campaigns")}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {broadcasts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No broadcasts sent yet. Click &ldquo;Compose Broadcast&rdquo; to send the first announcement.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {broadcasts.slice(0, 4).map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{b.title}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                          {b.category}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[10px] uppercase">
                          {b.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{b.body}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-slate-700">{b.recipient_count || 0} recipients</span>
                      <div className="text-[10px] text-slate-400">
                        {new Date(b.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SMTP Delivery Diagnostics */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">SMTP Provider Diagnostics</h2>
              <p className="text-xs text-slate-500 mt-0.5">Send a verified live test email through the platform SMTP pipeline.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsTestEmailOpen(true)}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Test Email</span>
            </button>
          </div>

          {/* Test Email Modal */}
          {isTestEmailOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Send SMTP Test Email</h3>
                  <button
                    type="button"
                    onClick={() => setIsTestEmailOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSendTestEmail} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Recipient Email</label>
                    <input
                      type="email"
                      placeholder="admin@example.com"
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {testEmailResult && (
                    <div
                      className={`p-2.5 rounded-xl text-xs ${
                        testEmailResult.success
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {testEmailResult.message}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsTestEmailOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={testEmailSending || !testEmailRecipient.trim()}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {testEmailSending ? "Sending..." : "Send Test Email"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPOSER & PREVIEW */}
      {activeTab === "composer" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Broadcast Settings */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Broadcast Composer</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Message Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                  <option value="OFFER">OFFER</option>
                  <option value="FEATURE_UPDATE">FEATURE_UPDATE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INTERVIEW">INTERVIEW</option>
                  <option value="ACADEMIC">ACADEMIC</option>
                  <option value="CAREER">CAREER</option>
                  <option value="SCHOLARSHIP">SCHOLARSHIP</option>
                  <option value="SYSTEM">SYSTEM</option>
                  <option value="REMINDER">REMINDER</option>
                  <option value="PROMOTION">PROMOTION</option>
                  <option value="CUSTOM">CUSTOM</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as NotificationPriority)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Notification Title</label>
              <input
                type="text"
                placeholder="e.g. Mock Interview 2.0 is now available"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Subtitle (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Practice with MCQ, typed, and live video modes."
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Message Body</label>
              <textarea
                rows={4}
                placeholder="Write message content here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Call-to-Action Text</label>
                <input
                  type="text"
                  placeholder="e.g. Start Mock Interview"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">CTA URL (Safe internal/external)</label>
                <input
                  type="text"
                  placeholder="e.g. /student/copilot/interview"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Delivery Channels */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Delivery Channels</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleChannel("in_app")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    channels.includes("in_app")
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${channels.includes("in_app") ? "opacity-100" : "opacity-0"}`} />
                  <span>In-App Notification Center</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleChannel("email")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    channels.includes("email")
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${channels.includes("email") ? "opacity-100" : "opacity-0"}`} />
                  <span>Registered User Email</span>
                </button>
              </div>
            </div>

            {/* Audience Targeting */}
            <div className="border-t border-slate-100 pt-3">
              <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Audience Targeting</label>
              <select
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value as NotificationAudienceType)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL_USERS">All Registered Users</option>
                <option value="SELECTED_USERS">Selected Users (Search & Multi-select)</option>
                <option value="FREE_USERS">Free Plan Users Only</option>
                <option value="PRO_USERS">Pro Subscription Users Only</option>
                <option value="VERIFIED_USERS">Active / Verified Accounts Only</option>
                <option value="ADMINS">Administrators Only</option>
              </select>

              {/* Selected Users Search & Tagging */}
              {audienceType === "SELECTED_USERS" && (
                <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Search Registered Users</span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Search name, email, or user ID..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {searchingUsers ? (
                    <div className="text-[11px] text-slate-400 py-1">Searching...</div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                      {searchedUsers.map((u) => {
                        const isSelected = selectedUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                              } else {
                                setSelectedUserIds([...selectedUserIds, u.id]);
                              }
                            }}
                            className={`p-2 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 ${
                              isSelected ? "bg-blue-50/60" : ""
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-slate-800">{u.fullName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isSelected ? "Selected" : "Add"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 font-semibold">
                    {selectedUserIds.length} users currently selected.
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleExecuteSend(true)}
                disabled={isSubmitting || !title.trim()}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={handleOpenSendConfirmation}
                disabled={isSubmitting || !title.trim() || !body.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Broadcast</span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Previews */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Live Preview</span>
              </span>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewMode("in_app")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    previewMode === "in_app" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                  }`}
                >
                  In-App
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("email")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    previewMode === "email" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Email
                </button>
              </div>
            </div>

            {/* In-App Preview Card */}
            {previewMode === "in_app" && (
              <div className="p-5 rounded-2xl border border-blue-200 bg-white shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900">Saarvi</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-slate-100 text-slate-600">
                        {category}
                      </span>
                      <span className="text-[10px] text-slate-400">&bull; Just now</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      {title || "Mock Interview 2.0 is now available"}
                    </h3>
                    {subtitle && <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{subtitle}</p>}
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-1.5 whitespace-pre-line">
                      {body || "You can now practice with MCQ, typed, AI interviewer, and live interview modes."}
                    </p>
                    {ctaText && (
                      <div className="mt-3">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold shadow-2xs">
                          {ctaText}
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Email Preview Card */}
            {previewMode === "email" && (
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-1.5 px-1 text-[11px] text-slate-500 font-medium">
                  <span>Device view:</span>
                  <button
                    type="button"
                    onClick={() => setEmailPreviewDevice("desktop")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      emailPreviewDevice === "desktop"
                        ? "bg-blue-100 text-blue-800 font-bold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPreviewDevice("mobile")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      emailPreviewDevice === "mobile"
                        ? "bg-blue-100 text-blue-800 font-bold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Mobile
                  </button>
                </div>

                <div
                  className={`mx-auto transition-all duration-200 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs ${
                    emailPreviewDevice === "mobile" ? "max-w-[360px] border-slate-300 ring-4 ring-slate-100" : "w-full"
                  }`}
                >
                  <div className="p-3 bg-slate-100/80 border-b border-slate-200 text-[11px] font-mono text-slate-600">
                    <div><strong>From:</strong> Saarvi Notifications &lt;saarvinotifications@gmail.com&gt;</div>
                    <div className="truncate"><strong>Subject:</strong> Saarvi &mdash; {title.trim() || "New Platform Update"}</div>
                  </div>
                  <div className="p-5 space-y-3 bg-slate-50/40">
                    <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                      <div className="text-base font-extrabold tracking-tight">Saarvi<span className="text-blue-400">.</span></div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        {category}
                      </span>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{title.trim() || "Platform Announcement"}</h3>
                      {subtitle && <p className="text-xs font-semibold text-slate-500">{subtitle.trim()}</p>}
                      <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                        {body.trim() || "Practice technical and HR interviews with Saarvi's new Mock Interview system."}
                      </p>
                      {ctaText && (
                        <div className="pt-2">
                          <span className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs">
                            {ctaText} &rarr;
                          </span>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 pt-2">
                        Best regards,<br />
                        <strong className="text-slate-700">The Saarvi Team</strong>
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-[10px] text-slate-500 text-center space-y-1">
                      <div className="font-bold text-slate-700">Saarvi &bull; Study. Work. Grow.</div>
                      <p className="text-slate-400">Empowering students and professionals with verified career opportunities.</p>
                      <div className="text-slate-400 pt-1">
                        <span className="underline">Privacy</span> &bull; <span className="underline">Terms</span> &bull; <span className="underline">Preferences</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CAMPAIGNS & HISTORY */}
      {activeTab === "campaigns" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Broadcast Campaigns History</h2>
            <button
              type="button"
              onClick={() => handleRetryFailed()}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-blue-600" />
              <span>Retry All Failed Deliveries</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">Title & Category</th>
                  <th className="py-2.5 px-3">Audience</th>
                  <th className="py-2.5 px-3">Channels</th>
                  <th className="py-2.5 px-3">Recipients</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Delivered</th>
                  <th className="py-2.5 px-3">Read</th>
                  <th className="py-2.5 px-3">Clicked</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {broadcasts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                      No broadcast records found.
                    </td>
                  </tr>
                ) : (
                  broadcasts.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div className="font-bold">{b.title}</div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {b.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {b.audience_type}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600">
                        {b.channels.join(", ")}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {b.recipient_count || 0}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-50 text-blue-700">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                        {b.metrics?.delivered || 0}
                      </td>
                      <td className="py-2.5 px-3 text-blue-700 font-semibold">
                        {b.metrics?.read || 0}
                      </td>
                      <td className="py-2.5 px-3 text-purple-700 font-semibold">
                        {b.metrics?.clicked || 0}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SUPERADMIN SETTINGS */}
      {activeTab === "settings" && isSuperAdmin && systemSettings && (
        <div className="bg-white rounded-2xl border border-purple-200 shadow-xs p-5 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              SuperAdmin Global Notification Controls
            </h2>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-bold text-slate-900">Global Notification Switch</div>
                <div className="text-[11px] text-slate-500">Allow platform broadcasts to be created and sent</div>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.global_enabled}
                onChange={(e) => setSystemSettings({ ...systemSettings, global_enabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <div className="font-bold text-slate-900">Email Delivery Channel</div>
                <div className="text-[11px] text-slate-500">Allow notifications to be dispatched via registered SMTP email</div>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.email_enabled}
                onChange={(e) => setSystemSettings({ ...systemSettings, email_enabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <div className="font-bold text-slate-900">In-App Delivery Channel</div>
                <div className="text-[11px] text-slate-500">Allow in-app delivery into /notifications feed</div>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.in_app_enabled}
                onChange={(e) => setSystemSettings({ ...systemSettings, in_app_enabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <div className="font-bold text-slate-900">Maximum Broadcast Size</div>
                <div className="text-[11px] text-slate-500">Cap on users targeted in a single notification campaign</div>
              </div>
              <input
                type="number"
                value={systemSettings.max_broadcast_size}
                onChange={(e) =>
                  setSystemSettings({ ...systemSettings, max_broadcast_size: parseInt(e.target.value, 10) })
                }
                className="w-24 text-xs p-1.5 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {savingSettings ? "Saving..." : "Save SuperAdmin Controls"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Safeguard Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-sm">Confirm Notification Broadcast</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs space-y-2">
              <div><strong>Title:</strong> {title}</div>
              <div><strong>Category:</strong> {category} ({priority} priority)</div>
              <div><strong>Target Audience:</strong> {audienceType}</div>
              <div className="flex items-center justify-between text-blue-700 font-bold bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                <span>Matched Recipients:</span>
                <span>{estimatedRecipients.toLocaleString()} Users</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div><strong>In-App:</strong> {channels.includes("in_app") ? "YES" : "NO"}</div>
                <div><strong>Email:</strong> {channels.includes("email") ? "YES" : "NO"}</div>
                <div><strong>Estimated Batches:</strong> {Math.max(1, Math.ceil(estimatedRecipients / 50))}</div>
                <div><strong>Idempotency:</strong> Guaranteed</div>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              This message will be dispatched immediately in bounded batches to all {estimatedRecipients.toLocaleString()} matched users. Successful deliveries are tracked idempotently.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteSend(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send to {estimatedRecipients.toLocaleString()} Users</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
