"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import { getToolBySlug } from "@/config/tools";
import { Sparkles, FileText, Upload, ChevronRight } from "lucide-react";
import { AISummaryLength } from "@/types/ai";

export default function DocumentSummaryPage() {
  const tool = getToolBySlug("document-summary")!;
  const [inputText, setInputText] = useState<string>("");
  const [summaryLength, setSummaryLength] = useState<AISummaryLength>("standard");
  const [focus, setFocus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      setInputText(text);
    } else {
      // For binary files like PDF, extract text or instruct user
      setInputText(`[Loaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\nPlease paste or review text here.`);
    }
  };

  const handleExecute = async (signal: AbortSignal) => {
    if (!inputText.trim()) throw new Error("Please enter or upload document text to summarize.");

    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: inputText,
        options: {
          length: summaryLength,
          focus: focus.trim() || undefined,
        },
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Summarization failed." }));
      throw new Error(err.error || "Summarization failed.");
    }

    const data = await res.json();
    const result = data.result;

    const formattedOutput = `SUMMARY (${summaryLength.toUpperCase()}):
${result.summary}

KEY TAKEAWAYS:
${result.keyPoints.map((pt: string, i: number) => `${i + 1}. ${pt}`).join("\n")}`;

    return {
      text: formattedOutput,
      details: {
        charCount: result.charCount,
        model: result.model,
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
          <span className="font-semibold text-slate-800">{tool?.name || "Document Summarizer"}</span>
        </nav>

        {/* Header */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-xs">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Document Summarizer
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Generate clean, concise summaries and structured key takeaways with explicit privacy
            consent and configurable length options.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <PrivacyBadge mode="EXTERNAL" />
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              AI-assisted
            </span>
          </div>
        </div>

        {/* Runner */}
        <AIToolRunner
          tool={tool}
          onExecute={handleExecute}
          resultTitle="Document Summary & Takeaways"
          defaultOutputFilename="document-summary.txt"
          inputRender={({ disabled, onStart }) => (
            <div className="space-y-6">
              {/* Text Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Document Content (Paste or Upload):
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload .txt or .md file
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your document text, lecture notes, or report content here..."
                  rows={10}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Characters: {inputText.length.toLocaleString()} / 50,000</span>
                  <span>Data is processed ephemerally with zero permanent cloud storage</span>
                </div>
              </div>

              {/* Length & Focus Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Summary Length:</label>
                  <div className="flex gap-2">
                    {(["brief", "standard", "detailed"] as AISummaryLength[]).map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setSummaryLength(len)}
                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                          summaryLength === len
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Optional Topic Focus:
                  </label>
                  <input
                    type="text"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="e.g. key conclusions, technical steps..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!inputText.trim() || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Summarize Document
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
