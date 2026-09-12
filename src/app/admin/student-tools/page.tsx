"use client";

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ArrowUpDown,
  Eye,
  EyeOff,
  Star,
  Save,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { StudentToolConfig } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';
import { adminService } from '@/lib/services/adminService';
import { STUDENT_TOOLS_REGISTRY as DEFAULT_STUDENT_TOOLS } from '@/config/studentTools';

export default function AdminStudentToolsPage() {
  const { user, profile } = useAuth();
  const [tools, setTools] = useState<StudentToolConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('saarvi_admin_student_tools_v1') || localStorage.getItem('docease_admin_student_tools_v1');
      if (stored) {
        setTools(JSON.parse(stored));
      } else {
        setTools(DEFAULT_STUDENT_TOOLS);
      }
    } catch {
      setTools(DEFAULT_STUDENT_TOOLS);
    }
  }, []);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= tools.length) return;

    const copy = [...tools];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    copy.forEach((t, i) => (t.orderIndex = i + 1));
    setTools(copy);
  };

  const toggleFeatured = (index: number) => {
    const copy = [...tools];
    copy[index].featured = !copy[index].featured;
    setTools(copy);
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem('saarvi_admin_student_tools_v1', JSON.stringify(tools));
      if (user && profile) {
        adminService.updatePlatformSettings(
          {},
          { id: user.id, email: user.email, role: profile.role }
        );
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <span>Student Tools Control</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage student utility visibility, ordering, category grouping, and featured badges.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Student tools ordering and featured flags saved successfully.</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {tools.map((tool, index) => (
            <div
              key={tool.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-6 text-center font-mono text-[11px] text-slate-400 font-semibold pt-0.5">
                  #{tool.orderIndex}
                </span>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{tool.name}</span>
                    <span className="capitalize text-[10px] font-semibold px-2 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                      {tool.category}
                    </span>
                    {tool.featured && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-xl">
                    {tool.description}
                  </p>
                </div>
              </div>

              {/* Order & Featured Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => toggleFeatured(index)}
                  className={`p-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    tool.featured
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                  title={tool.featured ? 'Remove featured badge' : 'Mark as featured'}
                >
                  <Star className={`w-3.5 h-3.5 ${tool.featured ? 'fill-amber-500' : ''}`} />
                  <span className="hidden sm:inline">{tool.featured ? 'Featured' : 'Standard'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move Up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === tools.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move Down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
