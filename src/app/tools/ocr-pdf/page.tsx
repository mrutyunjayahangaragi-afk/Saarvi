"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import { getToolBySlug } from "@/config/tools";
import { Upload, FileSearch, FileText, ChevronRight } from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/tools" className="hover:text-blue-600 transition-colors">
            Tools
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">{tool?.name || "Scanned PDF to Text"}</span>
        </nav>

        {/* Header */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-xs">
            <FileSearch className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Scanned PDF to Text & Searchable PDF
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Extract text from scanned PDF documents with selective page range processing, text
            review, and searchable PDF export.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <PrivacyBadge mode="EXTERNAL" />
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              OCR & AI
            </span>
          </div>
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
                className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
                  file
                    ? "border-blue-500 bg-blue-50/40 shadow-xs"
                    : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/70 shadow-xs"
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
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center shadow-xs">
                      <FileText className="w-7 h-7 text-red-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <span className="text-xs text-blue-600 font-semibold hover:underline pt-1 inline-block">
                      Click to choose another PDF
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-slate-800">
                        Drop your scanned PDF here, or{" "}
                        <span className="text-blue-600 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500">Supports PDF documents up to 25 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Page Range Selection */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Select Page Range to Process:
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Max 20 pages per request</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">Start Page:</label>
                    <input
                      type="number"
                      min={1}
                      value={startPage}
                      onChange={(e) => setStartPage(Math.max(1, Number(e.target.value)))}
                      className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">End Page:</label>
                    <input
                      type="number"
                      min={startPage}
                      value={endPage}
                      onChange={(e) =>
                        setEndPage(Math.max(startPage, Number(e.target.value)))
                      }
                      className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!file || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg cursor-pointer"
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
