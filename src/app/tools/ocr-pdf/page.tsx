"use client";

import React, { useState, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import { getToolBySlug } from "@/config/tools";
import { Upload, FileSearch, FileText } from "lucide-react";

export default function OcrPdfPage() {
  const tool = getToolBySlug("ocr-pdf")!;
  const [file, setFile] = useState<File | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleExecute = async (signal: AbortSignal) => {
    if (!file) throw new Error("Please select a scanned PDF file.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("startPage", String(startPage));
    formData.append("endPage", String(endPage));

    const res = await fetch("/api/ocr/extract", {
      method: "POST",
      body: formData,
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "PDF OCR extraction failed." }));
      throw new Error(err.error || "PDF OCR extraction failed.");
    }

    const data = await res.json();
    return {
      text: data.result.text,
      details: {
        totalPages: data.result.totalPages,
      },
    };
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <FileSearch className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Scanned PDF to Text & Searchable PDF
          </h1>
          <p className="text-sm text-slate-400">
            Extract text from scanned PDF documents with selective page range processing, text
            review, and searchable PDF export.
          </p>
        </div>

        {/* Runner */}
        <AIToolRunner
          tool={tool}
          onExecute={handleExecute}
          resultTitle="Extracted PDF Text"
          defaultOutputFilename={file ? `${file.name.replace(/\.pdf$/i, "")}-ocr.txt` : "pdf-ocr.txt"}
          allowSearchablePdf={true}
          inputRender={({ disabled, onStart }) => (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onClick={() => !disabled && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  file
                    ? "border-indigo-500/50 bg-indigo-950/20"
                    : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <span className="text-xs text-indigo-400 hover:underline pt-1">
                      Click to choose another PDF
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-800 text-slate-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-200">
                        Drop your scanned PDF here, or{" "}
                        <span className="text-indigo-400 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500">Supports PDF documents up to 25 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Page Range Selection */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Select Page Range to Process:
                  </span>
                  <span className="text-[11px] text-slate-500">Max 20 pages per request</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Start Page:</label>
                    <input
                      type="number"
                      min={1}
                      value={startPage}
                      onChange={(e) => setStartPage(Math.max(1, Number(e.target.value)))}
                      className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">End Page:</label>
                    <input
                      type="number"
                      min={startPage}
                      value={endPage}
                      onChange={(e) =>
                        setEndPage(Math.max(startPage, Number(e.target.value)))
                      }
                      className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!file || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-600/30"
                >
                  <FileSearch className="w-4 h-4" />
                  Process Scanned PDF
                </button>
              </div>
            </div>
          )}
        />
      </main>

      <Footer />
    </div>
  );
}
