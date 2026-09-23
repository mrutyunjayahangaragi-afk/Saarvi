"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Mail,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Filter,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  User,
  Tag,
  Calendar,
  X,
} from "lucide-react";
import type { SupportTicket } from "@/app/api/admin/support/route";

export default function AdminSupportCenterPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("ALL");
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Notes & assignment inputs
  const [internalNotes, setInternalNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/support");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error("Failed to load support tickets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSelectTicket = (t: SupportTicket) => {
    setActiveTicket(t);
    setInternalNotes(t.internalNotes || "");
    setAssignedTo(t.assignedTo || "");
  };

  const handleUpdateStatus = async (id: string, newStatus: SupportTicket["status"]) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: newStatus,
          internalNotes,
          assignedTo,
        }),
      });

      if (res.ok) {
        setNotice(`Ticket marked as ${newStatus.replace("_", " ")}.`);
        await loadTickets();
        if (activeTicket && activeTicket.id === id) {
          setActiveTicket((prev) => (prev ? { ...prev, status: newStatus, internalNotes, assignedTo } : null));
        }
      }
    } catch (err) {
      setNotice("Failed to update ticket status.");
    } finally {
      setUpdating(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (selectedFilter !== "ALL" && t.status !== selectedFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.senderName.toLowerCase().includes(q) ||
        t.senderEmail.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <LifeBuoy className="w-6 h-6 text-blue-600" />
              <span>Support Center</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-50 text-blue-700 font-semibold border border-blue-100">
              saarvinotifications@gmail.com
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Incoming support inquiries, feedback, and student assistance requests routed to the official inbox.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTickets}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-blue-500 hover:text-blue-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Inquiries</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block font-mono">{counts.total}</span>
        </div>
        <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Open</span>
          <span className="text-2xl font-extrabold text-amber-900 mt-1 block font-mono">{counts.open}</span>
        </div>
        <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">In Progress</span>
          <span className="text-2xl font-extrabold text-blue-900 mt-1 block font-mono">{counts.inProgress}</span>
        </div>
        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Resolved</span>
          <span className="text-2xl font-extrabold text-emerald-900 mt-1 block font-mono">{counts.resolved}</span>
        </div>
      </div>

      {/* Main Layout: Ticket List & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ticket List (Left Column) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by sender, email, subject, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs"
              />
            </div>

            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedFilter === status
                      ? "bg-white text-blue-700 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {status === "ALL" ? "All" : status === "IN_PROGRESS" ? "In Progress" : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Cards */}
          <div className="space-y-2">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl">
                <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No support tickets found</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing filters or changing search query.</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = activeTicket?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/60 border-blue-300 shadow-xs"
                        : "bg-white border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{ticket.senderName}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({ticket.senderEmail})</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ticket.status === "OPEN"
                                ? "bg-amber-100 text-amber-800"
                                : ticket.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {ticket.status.replace("_", " ")}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-800 mt-1">{ticket.subject}</h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ticket.message}</p>
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md font-medium text-slate-600">
                        {ticket.category}
                      </span>
                      <span className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                        <span>Inspect Ticket</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket Inspector Panel (Right Column) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs sticky top-4">
          {activeTicket ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400">
                    Ticket ID: {activeTicket.id}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-0.5">{activeTicket.subject}</h3>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    activeTicket.status === "OPEN"
                      ? "bg-amber-100 text-amber-800"
                      : activeTicket.status === "IN_PROGRESS"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {activeTicket.status.replace("_", " ")}
                </span>
              </div>

              {/* Sender Details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">From:</span>
                  <strong className="text-slate-800">{activeTicket.senderName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email:</span>
                  <a
                    href={`mailto:${activeTicket.senderEmail}`}
                    className="text-blue-600 hover:underline font-mono"
                  >
                    {activeTicket.senderEmail}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Date Received:</span>
                  <span className="text-slate-600">{new Date(activeTicket.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* In-Message Body */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Message Body</span>
                <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {activeTicket.message}
                </div>
              </div>

              {/* Triage & Management Actions */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Assignee
                  </label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="e.g. Academic Lead, Support Team"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Internal Resolution Notes
                  </label>
                  <textarea
                    rows={3}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Enter internal resolution steps or notes for team..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStatus(activeTicket.id, "IN_PROGRESS")}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold transition"
                  >
                    Mark In Progress
                  </button>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStatus(activeTicket.id, "RESOLVED")}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    Mark Resolved
                  </button>
                  <a
                    href={`mailto:${activeTicket.senderEmail}?subject=Re: ${encodeURIComponent(activeTicket.subject)}`}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reply via Email</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">Select a ticket from the left to view details</p>
              <p className="text-[11px] text-slate-400 mt-1">Review student issues, update status, and reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
