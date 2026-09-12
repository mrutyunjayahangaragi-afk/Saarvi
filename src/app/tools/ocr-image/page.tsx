"use client";

import React, { useState, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import { getToolBySlug } from "@/config/tools";
import { Upload, ScanText, FileImage, Image as ImageIcon, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <ScanText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Image to Text (OCR)</h1>
          <p className="text-sm text-slate-400">
            Extract editable text from document photos, receipts, notes, and scans. Review and edit
            the text directly before exporting.
          </p>
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
                className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  file
                    ? "border-indigo-500/50 bg-indigo-950/20"
                    : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900"
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
                      className="max-h-48 max-w-full rounded-lg object-contain border border-slate-700 shadow-md"
                    />
                    <p className="text-xs text-slate-300 font-medium">{file?.name}</p>
                    <span className="text-[11px] text-indigo-400 hover:underline">
                      Click to choose a different photo
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-800 text-slate-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-200">
                        Drop your image here, or{" "}
                        <span className="text-indigo-400 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Supports JPG, PNG, WEBP (up to 15 MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={preprocess}
                    onChange={(e) => setPreprocess(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Enhance text contrast & reconnect hyphenated words</span>
                </label>
              </div>

              {/* Start Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!file || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-600/30"
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
