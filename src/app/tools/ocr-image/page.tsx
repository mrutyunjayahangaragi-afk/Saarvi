"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import { getToolBySlug } from "@/config/tools";
import { Upload, ScanText, FileImage, Image as ImageIcon, AlertCircle, ChevronRight } from "lucide-react";

export default function OcrImagePage() {
  const tool = getToolBySlug("ocr-image")!;
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preprocess, setPreprocess] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      try {
        setPreviewUrl(URL.createObjectURL(selected));
      } catch {}
    }
  };

  const handleExecute = async (signal: AbortSignal) => {
    if (!file) throw new Error("Please select an image file first.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("preprocess", String(preprocess));

    const res = await fetch("/api/ocr/extract", {
      method: "POST",
      body: formData,
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "OCR extraction failed." }));
      throw new Error(err.error || "OCR extraction failed.");
    }

    const data = await res.json();
    return {
      text: data.result.text,
      details: {
        totalPages: data.result.totalPages,
        confidence: data.result.pages?.[0]?.confidence,
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
          <span className="font-semibold text-slate-800">{tool?.name || "Image to Text (OCR)"}</span>
        </nav>

        {/* Header */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-xs">
            <ScanText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Image to Text (OCR)
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Extract editable text from document photos, receipts, notes, and scans. Review and edit
            the text directly before exporting.
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
          resultTitle="Extracted Document Text"
          defaultOutputFilename={file ? `${file.name.replace(/\.[^/.]+$/, "")}-ocr.txt` : "ocr-result.txt"}
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
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="flex flex-col items-center space-y-3">
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="max-h-48 max-w-full rounded-2xl object-contain border border-slate-200 shadow-sm bg-white p-1"
                    />
                    <div className="text-center">
                      <p className="text-xs text-slate-800 font-bold">{file?.name}</p>
                      <span className="text-[11px] text-blue-600 font-semibold hover:underline mt-0.5 inline-block">
                        Click to choose a different photo
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-slate-800">
                        Drop your image here, or{" "}
                        <span className="text-blue-600 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Supports JPG, PNG, WEBP (up to 15 MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={preprocess}
                    onChange={(e) => setPreprocess(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Enhance text contrast & reconnect hyphenated words</span>
                </label>
              </div>

              {/* Start Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!file || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <ScanText className="w-4 h-4" />
                  Extract Text with OCR
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
