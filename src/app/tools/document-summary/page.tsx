"use client";

import React, { useState, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import { getToolBySlug } from "@/config/tools";
import { Sparkles, FileText, Upload } from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Document Summarizer</h1>
          <p className="text-sm text-slate-400">
            Generate clean, concise summaries and structured key takeaways with explicit privacy
            consent and configurable length options.
          </p>
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
                  <label className="text-xs font-semibold text-slate-300">
                    Document Content (Paste or Upload):
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 p-4 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Characters: {inputText.length.toLocaleString()} / 50,000</span>
                  <span>Data is processed ephemerally with zero permanent cloud storage</span>
                </div>
              </div>

              {/* Length & Focus Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Summary Length:</label>
                  <div className="flex gap-2">
                    {(["brief", "standard", "detailed"] as AISummaryLength[]).map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setSummaryLength(len)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                          summaryLength === len
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Optional Topic Focus:
                  </label>
                  <input
                    type="text"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="e.g. key conclusions, technical steps..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!inputText.trim() || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-600/30"
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
