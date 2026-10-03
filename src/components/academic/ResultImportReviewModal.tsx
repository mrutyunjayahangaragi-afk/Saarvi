"use client";

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  X,
  Eye,
  EyeOff,
  Edit2,
  Save,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import { CanonicalExtractedResult, RawSubjectResult } from '@/lib/academic/providers/vtu-result-provider';
import { roundTo } from '@/lib/academic/engine/calculations';

interface ResultImportReviewModalProps {
  isOpen: boolean;
  result: CanonicalExtractedResult | null;
  onConfirm: (confirmedResult: CanonicalExtractedResult) => void;
  onClose: () => void;
}

export function ResultImportReviewModal({
  isOpen,
  result,
  onConfirm,
  onClose,
}: ResultImportReviewModalProps) {
  const [revealUsn, setRevealUsn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [subjects, setSubjects] = useState<RawSubjectResult[]>(result?.subjects || []);

  useEffect(() => {
    if (result?.subjects) {
      setSubjects(result.subjects);
    }
  }, [result]);

  if (!isOpen || !result) return null;

  // Mask USN: 1RV23CS001 -> 1RV23CS***
  const maskedUsn =
    result.usn.length >= 7
      ? `${result.usn.slice(0, 7)}***`
      : result.usn;

  // Recalculate SGPA dynamically if user edits credits or grades
  const computeMetrics = (subs: RawSubjectResult[]) => {
    let totCredits = 0;
    let earnedCreds = 0;
    let totPoints = 0;
    let hasBacklog = false;

    for (const s of subs) {
      totCredits += s.credits;
      totPoints += s.credits * s.gradePoint;
      if (s.resultStatus === 'P') {
        earnedCreds += s.credits;
      } else {
        hasBacklog = true;
      }
    }

    const sgpa = totCredits > 0 ? roundTo(totPoints / totCredits, 2) : 0;
    return { totCredits, earnedCreds, sgpa, hasBacklog };
  };

  const currentMetrics = computeMetrics(subjects);

  const handleGradeChange = (index: number, newGrade: string) => {
    const updated = [...subjects];
    const item = { ...updated[index], grade: newGrade.toUpperCase() };

    // Grade points mapping
    const gradePointsMap: Record<string, number> = {
      O: 10,
      'A+': 9,
      A: 8,
      'B+': 7,
      B: 6,
      C: 5,
      P: 4,
      F: 0,
    };

    item.gradePoint = gradePointsMap[item.grade] ?? 0;
    item.resultStatus = item.grade === 'F' ? 'F' : 'P';
    updated[index] = item;
    setSubjects(updated);
  };

  const handleSaveAndConfirm = () => {
    onConfirm({
      ...result,
      subjects,
      sgpa: currentMetrics.sgpa,
      totalCredits: currentMetrics.totCredits,
      earnedCredits: currentMetrics.earnedCreds,
      hasBacklogs: currentMetrics.hasBacklog,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review Imported Result</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Please verify course marks and credits before adding to your semester record.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Badges */}
        <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">USN</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {revealUsn ? result.usn : maskedUsn}
              </span>
              <button
                type="button"
                onClick={() => setRevealUsn(!revealUsn)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {revealUsn ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Semester</span>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">Semester {result.semester}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Credits</span>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{currentMetrics.totCredits}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Calculated SGPA</span>
            <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">{currentMetrics.sgpa}</p>
          </div>
        </div>

        {/* Subject-Wise Table */}
        <div className="p-6 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Extracted Courses ({subjects.length})
            </h3>
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Edit2 className="w-3 h-3" />
              <span>{editing ? 'Done Editing' : 'Edit Courses'}</span>
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Course Code</th>
                  <th className="p-3">Title</th>
                  <th className="p-3 text-center">Credits</th>
                  <th className="p-3 text-center">Grade</th>
                  <th className="p-3 text-center">Grade Point</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                {subjects.map((sub, idx) => (
                  <tr key={sub.courseCode} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-medium text-slate-900 dark:text-white">
                      {sub.courseCode}
                    </td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                      {sub.courseTitle}
                    </td>
                    <td className="p-3 text-center font-semibold">
                      {sub.credits}
                    </td>
                    <td className="p-3 text-center">
                      {editing ? (
                        <select
                          value={sub.grade}
                          onChange={(e) => handleGradeChange(idx, e.target.value)}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                        >
                          {['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F'].map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            sub.grade === 'F'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {sub.grade}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 dark:text-white">
                      {sub.gradePoint}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed pt-1">
            Note: Result imported via {result.source === 'IMPORTED_PDF' ? 'User-Uploaded Official Marksheet PDF' : 'Official Portal'}. Verified against {result.schemeId.toUpperCase()} rules.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-wide shadow-md transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm &amp; Save Semester {result.semester}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
