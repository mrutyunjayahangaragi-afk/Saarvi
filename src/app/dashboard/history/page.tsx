"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  CheckCircle2,
  XCircle,
  Trash2,
  Lock,
  Filter,
  ArrowRight,
  Clock,
  Search,
  X,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { conversionHistoryService } from "@/lib/services/conversionHistoryService";
import { ConversionHistoryRecord } from "@/types/auth";
import { formatBytes } from "@/lib/utils";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import EmptyState from "@/components/dashboard/EmptyState";

const PAGE_SIZE = 20;

type SortOrder = "newest" | "oldest";
type FilterCategory = "all" | "pdf" | "images" | "student";

const CATEGORY_TOOL_MAP: Record<string, string[]> = {
  pdf: [
    "jpg-to-pdf",
    "pdf-to-jpg",
    "compress-pdf",
    "merge-pdf",
    "pdf-to-word",
    "word-to-pdf",
    "pdf-to-excel",
    "excel-to-pdf",
    "pdf-to-powerpoint",
    "powerpoint-to-pdf",
    "txt-to-pdf",
    "csv-to-pdf",
    "html-to-pdf"
  ],
  images: ["image-resize", "jpg-to-png", "png-to-jpg", "remove-bg", "image-compress"],
  student: ["resume", "notes-to-pdf", "plagiarism-check"],
};

function matchesCategory(toolId: string, category: FilterCategory): boolean {
  if (category === "all") return true;
  const tools = CATEGORY_TOOL_MAP[category] || [];
  return tools.some((t) => toolId.toLowerCase().includes(t));
}

