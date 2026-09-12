"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Bell,
  Mail,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  Server,
  Send,
  X,
} from "lucide-react";

interface AdminProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  status: "OPERATIONAL" | "NOT_CONFIGURED" | "CONFIG_MISSING" | "CONNECTION_FAILURE";
  message?: string;
}

interface AdminMetrics {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  emailSent: number;
  whatsAppSent: number;
  failures: Array<{ id: string; channel: string; error: string; time: string }>;
}

export default function AdminNotificationsPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<{
    email: AdminProviderInfo;
    whatsapp: AdminProviderInfo;
  } | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);

  // Test Email State
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    const effective = profile || user;
    if (effective?.id) {
      headers["x-user-id"] = effective.id;
      headers["x-user-email"] = effective.email || "";
      if (effective.role) {
        headers["x-user-role"] = effective.role;
      }
    }
    return headers;
  }, [profile, user]);

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/notifications", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
        setMetrics(data.metrics);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/notifications", {
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setProviders(data.providers);
          setMetrics(data.metrics);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getAuthHeaders]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient || !testEmailRecipient.includes("@")) {
      setTestEmailResult({
        success: false,
        message: "Please enter a valid recipient email address.",
      });
      return;
    }

    try {
      setTestEmailSending(true);
      setTestEmailResult(null);

      const res = await fetch("/api/admin/notifications/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          recipient: testEmailRecipient.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestEmailResult({
          success: true,
          message: data.message || "Test email sent successfully.",
        });
        fetchAdminData();
      } else {
        setTestEmailResult({
          success: false,
          message: data.error || "Unable to send test email.",
        });
      }
    } catch {
      setTestEmailResult({
        success: false,
        message: "Network error: Unable to send test email.",
      });
    } finally {
      setTestEmailSending(false);
    }
  };

  const getEmailStatusBadge = (provider?: AdminProviderInfo) => {
    if (!provider || !provider.configured || provider.status === "NOT_CONFIGURED" || provider.status === "CONFIG_MISSING") {
      return {
        label: "Not Configured",
        badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    }

    if (provider.status === "CONNECTION_FAILURE") {
      return {
        label: "Provider Error",
        badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    }

    if (provider.status === "OPERATIONAL") {
      return {
        label: "Configured",
        badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    }

    return {
      label: "Provider Unavailable",
      badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      icon: <Server className="w-3.5 h-3.5" />,
    };
  };

  const emailStatus = getEmailStatusBadge(providers?.email);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Notification & Messaging Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Operational status of transactional email and WhatsApp Cloud API dispatchers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Strict Privacy Active</span>
          </div>

          <button
            type="button"
            onClick={fetchAdminData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Privacy Guarantee Alert */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs text-slate-700 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900">Privacy Safeguard Invariant: </span>
          Saarvi student planning data is strictly local-first. Administrators cannot view student study notes,
          academic grades, course marks, or personal documents. Only aggregate dispatch volume and operational failure codes are accessible.
        </div>
      </div>

      {/* Provider Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Email Provider Card */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-slate-900">Transactional Email</h2>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Free Core
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Provider: <span className="font-semibold text-slate-700">{providers?.email.name || "Gmail SMTP"}</span>
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${emailStatus.badgeClass}`}
            >
              {emailStatus.icon}
              <span>{emailStatus.label}</span>
            </span>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
            <p>
              <span className="font-semibold text-slate-900">Delivery Channel: </span>
              Default free channel for registered students. Never placed behind payment or subscription paywalls.
            </p>
            {providers?.email.message && (
              <p className="text-[11px] text-slate-500">
                <span className="font-medium text-slate-600">Status Info: </span>
                {providers.email.message}
              </p>
            )}
          </div>

          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setIsTestEmailOpen(true);
                setTestEmailResult(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Test Email</span>
            </button>
          </div>
        </div>

        {/* WhatsApp Provider Card */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-slate-900">WhatsApp Cloud API</h2>
                  <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {providers?.whatsapp.name || "Meta Graph API (Official)"}
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                providers?.whatsapp.status === "OPERATIONAL"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {providers?.whatsapp.status === "OPERATIONAL" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Server className="w-3.5 h-3.5" />
              )}
              <span>{providers?.whatsapp.status === "OPERATIONAL" ? "Operational" : "Optional / Unconfigured"}</span>
            </span>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p>
              <span className="font-semibold text-slate-900">Decoupled Channel: </span>
              Completely independent. If unconfigured or unavailable, free email reminders continue operating normally.
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl">
          <p className="text-xs font-medium text-slate-500">Total Scheduled</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{metrics?.totalScheduled ?? 0}</p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl">
          <p className="text-xs font-medium text-slate-500">Delivered (Sent)</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{metrics?.totalSent ?? 0}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {metrics?.emailSent ?? 0} Email • {metrics?.whatsAppSent ?? 0} WA
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl">
          <p className="text-xs font-medium text-slate-500">Pending in Queue</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">{metrics?.totalPending ?? 0}</p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl">
          <p className="text-xs font-medium text-slate-500">Delivery Failures</p>
          <p className="text-2xl font-extrabold text-red-600 mt-1">{metrics?.totalFailed ?? 0}</p>
        </div>
      </div>

      {/* Operational Failure Log */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Operational Dispatch & Retry Failures
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {metrics?.failures?.length || 0} incidents recorded
          </span>
        </div>

        {(!metrics?.failures || metrics.failures.length === 0) ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Zero delivery failures recorded. All notification channels operating smoothly.
          </div>
        ) : (
          <div className="space-y-2">
            {metrics.failures.map((f) => (
              <div
                key={f.id}
                className="p-3 bg-red-50/70 border border-red-100 rounded-xl text-xs flex items-center justify-between gap-4"
              >
                <div>
                  <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 mr-2">
                    {f.channel}
                  </span>
                  <span className="text-red-900 font-medium">{f.error}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  {new Date(f.time).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Email Modal Dialog */}
      {isTestEmailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="test-email-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 id="test-email-modal-title" className="text-sm font-bold text-slate-900">
                  Send Test Email
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTestEmailOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Dispatches a transactional verification message using the active provider (
              <span className="font-semibold">{providers?.email.name || "Gmail SMTP"}</span>).
              Credentials and passwords are never exposed to the client.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="test-recipient-input" className="block text-xs font-semibold text-slate-700">
                  Recipient Email
                </label>
                <input
                  id="test-recipient-input"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {testEmailResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    testEmailResult.success
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border border-rose-200 text-rose-800"
                  }`}
                >
                  {testEmailResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <span>{testEmailResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestEmailOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testEmailSending || !testEmailRecipient.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {testEmailSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
