"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  History,
  Eye,
  Plus,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { adminService } from '@/lib/services/adminService';
import { CurriculumVersionRecord, CurriculumValidationResult } from '@/types/admin';
import { CurriculumCourse } from '@/types/student';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminCurriculumPage() {
  const { user, profile } = useAuth();
  const [versions, setVersions] = useState<CurriculumVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Preview Modal
  const [previewVersion, setPreviewVersion] = useState<CurriculumVersionRecord | null>(null);
  const [previewCourses, setPreviewCourses] = useState<CurriculumCourse[]>([]);

  // Validation Report Modal
  const [validationReport, setValidationReport] = useState<CurriculumValidationResult | null>(null);
  const [validatingVersionId, setValidatingVersionId] = useState<string | null>(null);

  // Workflow Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    version: string;
    targetStatus: CurriculumVersionRecord['status'];
  } | null>(null);

  useEffect(() => {
    loadCurriculum();
  }, []);

  const loadCurriculum = async () => {
    setLoading(true);
    try {
      const data = await adminService.getCurriculumVersions();
      setVersions(data);
    } catch (err) {
      console.error('Failed to load curriculum versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateClick = (ver: CurriculumVersionRecord) => {
    let courses: CurriculumCourse[] = [];
    try {
      courses = JSON.parse(ver.coursesJson);
    } catch {
      courses = [];
    }
    const report = adminService.validateCurriculumCourses(courses, {
      sourceUrl: ver.sourceUrl,
      scheme: ver.scheme,
    });
    setValidatingVersionId(ver.id);
    setValidationReport(report);
  };

  const handlePreviewClick = (ver: CurriculumVersionRecord) => {
    try {
      const courses = JSON.parse(ver.coursesJson);
      setPreviewCourses(courses);
      setPreviewVersion(ver);
    } catch {
      setPreviewCourses([]);
      setPreviewVersion(ver);
    }
  };

  const requestStatusTransition = (
    ver: CurriculumVersionRecord,
    targetStatus: CurriculumVersionRecord['status']
  ) => {
    setPendingAction({
      id: ver.id,
      version: `${ver.scheme} ${ver.branch} Sem ${ver.semester} (v${ver.version})`,
      targetStatus,
    });
    setConfirmModalOpen(true);
  };

  const confirmStatusTransition = async () => {
    if (!pendingAction || !user || !profile) return;

    try {
      await adminService.transitionCurriculumWorkflow(
        pendingAction.id,
        pendingAction.targetStatus,
        { id: user.id, email: user.email, role: profile.role }
      );
      setConfirmModalOpen(false);
      setPendingAction(null);
      await loadCurriculum();
    } catch (err: any) {
      alert(err?.message || 'Transition failed');
    }
  };

  const getWorkflowBadge = (status: CurriculumVersionRecord['status']) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">DRAFT</span>;
      case 'VALIDATE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">VALIDATE</span>;
      case 'REVIEW':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">REVIEW</span>;
      case 'VERIFIED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">VERIFIED</span>;
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">ACTIVE</span>;
      case 'DEPRECATED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">DEPRECATED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <span>VTU Curriculum Control & Workflow</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Governs versioned syllabus packages through 5 strict stages: Draft → Validate → Review → Verified → Active.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/admin/curriculum/grading"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Grading Rules</span>
          </Link>
        </div>
      </div>

      {/* 5-Stage Lifecycle Stepper Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="text-xs font-bold text-slate-800 mb-3">5-Stage Verification Protocol</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-bold text-slate-700">1. DRAFT</div>
            <div className="text-[10px] text-slate-500">Initial syllabus JSON</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="font-bold text-amber-800">2. VALIDATE</div>
            <div className="text-[10px] text-amber-700">Automated rules check</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
            <div className="font-bold text-blue-800">3. REVIEW</div>
            <div className="text-[10px] text-blue-700">Academic staff audit</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
            <div className="font-bold text-purple-800">4. VERIFIED</div>
            <div className="text-[10px] text-purple-700">Official seal stamped</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="font-bold text-emerald-800">5. ACTIVE</div>
            <div className="text-[10px] text-emerald-700">Live for student SGPA</div>
          </div>
        </div>
      </div>

      {/* Curriculum Versions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Scheme & Branch</th>
                <th className="py-3 px-3">Semester</th>
                <th className="py-3 px-3">Version</th>
                <th className="py-3 px-3">Courses</th>
                <th className="py-3 px-3">Lifecycle State</th>
                <th className="py-3 px-3">Official Source</th>
                <th className="py-3 px-4 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {versions.map((ver) => (
                <tr key={ver.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">
                      VTU {ver.scheme} Scheme — {ver.branch}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
                      {ver.sourceTitle}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-700">Sem {ver.semester}</span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-mono text-slate-600 font-medium">v{ver.version}</span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold text-[11px]">
                      {ver.coursesCount} Subjects
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    {getWorkflowBadge(ver.status)}
                  </td>

                  <td className="py-3 px-3">
                    <a
                      href={ver.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono text-[11px]"
                    >
                      <span>vtu.ac.in</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handlePreviewClick(ver)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        title="Preview student subject list"
                      >
                        Preview
                      </button>

                      <button
                        onClick={() => handleValidateClick(ver)}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-semibold border border-amber-200 transition-colors cursor-pointer"
                        title="Run automated validator"
                      >
                        Validate
                      </button>

                      {ver.status === 'DRAFT' && (
                        <button
                          onClick={() => requestStatusTransition(ver, 'VALIDATE')}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Submit
                        </button>
                      )}

                      {ver.status === 'VALIDATE' && (
                        <button
                          onClick={() => requestStatusTransition(ver, 'REVIEW')}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Send Review
                        </button>
                      )}

                      {ver.status === 'REVIEW' && (
                        <button
                          onClick={() => requestStatusTransition(ver, 'VERIFIED')}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Verify Seal
                        </button>
                      )}

                      {ver.status === 'VERIFIED' && (
                        <button
                          onClick={() => requestStatusTransition(ver, 'ACTIVE')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                        >
                          Activate
                        </button>
                      )}

                      {ver.status === 'ACTIVE' && (
                        <button
                          onClick={() => requestStatusTransition(ver, 'DEPRECATED')}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-semibold border border-red-200 transition-colors cursor-pointer"
                        >
                          Deprecate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Curriculum Preview Modal */}
      {previewVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Student Syllabus Preview: VTU {previewVersion.scheme} Scheme {previewVersion.branch} (Sem {previewVersion.semester})
                </h3>
                <div className="text-[11px] text-slate-500 font-mono">
                  Version {previewVersion.version} • Status: {previewVersion.status}
                </div>
              </div>
              <button
                onClick={() => setPreviewVersion(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {previewCourses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No courses attached to this draft yet.
                </div>
              ) : (
                previewCourses.map((c) => (
                  <div key={c.courseCode} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-blue-600">{c.courseCode}</span>
                        <span>{c.courseTitle}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Type: {c.assessment?.hasSEE ? 'CIE + SEE (Theory/Lab)' : 'Continuous Evaluation (No SEE)'}
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                        {c.credits} Credits
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewVersion(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Report Drawer */}
      {validationReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {validationReport.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  Automated Curriculum Validator Report
                </h3>
              </div>
              <button
                onClick={() => setValidationReport(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className={`p-3 rounded-xl border ${validationReport.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {validationReport.isValid ? (
                  <span className="font-semibold">All automated integrity checks passed! Package is structurally valid.</span>
                ) : (
                  <span className="font-semibold">Found {validationReport.errors.length} integrity error(s). Must be resolved before activation.</span>
                )}
              </div>

              {validationReport.errors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-red-700 text-[11px] uppercase tracking-wider">Errors</div>
                  {validationReport.errors.map((err, idx) => (
                    <div key={idx} className="p-2 bg-red-50 text-red-700 rounded-lg text-[11px]">
                      • {err.message}
                    </div>
                  ))}
                </div>
              )}

              {validationReport.warnings.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-amber-700 text-[11px] uppercase tracking-wider">Warnings</div>
                  {validationReport.warnings.map((w, idx) => (
                    <div key={idx} className="p-2 bg-amber-50 text-amber-800 rounded-lg text-[11px]">
                      • {w.message}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setValidationReport(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingAction(null);
        }}
        onConfirm={confirmStatusTransition}
        variant={pendingAction?.targetStatus === 'ACTIVE' ? 'info' : 'warning'}
        title={`Transition to ${pendingAction?.targetStatus}?`}
        message={`This will transition ${pendingAction?.version} to the ${pendingAction?.targetStatus} stage in the VTU curriculum registry.`}
        confirmText={`Proceed to ${pendingAction?.targetStatus}`}
        cancelText="Cancel"
      />
    </div>
  );
}
