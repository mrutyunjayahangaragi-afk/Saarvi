"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  HelpCircle,
} from "lucide-react";
import type { InterviewQuestion } from "@/types/interview";

interface QuestionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingQuestions: InterviewQuestion[];
  onImportComplete: (count: number) => void;
}

interface ParsedQuestionItem {
  question: string;
  role: string;
  company: string;
  difficulty: "Easy" | "Medium" | "Hard";
  type: "mcq" | "video_speech";
  category: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  isDuplicate: boolean;
  isValid: boolean;
}

export default function QuestionImportModal({
  isOpen,
  onClose,
  existingQuestions,
  onImportComplete,
}: QuestionImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedQuestionItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const existingTextSet = new Set(
    existingQuestions.map((q) => q.question.toLowerCase().trim())
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setErrorMessage(null);
    setFile(selected);
    setIsParsing(true);

    try {
      const text = await selected.text();
      let rawList: any[] = [];

      if (selected.name.endsWith(".json")) {
        const json = JSON.parse(text);
        rawList = Array.isArray(json) ? json : json.questions || [];
      } else if (selected.name.endsWith(".csv") || selected.type === "text/csv") {
        rawList = parseCsvQuestions(text);
      } else {
        throw new Error("Please upload a .csv or .json file.");
      }

      if (rawList.length === 0) {
        throw new Error("No questions could be parsed from the file.");
      }

      const validated: ParsedQuestionItem[] = rawList.map((item) => {
        const questionText = (item.question || "").trim();
        const role = (item.role || "Software Engineer").trim();
        const company = (item.company || "General Tech").trim();
        const diff = (item.difficulty || "Medium").trim();
        const difficulty = ["Easy", "Medium", "Hard"].includes(diff)
          ? (diff as "Easy" | "Medium" | "Hard")
          : "Medium";
        const type = item.type === "video_speech" ? "video_speech" : "mcq";
        const category = (item.category || "Technical").trim();

        let options: string[] = ["Option A", "Option B", "Option C", "Option D"];
        if (Array.isArray(item.options)) {
          options = item.options.map(String);
        } else if (typeof item.options === "string") {
          options = item.options.split("|").map((o: string) => o.trim());
        }

        const correctAnswer = typeof item.correctAnswer === "number" ? item.correctAnswer : 0;
        const explanation = (item.explanation || "").trim();

        const isDuplicate = existingTextSet.has(questionText.toLowerCase());
        const isValid = questionText.length > 5;

        return {
          question: questionText,
          role,
          company,
          difficulty,
          type,
          category,
          options,
          correctAnswer,
          explanation,
          isDuplicate,
          isValid,
        };
      });

      setParsedItems(validated);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse file.");
      setParsedItems([]);
    } finally {
      setIsParsing(false);
    }
  };

  const parseCsvQuestions = (csvText: string): any[] => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      // Regex CSV splitter handling quoted fields
      const values: string[] = [];
      let inQuotes = false;
      let cur = "";

      for (let c = 0; c < row.length; c++) {
        const char = row[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(cur.trim().replace(/^"|"$/g, ""));
          cur = "";
        } else {
          cur += char;
        }
      }
      values.push(cur.trim().replace(/^"|"$/g, ""));

      const item: any = {};
      headers.forEach((h, idx) => {
        item[h] = values[idx] || "";
      });

      if (item.question) {
        results.push(item);
      }
    }

    return results;
  };

  const validItemsToImport = parsedItems.filter((item) => item.isValid && !item.isDuplicate);

  const handleCommitImport = async () => {
    if (validItemsToImport.length === 0) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_questions",
          questions: validItemsToImport,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to import questions");
      }

      onImportComplete(data.count || validItemsToImport.length);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Import execution failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-6 shadow-2xl animate-in fade-in duration-150 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Bulk Import Interview Questions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload curated dataset in CSV or JSON format with automatic deduplication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Upload Zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        {!file ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-[#162244]/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#111c38] shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 dark:text-white block">
                Click to choose CSV or JSON question file
              </span>
              <span className="text-xs text-slate-400">
                Supports standard Saarvi question schema or Google Colab generated exports
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-[#162244] border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">{file.name}</span>
                <span className="text-[11px] text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB &bull; {parsedItems.length} questions detected
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setParsedItems([]);
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 font-semibold cursor-pointer"
            >
              Remove
            </button>
          </div>
        )}

        {/* Parsing Indicator */}
        {isParsing && (
          <div className="py-6 flex flex-col items-center justify-center space-y-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Parsing question dataset...</span>
          </div>
        )}

        {/* Validation Summary Matrix */}
        {parsedItems.length > 0 && !isParsing && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                <span className="text-[10px] uppercase tracking-wider font-bold block text-emerald-700 dark:text-emerald-400">Ready to Import</span>
                <span className="text-xl font-extrabold font-mono">{validItemsToImport.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                <span className="text-[10px] uppercase tracking-wider font-bold block text-amber-700 dark:text-amber-400">Duplicates (Skipped)</span>
                <span className="text-xl font-extrabold font-mono">
                  {parsedItems.filter((i) => i.isDuplicate).length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                <span className="text-[10px] uppercase tracking-wider font-bold block text-slate-500 dark:text-slate-400">Total in File</span>
                <span className="text-xl font-extrabold font-mono">{parsedItems.length}</span>
              </div>
            </div>

            {/* Scrollable Preview Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-y-auto flex-1 max-h-52">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] uppercase font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Question</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Difficulty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedItems.map((q, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-3">
                        {q.isDuplicate ? (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            Duplicate
                          </span>
                        ) : q.isValid ? (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            Valid
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                            Invalid
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                        {q.question}
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300 truncate">{q.role}</td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{q.difficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCommitImport}
            disabled={validItemsToImport.length === 0 || isSubmitting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Import {validItemsToImport.length} Questions</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
