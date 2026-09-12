"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Pin,
  Archive,
  Trash2,
  Download,
  FileText,
  Shield,
  Clock,
  Sparkles,
  Edit2,
  Check,
  X,
  User,
  Bot,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { conversationService } from "@/lib/services/conversationService";
import { Conversation, ConversationMessage } from "@/types/conversation";

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const profileId = user?.id || "guest";

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editableTitle, setEditableTitle] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadConversation = async () => {
    try {
      setLoading(true);
      const conv = await conversationService.getConversation(id);
      if (!conv) {
        showToast("Conversation not found", "error");
        router.push("/dashboard/conversations");
        return;
      }
      setConversation(conv);
      setEditableTitle(conv.title);

      const msgs = await conversationService.getMessages(id);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      showToast("Error loading conversation", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadConversation();
    }
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !conversation) return;

    setInputText("");

    try {
      const newMsg = await conversationService.sendMessage(conversation.id, "USER", clean);
      setMessages((prev) => [...prev, newMsg]);

      // Refresh conversation metadata
      const updatedConv = await conversationService.getConversation(conversation.id);
      if (updatedConv) {
        setConversation(updatedConv);
        setEditableTitle(updatedConv.title);
      }
    } catch (err) {
      showToast("Failed to save message", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveTitle = async () => {
    if (!conversation || !editableTitle.trim()) return;
    try {
      await conversationService.updateConversation(conversation.id, {
        title: editableTitle.trim(),
      });
      setConversation((prev) => (prev ? { ...prev, title: editableTitle.trim() } : null));
      setIsEditingTitle(false);
      showToast("Title saved");
    } catch {
      showToast("Failed to save title", "error");
    }
  };

  const handleTogglePin = async () => {
    if (!conversation) return;
    try {
      await conversationService.setPinned(conversation.id, !conversation.pinned);
      setConversation((prev) => (prev ? { ...prev, pinned: !prev.pinned } : null));
      showToast(conversation.pinned ? "Conversation unpinned" : "Conversation pinned");
    } catch {
      showToast("Failed to update pin", "error");
    }
  };

  const handleToggleArchive = async () => {
    if (!conversation) return;
    try {
      await conversationService.setArchived(conversation.id, !conversation.archived);
      setConversation((prev) => (prev ? { ...prev, archived: !prev.archived } : null));
      showToast(conversation.archived ? "Conversation unarchived" : "Conversation archived");
    } catch {
      showToast("Failed to update archive", "error");
    }
  };

  const handleDelete = async () => {
    if (!conversation) return;
    if (window.confirm("Permanently delete this conversation and all its messages?")) {
      try {
        await conversationService.deleteConversation(conversation.id);
        router.push("/dashboard/conversations");
      } catch {
        showToast("Failed to delete conversation", "error");
      }
    }
  };

  const handleExportMarkdown = async () => {
    if (!conversation) return;
    try {
      const md = await conversationService.exportConversationAsMarkdown(conversation.id);
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${conversation.title.replace(/[^\w\s-]/g, "")}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exported to Markdown");
    } catch {
      showToast("Export failed", "error");
    }
  };

  if (loading || !conversation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-slate-400 text-sm font-medium">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all ${
            notification.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Top Navigation & Controls */}
      <header className="sticky top-16 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard/conversations"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
              title="Back to conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    className="px-2.5 py-1 text-sm font-bold border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditableTitle(conversation.title);
                      setIsEditingTitle(false);
                    }}
                    className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {conversation.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                    title="Edit title"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {conversation.pinned && (
                    <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-600" />
                  Local Memory
                </span>
                <span>•</span>
                <span>{messages.length} message{messages.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleTogglePin}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                conversation.pinned
                  ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
              title={conversation.pinned ? "Unpin conversation" : "Pin conversation"}
            >
              <Pin className={`w-4 h-4 ${conversation.pinned ? "fill-amber-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleToggleArchive}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                conversation.archived
                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
              title={conversation.archived ? "Unarchive conversation" : "Archive conversation"}
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Export as Markdown (.md)"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              title="Delete conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Message History Feed */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">New Conversation</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Type a message, note, or study query below. Your conversation is saved locally on your device.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto pt-2">
              {[
                "Calculate classes needed to reach 75% attendance in Mathematics",
                "Draft key bullets for Software Engineer resume",
                "Create a 3-day study plan for Operating Systems exam",
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(prompt);
                    inputRef.current?.focus();
                  }}
                  className="text-[11px] text-left p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-blue-300 text-slate-600 hover:text-blue-600 transition-all shadow-2xs cursor-pointer"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "USER";
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-xl rounded-2xl p-4 space-y-1.5 shadow-2xs text-xs sm:text-sm ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 text-[10px] font-semibold ${
                      isUser ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    <span>{isUser ? "You" : "Assistant"}</span>
                    <span>•</span>
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
                {isUser && (
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Message Composer Footer */}
      <footer className="sticky bottom-0 bg-white border-t border-slate-200/80 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message or notes... (Press Enter to send)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none max-h-32"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl shadow-xs hover:shadow transition-all cursor-pointer shrink-0"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
            <span className="flex items-center gap-1 text-emerald-600">
              <Shield className="w-3 h-3" />
              100% Local in IndexedDB (Zero Cloud Sync)
            </span>
            <span>Shift + Enter for new line</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
