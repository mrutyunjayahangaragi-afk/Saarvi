"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Pin,
  Archive,
  Trash2,
  Edit2,
  Search,
  Download,
  Upload,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { conversationService } from "@/lib/services/conversationService";
import { Conversation } from "@/types/conversation";

export default function ConversationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const profileId = user?.id || "guest";
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pinned" | "archived">("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations
  const loadData = async () => {
    try {
      setLoading(true);
      const list = await conversationService.listConversations(profileId);
      setConversations(list);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, profileId]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      const conv = await conversationService.createConversation(profileId);
      router.push(`/dashboard/conversations/${conv.id}`);
    } catch (err) {
      showToast("Failed to create conversation", "error");
    }
  };

  // Pin / Unpin
  const handleTogglePin = async (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await conversationService.setPinned(c.id, !c.pinned);
      setConversations((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, pinned: !c.pinned } : item))
      );
      showToast(c.pinned ? "Conversation unpinned" : "Conversation pinned");
    } catch {
      showToast("Failed to update pin status", "error");
    }
  };

  // Archive / Unarchive
  const handleToggleArchive = async (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await conversationService.setArchived(c.id, !c.archived);
      setConversations((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, archived: !c.archived } : item))
      );
      showToast(c.archived ? "Conversation unarchived" : "Conversation archived");
    } catch {
      showToast("Failed to update archive status", "error");
    }
  };

  // Delete
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to permanently delete this conversation and all its messages?")) {
      try {
        await conversationService.deleteConversation(id);
        setConversations((prev) => prev.filter((item) => item.id !== id));
        showToast("Conversation deleted");
      } catch {
        showToast("Failed to delete conversation", "error");
      }
    }
  };

  // Rename
  const handleStartRename = (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(c.id);
    setNewTitle(c.title);
  };

  const handleSaveRename = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newTitle.trim()) return;
    try {
      await conversationService.updateConversation(id, { title: newTitle.trim() });
      setConversations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, title: newTitle.trim() } : item))
      );
      setRenamingId(null);
      showToast("Title updated");
    } catch {
      showToast("Failed to update title", "error");
    }
  };

  // Export
  const handleExport = async () => {
    try {
      const json = await conversationService.exportAsJson(profileId);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saarvi-conversations-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Conversations exported successfully");
    } catch {
      showToast("Export failed", "error");
    }
  };

  // Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await conversationService.importFromJson(text, profileId);
      if (result.success) {
        showToast("Conversations imported successfully");
        loadData();
      } else {
        showToast(result.errors[0] || "Invalid file format", "error");
      }
    } catch {
      showToast("Failed to import file", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Filtered list
  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      // Tab filter
      if (activeTab === "pinned" && !c.pinned) return false;
      if (activeTab === "archived" && !c.archived) return false;
      if (activeTab === "all" && c.archived) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchSummary = c.summary?.toLowerCase().includes(q);
        return matchTitle || matchSummary;
      }
      return true;
    });
  }, [conversations, activeTab, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Notification Toast */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all ${
              notification.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              <MessageSquare className="w-4 h-4" />
              <span>Workspace Memory</span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-medium">
                <Shield className="w-3 h-3 text-emerald-600" />
                Local IndexedDB
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Conversations
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Persistent local chat history and notes, stored privately on this device.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              title="Import conversations JSON"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={conversations.length === 0}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              title="Export conversations JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNewConversation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Conversation</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              All ({conversations.filter((c) => !c.archived).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pinned")}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "pinned"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Pin className="w-3 h-3" />
              <span>Pinned ({conversations.filter((c) => c.pinned && !c.archived).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("archived")}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "archived"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Archive className="w-3 h-3" />
              <span>Archived ({conversations.filter((c) => c.archived).length})</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2 bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading conversations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {searchQuery ? "No matching conversations" : "No conversations yet"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? "Try searching for a different keyword or clear your query filter."
                  : "Start a conversation to plan studies, take notes, or review career applications."}
              </p>
            </div>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleNewConversation}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start New Conversation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between p-4 bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-xs ${
                  c.pinned
                    ? "border-amber-200/80 bg-gradient-to-r from-amber-50/20 to-white"
                    : "border-slate-200/80 hover:border-blue-200"
                }`}
              >
                {/* Main Link */}
                <div className="flex-1 min-w-0 pr-4">
                  {renamingId === c.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="px-2.5 py-1 text-sm font-bold border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(c.id, e)}
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(null);
                        }}
                        className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Link href={`/dashboard/conversations/${c.id}`} className="block">
                      <div className="flex items-center gap-2">
                        {c.pinned && (
                          <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {c.title}
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                          {c.messageCount} msg{c.messageCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      {c.summary && (
                        <p className="text-xs text-slate-500 mt-1 truncate max-w-xl">
                          {c.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated {new Date(c.updatedAt).toLocaleDateString()} at{" "}
                          {new Date(c.updatedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleTogglePin(c, e)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      c.pinned
                        ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    }`}
                    title={c.pinned ? "Unpin conversation" : "Pin to top"}
                  >
                    <Pin className={`w-3.5 h-3.5 ${c.pinned ? "fill-amber-500" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(c, e)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    title="Rename conversation"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleToggleArchive(c, e)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      c.archived
                        ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    }`}
                    title={c.archived ? "Unarchive conversation" : "Archive conversation"}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(c.id, e)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    href={`/dashboard/conversations/${c.id}`}
                    className="p-2 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
