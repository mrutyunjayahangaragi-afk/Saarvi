"use client";

import React, { useState, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import { getToolBySlug } from "@/config/tools";
import { MessageSquareText, FileText, Upload, HelpCircle } from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <MessageSquareText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Ask This Document</h1>
          <p className="text-sm text-slate-400">
            Query your document using lightweight local chunk retrieval. Get grounded answers with
            direct citations and zero full-workspace syncing.
          </p>
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
                <label className="text-xs font-semibold text-slate-300">
                  What would you like to know about this document?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. What are the key eligibility criteria mentioned on page 2?"
                    className="w-full rounded-xl border border-indigo-500/40 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  />
                  <HelpCircle className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              {/* Document Text Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Document Text or Excerpts:
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 p-4 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Characters: {inputText.length.toLocaleString()} / 50,000</span>
                  <span>Lightweight local chunk retrieval selects only top relevant paragraphs</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!inputText.trim() || !question.trim() || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-600/30"
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