export default function ConversionHistoryPage() {
  const [history, setHistory] = useState<ConversionHistoryRecord[]>([]);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Deletion state
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<ConversionHistoryRecord | null>(null);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Exposed retry function for the error banner
  async function loadHistory() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const records = await conversionHistoryService.getHistory();
      setHistory(records);
    } catch {
      setErrorMsg("We couldn't load your history. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadHistory(); }, []);

  // Derived page: reset to 1 whenever filter/search/sort changes
  // We track a separate "filter key" to avoid a setState-in-effect pattern
  const filterKey = `${filterCategory}|${sortOrder}|${searchQuery}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setCurrentPage(1);
  }

  // Filter + search + sort pipeline
  const processed = history
    .filter((r) => matchesCategory(r.toolId, filterCategory))
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (r.toolName || r.toolId).toLowerCase().includes(q) ||
        r.inputFilename.toLowerCase().includes(q) ||
        r.outputFilename.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === "newest" ? diff : -diff;
    });

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const paginated = processed.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await conversionHistoryService.clearHistory();
      setHistory([]);
      setClearConfirmOpen(false);
    } catch {
      setErrorMsg("Couldn't clear your history. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemConfirm) return;
    setDeletingId(deleteItemConfirm.id);
    try {
      await conversionHistoryService.deleteRecord(deleteItemConfirm.id);
      setHistory((prev) => prev.filter((h) => h.id !== deleteItemConfirm.id));
      setDeleteItemConfirm(null);
    } catch {
      setErrorMsg("Couldn't delete that record. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const FILTER_TABS: { key: FilterCategory; label: string }[] = [
    { key: "all", label: `All (${history.length})` },
    { key: "pdf", label: "PDF" },
    { key: "images", label: "Images" },
    { key: "student", label: "Student Tools" },
  ];

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-blue-600" />
            <span>Conversion History</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Metadata log of your in-browser document operations
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setClearConfirmOpen(true)}
            className="self-start sm:self-center px-3.5 py-2 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-700">
          <span>{errorMsg}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadHistory}
              className="font-semibold underline hover:text-red-800 cursor-pointer"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 text-red-400 hover:text-red-600 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* PRIVACY GUARANTEE BANNER */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3 text-xs text-emerald-900">
        <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">Privacy-First Architecture</p>
          <p className="text-emerald-800 leading-relaxed">
            Saarvi stores <strong>only operational metadata</strong> (tool names, file sizes, processing duration, and timestamps). Your actual document contents and pictures are never uploaded, analyzed, or stored on our servers.
          </p>
        </div>
      </div>

      {/* Search + Sort + Filter Bar */}
      {!loading && history.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search history…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white placeholder-slate-400"
              aria-label="Search conversion history"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            aria-label={`Sort by ${sortOrder === "newest" ? "oldest" : "newest"} first`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{sortOrder === "newest" ? "Newest first" : "Oldest first"}</span>
          </button>
        </div>
      )}

      {/* Category Filter Tabs */}
      {!loading && history.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs" role="tablist" aria-label="Filter by category">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3 h-3" aria-hidden="true" />
            Filter:
          </span>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filterCategory === tab.key}
              onClick={() => setFilterCategory(tab.key)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                filterCategory === tab.key
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* History Records */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-slate-100 rounded" />
                  <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
                  <div className="h-2 w-1/4 bg-slate-100 rounded" />
                </div>
                <div className="space-y-1.5 shrink-0">
                  <div className="h-3 w-14 bg-slate-100 rounded" />
                  <div className="h-2.5 w-10 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          searchQuery || filterCategory !== "all" ? (
            <div className="py-10 text-center text-xs text-slate-500 space-y-2">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No results found</p>
              <p>Try a different search term or category.</p>
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No conversion history yet"
              description="When you use tools like JPG to PDF, Compress PDF, or Image Resize while signed in, your conversion summary will appear here automatically."
              ctaLabel="Explore Tools"
              ctaHref="/tools"
            />
          )
        ) : (
          <div className="divide-y divide-slate-100">
            {paginated.map((item) => {
              const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const isSuccess = item.status === "Completed";

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors group"
                >
                  {/* Mobile card layout / Desktop row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSuccess
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-red-50 border-red-100"
                      }`}>
                        {isSuccess ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 capitalize">
                            {item.toolName || item.toolId.replace(/-/g, " ")}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap font-medium">
                          <span className="truncate max-w-[180px] text-slate-500">{item.inputFilename}</span>
                          <span className="text-slate-400">→</span>
                          <span className="truncate max-w-[180px] text-slate-800 font-semibold">{item.outputFilename}</span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span>{(item.processingTimeMs / 1000).toFixed(1)}s processing</span>
                          <span>•</span>
                          <span>{formatBytes(item.inputSize)} → {formatBytes(item.outputSize)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-2 sm:ml-4 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <Link
                        href={`/tools/${item.toolId}`}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                        aria-label={`Reuse ${item.toolName || item.toolId} tool`}
                      >
                        <span>Use tool</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                      <span className="text-slate-200 select-none">|</span>
                      <button
                        type="button"
                        onClick={() => setDeleteItemConfirm(item)}
                        disabled={deletingId === item.id}
                        className="text-xs text-slate-400 hover:text-red-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        aria-label={`Delete record for ${item.toolName || item.toolId}`}
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span>{deletingId === item.id ? "Deleting…" : "Delete"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-slate-500 font-medium">
            Page {currentPage} of {totalPages} &nbsp;·&nbsp; {processed.length} records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm: Clear All History */}
      <ConfirmDialog
        isOpen={clearConfirmOpen}
        title="Clear your conversion history?"
        description="This removes saved activity metadata from your account. It does NOT delete your documents — they were never uploaded."
        confirmLabel="Clear History"
        isDangerous
        isLoading={clearing}
        onConfirm={handleClearHistory}
        onCancel={() => setClearConfirmOpen(false)}
      />

      {/* Confirm: Delete Single Record */}
      <ConfirmDialog
        isOpen={!!deleteItemConfirm}
        title="Delete this record?"
        description={`Remove the "${deleteItemConfirm?.toolName || deleteItemConfirm?.toolId.replace(/-/g, " ") || "conversion"}" entry from your history. Your original files are not affected.`}
        confirmLabel="Delete Record"
        isDangerous
        isLoading={!!deletingId}
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItemConfirm(null)}
      />

    </div>
  );
}
