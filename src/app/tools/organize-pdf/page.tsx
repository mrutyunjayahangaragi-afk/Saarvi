"use client";

import { useState, useRef, useCallback } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Upload,
  Trash2,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Download,
  ShieldCheck,
  LayoutGrid,
  CheckSquare,
  Square,
  Loader2,
  FileText,
  AlertCircle,
  X,
  Check,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { loadPdfjs } from "@/lib/tools/pdf/pdfjs-loader";

interface PageItem {
  originalIndex: number; // 0-based index in source PDF
  rotation: 0 | 90 | 180 | 270; // additional rotation to apply
  thumbnail: string | null; // data URL
  selected: boolean;
}

type ProcessState = "idle" | "loading" | "ready" | "exporting" | "done" | "error";

const MAX_SIZE_MB = 50;
const THUMB_SCALE = 0.18; // small thumbnails — 96px wide approx

export default function OrganizePdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [processState, setProcessState] = useState<ProcessState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Derived
  const selectedCount = pages.filter((p) => p.selected).length;
  const allSelected = pages.length > 0 && selectedCount === pages.length;

  // ─── File loading ──────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Please select a valid PDF file.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`This file is too large for browser processing (max ${MAX_SIZE_MB} MB).`);
      return;
    }

    setErrorMsg(null);
    setResultBlob(null);
    setResultUrl(null);
    setCountdown(null);
    setSourceFile(file);
    setProcessState("loading");
    setLoadProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await loadPdfjs();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      const items: PageItem[] = [];

      for (let i = 0; i < numPages; i++) {
        const page = await pdfDoc.getPage(i + 1);
        const viewport = page.getViewport({ scale: THUMB_SCALE });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }

        items.push({
          originalIndex: i,
          rotation: 0,
          thumbnail: canvas.toDataURL("image/jpeg", 0.7),
          selected: false,
        });

        // Cleanup canvas
        canvas.width = 0;
        canvas.height = 0;

        setLoadProgress(Math.round(((i + 1) / numPages) * 100));
      }

      setPages(items);
      setProcessState("ready");
    } catch {
      setErrorMsg("We couldn't read this PDF. It may be corrupted or password-protected.");
      setProcessState("error");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ─── Page actions ──────────────────────────────────────────────────
  const toggleSelect = (idx: number) => {
    setPages((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleSelectAll = () => {
    const newVal = !allSelected;
    setPages((prev) => prev.map((p) => ({ ...p, selected: newVal })));
  };

  const deleteSelected = () => {
    if (selectedCount >= pages.length) {
      setErrorMsg("You must keep at least one page in the document.");
      return;
    }
    setPages((prev) => prev.filter((p) => !p.selected));
    setErrorMsg(null);
  };

  const rotateSelected = () => {
    setPages((prev) =>
      prev.map((p) =>
        p.selected
          ? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 }
          : p
      )
    );
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setPages((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx === pages.length - 1) return;
    setPages((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  // ─── Export ────────────────────────────────────────────────────────
  function triggerDownload(url: string, filename: string) {
    const baseName = filename.replace(/\.pdf$/i, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_organized.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const handleExport = useCallback(async () => {
    if (!sourceFile || pages.length === 0) return;

    setProcessState("exporting");
    setExportProgress(0);
    setErrorMsg(null);

    try {
      const arrayBuffer = await sourceFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      // Copy pages in current display order
      const indices = pages.map((p) => p.originalIndex);
      const copiedPages = await newDoc.copyPages(srcDoc, indices);

      for (let i = 0; i < copiedPages.length; i++) {
        const pg = newDoc.addPage(copiedPages[i]);
        // Apply additional rotation
        if (pages[i].rotation !== 0) {
          const existingRotation = pg.getRotation().angle;
          pg.setRotation(degrees((existingRotation + pages[i].rotation) % 360));
        }
        setExportProgress(Math.round(((i + 1) / copiedPages.length) * 80));
      }

      const pdfBytes = await newDoc.save();
      setExportProgress(95);

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setResultBlob(blob);
      setResultUrl(url);
      setProcessState("done");
      setExportProgress(100);

      // 3-second auto-download countdown
      let c = 3;
      setCountdown(c);
      const interval = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(interval);
          setCountdown(null);
          triggerDownload(url, sourceFile.name);
        }
      }, 1000);
    } catch {
      setErrorMsg("Export failed. Please try again.");
      setProcessState("ready");
    }
  }, [sourceFile, pages]);


  const handleDownloadNow = () => {
    if (!resultUrl || !sourceFile) return;
    setCountdown(null);
    triggerDownload(resultUrl, sourceFile.name);
  };

  const handleReset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setSourceFile(null);
    setPages([]);
    setProcessState("idle");
    setErrorMsg(null);
    setResultBlob(null);
    setResultUrl(null);
    setCountdown(null);
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <LayoutGrid className="w-3.5 h-3.5" />
            PDF Tools
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Organize PDF
          </h1>
          <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
            Upload a PDF to view all pages as thumbnails. Select pages to delete, rotate, or move. Export a new PDF with your changes.
          </p>
        </div>

        {/* Privacy Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Local processing — your PDF never leaves your browser</span>
        </div>

        {/* ── UPLOAD ZONE ── */}
        {processState === "idle" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white rounded-3xl p-12 flex flex-col items-center gap-4 transition-colors cursor-pointer text-center"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            aria-label="Upload PDF file"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center">
              <Upload className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Drop your PDF here or click to browse</p>
              <p className="text-xs text-slate-500 mt-1">Up to {MAX_SIZE_MB} MB · PDF only</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* ── LOADING ── */}
        {processState === "loading" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-10 flex flex-col items-center gap-5 shadow-xs">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm font-bold text-slate-900">Loading PDF pages…</p>
            <div className="w-full max-w-sm bg-slate-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{loadProgress}% — rendering thumbnails</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-400 hover:text-red-600 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── RESULT ── */}
        {processState === "done" && resultBlob && (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">PDF organized successfully</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {pages.length} pages · {formatBytes(resultBlob.size)}
                  {countdown !== null && (
                    <span className="ml-2 text-blue-600 font-bold">Auto-download in {countdown}s…</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadNow}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Now
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* ── PAGE MANAGER ── */}
        {processState === "ready" || processState === "exporting" ? (
          <div className="space-y-5">
            {/* Toolbar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3 flex-wrap">
                {/* File info */}
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="font-bold truncate max-w-[180px]">{sourceFile?.name}</span>
                  <span className="text-slate-400">·</span>
                  <span>{pages.length} pages</span>
                  <span className="text-slate-400">·</span>
                  <span>{formatBytes(sourceFile?.size ?? 0)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label={allSelected ? "Deselect all" : "Select all pages"}
                >
                  {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {allSelected ? "Deselect all" : "Select all"}
                </button>

                {selectedCount > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={rotateSelected}
                      disabled={processState === "exporting"}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                      aria-label={`Rotate ${selectedCount} selected page${selectedCount > 1 ? "s" : ""} 90° clockwise`}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotate ({selectedCount})
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelected}
                      disabled={processState === "exporting"}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
                      aria-label={`Delete ${selectedCount} selected page${selectedCount > 1 ? "s" : ""}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete ({selectedCount})
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Change file
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={processState === "exporting" || pages.length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {processState === "exporting" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Exporting… {exportProgress}%
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Export PDF
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Export progress bar */}
            {processState === "exporting" && (
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            )}

            {/* Page Grid */}
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
              role="list"
              aria-label="PDF pages"
            >
              {pages.map((page, idx) => (
                <div
                  key={`${page.originalIndex}-${idx}`}
                  role="listitem"
                  className={`bg-white border-2 rounded-2xl overflow-hidden shadow-xs transition-all select-none ${
                    page.selected
                      ? "border-blue-500 shadow-md ring-2 ring-blue-300/60"
                      : "border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  {/* Thumbnail */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(idx)}
                    className="w-full block bg-slate-50 relative cursor-pointer"
                    aria-label={`Page ${idx + 1}${page.selected ? " (selected)" : ""}`}
                    aria-pressed={page.selected}
                  >
                    {page.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL from canvas, not an external image
                      <img
                        src={page.thumbnail}
                        alt={`Page ${idx + 1} thumbnail`}
                        className="w-full h-auto block"
                        style={{
                          transform: page.rotation ? `rotate(${page.rotation}deg)` : undefined,
                          transition: "transform 0.2s ease",
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                    {page.selected && (
                      <div className="absolute inset-0 bg-blue-600/12 flex items-start justify-end p-1.5">
                        <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                      </div>
                    )}
                    {page.rotation > 0 && (
                      <div className="absolute bottom-1 right-1 bg-slate-900/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        +{page.rotation}°
                      </div>
                    )}
                  </button>

                  {/* Page footer */}
                  <div className="p-2 flex items-center justify-between bg-white">
                    <span className="text-[10px] font-bold text-slate-500">p.{idx + 1}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0 || processState === "exporting"}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded transition-colors cursor-pointer"
                        aria-label={`Move page ${idx + 1} up`}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === pages.length - 1 || processState === "exporting"}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded transition-colors cursor-pointer"
                        aria-label={`Move page ${idx + 1} down`}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Help text */}
            <p className="text-xs text-slate-400 text-center">
              Click a thumbnail to select/deselect · Use Move Up/Down to reorder · Rotate or Delete selected pages · Export when ready
            </p>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
