"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AIToolRunner } from "@/components/ai/AIToolRunner";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import { GraduationCap, BookOpen, Sparkles, Upload, ShieldCheck, ChevronRight } from "lucide-react";
import { ToolDefinition } from "@/types/tool";

const studyAssistantToolDef: ToolDefinition = {
  id: "study-assistant",
  slug: "study-assistant",
  name: "AI Study Assistant",
  category: "student",
  subcategory: "academic",
  badge: "AI Study",
  description: "Explain course concepts, generate review questions, and synthesize revision points.",
  detailedDescription: "Privacy-respecting study intelligence for lecture notes and syllabus topics with strict academic calculation separation.",
  icon: "GraduationCap",
  route: "/student/study-assistant",
  status: "available",
  requiresAuth: false,
  requiresPro: false,
  supportedFormats: ["TXT", "MD"],
  inputFormats: ["text/plain", "text/markdown"],
  maxSizeMB: 10,
  requiresExternalProcessing: true,
  supportsLocalProcessing: false,
  supportsAI: true,
  privacyLevel: "external",
  processor: "ai-study",
  limits: { maxChars: 40000, maxMB: 10 },
  keywords: ["study assistant", "explain lecture", "exam questions", "revision points"],
};

export default function StudyAssistantPage() {
  const [materialText, setMaterialText] = useState("");
  const [topic, setTopic] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setMaterialText(text);
  };

  const handleExecute = async (signal: AbortSignal) => {
    if (!materialText.trim()) throw new Error("Please provide study material text.");

    const res = await fetch("/api/ai/study-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialText: materialText.trim(),
        topic: topic.trim() || undefined,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Study explanation failed." }));
      throw new Error(err.error || "Failed to process study material.");
    }

    const data = await res.json();
    const result = data.result;

    const formatted = `CONCEPTUAL EXPLANATION:
${result.explanation}

KEY TECHNICAL CONCEPTS:
${result.keyConcepts.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}

PRACTICE & REVIEW QUESTIONS:
${result.sampleQuestions.map((q: string, i: number) => `Q${i + 1}: ${q}`).join("\n")}

HIGH-YIELD REVISION POINTS:
${result.revisionPoints.map((p: string, i: number) => `• ${p}`).join("\n")}`;

    return {
      text: formatted,
      details: {
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
          <Link href="/student" className="hover:text-blue-600 transition-colors">
            Student
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">AI Study Assistant</span>
        </nav>

        {/* Header */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-xs">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            AI Study Assistant
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Synthesize lecture notes, explain complex syllabus topics, and generate practice
            questions. Deterministic academic grades and SGPA formulas remain 100% authoritative.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <PrivacyBadge mode="EXTERNAL" />
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              AI Study
            </span>
          </div>
        </div>

        {/* Academic Invariant Alert */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 leading-relaxed shadow-2xs font-medium">
          <strong className="text-blue-950 font-bold">Academic Calculation Separation:</strong>{" "}
          VTU SGPA, CGPA, marks boundaries, and attendance calculations are strictly deterministic
          and independent of AI. AI provides conceptual explanations and study assistance only.
        </div>

        {/* Runner */}
        <AIToolRunner
          tool={studyAssistantToolDef}
          onExecute={handleExecute}
          resultTitle="Study Material Explanation & Questions"
          defaultOutputFilename="study-notes-explanation.txt"
          inputRender={({ disabled, onStart }) => (
            <div className="space-y-6">
              {/* Optional Topic */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Topic / Concept Title (Optional):
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Graph Traversal Algorithms, Operating System Deadlocks..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Text Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Paste Lecture Notes or Syllabus Text:
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload text notes
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
                  value={materialText}
                  onChange={(e) => setMaterialText(e.target.value)}
                  placeholder="Paste lecture notes or textbook excerpt here..."
                  rows={9}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Characters: {materialText.length.toLocaleString()} / 40,000</span>
                  <span>Processes only explicitly selected material</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!materialText.trim() || disabled}
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Explain & Generate Review Questions
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
