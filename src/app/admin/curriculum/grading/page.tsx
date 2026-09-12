"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowLeft, CheckCircle2, Shield, Info, ExternalLink } from 'lucide-react';
import { GradingRuleRecord } from '@/types/admin';

const OFFICIAL_VTU_2022_GRADING_RULES: GradingRuleRecord[] = [
  { id: 'vtu-2022-o', scheme: '2022', grade: 'O', minPercentage: 90, maxPercentage: 100, gradePoint: 10, description: 'Outstanding', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
  { id: 'vtu-2022-aplus', scheme: '2022', grade: 'A+', minPercentage: 80, maxPercentage: 89, gradePoint: 9, description: 'Excellent', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
  { id: 'vtu-2022-a', scheme: '2022', grade: 'A', minPercentage: 70, maxPercentage: 79, gradePoint: 8, description: 'Very Good', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
  { id: 'vtu-2022-bplus', scheme: '2022', grade: 'B+', minPercentage: 60, maxPercentage: 69, gradePoint: 7, description: 'Good', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
  { id: 'vtu-2022-b', scheme: '2022', grade: 'B', minPercentage: 55, maxPercentage: 59, gradePoint: 6, description: 'Above Average', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
  { id: 'vtu-2022-c', scheme: '2022', grade: 'C', minPercentage: 50, maxPercentage: 54, gradePoint: 5, description: 'Average', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
  { id: 'vtu-2022-p', scheme: '2022', grade: 'P', minPercentage: 40, maxPercentage: 49, gradePoint: 4, description: 'Pass', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
  { id: 'vtu-2022-f', scheme: '2022', grade: 'F', minPercentage: 0, maxPercentage: 39, gradePoint: 0, description: 'Fail', status: 'ACTIVE', source: 'VTU Executive Council Resolution 2022 CBCS Guidelines', version: '2022.1' },
];

export default function AdminGradingRulesPage() {
  const [rules] = useState<GradingRuleRecord[]>(OFFICIAL_VTU_2022_GRADING_RULES);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/curriculum"
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <span>VTU Grading Rules & Grade Points</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Official versioned grading scale used by the SGPA/CGPA calculation engine.
          </p>
        </div>

        <div className="text-xs px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 font-semibold font-mono">
          VTU 2022 CBCS / NEP
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-slate-800">Passing Rules Enforcement</div>
          <p className="mt-0.5">
            Under VTU 2022 Regulations, a student must secure at least 40% in continuous evaluation (CIE $\ge$ 20/50) and at least 35% in semester end examinations (SEE $\ge$ 18/50) to qualify for a passing grade (P or higher). If either threshold is not met, grade &apos;F&apos; (0 grade points) is assigned.
          </p>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Letter Grade</th>
                <th className="py-3 px-3">Mark Range (%)</th>
                <th className="py-3 px-3">Grade Point</th>
                <th className="py-3 px-3">Evaluation</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Official Citation & Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors font-sans">
                  <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                    <span className={`px-2.5 py-0.5 rounded-lg border text-xs font-mono font-bold ${
                      rule.grade === 'F' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {rule.grade}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-semibold text-slate-800">
                    {rule.minPercentage}% – {rule.maxPercentage}%
                  </td>

                  <td className="py-3 px-3 font-bold text-slate-900 text-sm">
                    {rule.gradePoint}
                  </td>

                  <td className="py-3 px-3 text-slate-600 font-medium">
                    {rule.description}
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {rule.status}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-[11px] text-slate-500">
                    <div>{rule.source}</div>
                    <div className="font-mono text-slate-400">Ver: {rule.version}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
