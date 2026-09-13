"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import { getToolBySlug } from "@/config/tools";
import { MessageSquareText, FileText, Upload, HelpCircle, ChevronRight } from "lucide-react";

export default function DocumentQAPage() {
  const tool = getToolBySlug("document-qa")!;
  const [inputText, setInputText] = useState<string>("");
  const [question, setQuestion] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      setInputText(text);
    } else {
      setInputText(`[Loaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\nPlease paste or review text here.`);
    }
  };

  const handleExecute = async (signal: AbortSignal) => {
    if (!inputText.trim()) throw new Error("Please enter document text first.");
    if (!question.trim()) throw new Error("Please enter a question to ask.");

    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: inputText,
        question: question.trim(),
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Question answering failed." }));
      throw new Error(err.error || "Question answering failed.");
    }

    const data = await res.json();
    const result = data.result;

    let output = `QUESTION:
${question}

ANSWER:
${result.answer}`;

    if (Array.isArray(result.citedContext) && result.citedContext.length > 0) {
      output += `\n\nCITED CONTEXT FROM DOCUMENT:\n${result.citedContext
        .map((c: string, i: number) => `[Citation ${i + 1}]: "${c}"`)
        .join("\n")}`;
    }

    return {
      text: output,
      citedPages: result.citedPages,
      details: {
        chunksUsed: data.chunksUsed,
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
          <span className="font-semibold text-slate-800">{tool?.name || "Ask This Document"}</span>
        </nav>

        {/* Header */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-xs">
            <MessageSquareText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Ask This Document
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Query your document using lightweight local chunk retrieval. Get grounded answers with
            direct citations and zero full-workspace syncing.
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
          resultTitle="Document Q&A Result"
          defaultOutputFilename="document-qa-result.txt"
          inputRender={({ disabled, onStart }) => (
            <div className="space-y-6">
              {/* Question Input (Prominent) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  What would you like to know about this document?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. What are the key eligibility criteria mentioned on page 2?"
                    className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs transition-colors"
                  />
                  <HelpCircle className="absolute right-4 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Document Text Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Document Text or Excerpts:
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload text file
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
                  placeholder="Paste document text here..."
                  rows={8}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Characters: {inputText.length.toLocaleString()} / 50,000</span>
                  <span>Lightweight local chunk retrieval selects only top relevant paragraphs</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!inputText.trim() || !question.trim() || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <MessageSquareText className="w-4 h-4" />
                  Ask Question
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
