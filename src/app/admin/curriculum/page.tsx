"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Building,
  Layers,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Send,
  Archive,
  RefreshCw,
  Search,
  Check,
  X,
  ChevronRight,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles
} from "lucide-react";
import {
  UniversityRecord,
  SchemeRecord,
  BranchRecord,
  AcademicSemesterRecord,
  AcademicSubjectRecord,
  AcademicCourseType,
  CurriculumPublishStatus
} from "@/types/admin";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

type ActiveTab = "universities" | "schemes" | "branches" | "subjects" | "import";

export default function MultiUniversityAcademicPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("subjects");
  const [loading, setLoading] = useState(true);

  // Hierarchy entities
  const [universities, setUniversities] = useState<UniversityRecord[]>([]);
  const [schemes, setSchemes] = useState<SchemeRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubjectRecord[]>([]);

  // Selected hierarchy filters
  const [selectedUnivId, setSelectedUnivId] = useState<string>("vtu");
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("vtu-2022");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("vtu-2022-cse");
  const [selectedSemester, setSelectedSemester] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [addUnivModalOpen, setAddUnivModalOpen] = useState(false);
  const [newUnivData, setNewUnivData] = useState({ name: "", code: "" });

  const [addSchemeModalOpen, setAddSchemeModalOpen] = useState(false);
  const [newSchemeData, setNewSchemeData] = useState({ name: "", year: "", version: "1.0" });

  const [addBranchModalOpen, setAddBranchModalOpen] = useState(false);
  const [newBranchData, setNewBranchData] = useState({ name: "", code: "" });

  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AcademicSubjectRecord | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    subjectCode: "",
    subjectName: "",
    credits: 4,
    courseType: "Theory" as AcademicCourseType,
    seeApplicable: true,
  });

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");
  const [importData, setImportData] = useState("");
  const [importResult, setImportResult] = useState<{ importedCount?: number; errors?: string[] } | null>(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
  });

  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    loadHierarchy();
  }, []);

  useEffect(() => {
    loadSchemes(selectedUnivId);
  }, [selectedUnivId]);

  useEffect(() => {
    loadBranches(selectedUnivId, selectedSchemeId);
  }, [selectedSchemeId]);

  useEffect(() => {
    loadSemesters(selectedUnivId, selectedSchemeId, selectedBranchId);
    loadSubjects();
  }, [selectedBranchId, selectedSemester]);

  // Load all initial hierarchy data
  async function loadHierarchy() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/academic/universities");
      if (res.ok) {
        const data = await res.json();
        setUniversities(data.universities || []);
        if (data.universities?.length > 0) {
          const defaultUniv = data.universities.find((u: UniversityRecord) => u.code === "VTU") || data.universities[0];
          setSelectedUnivId(defaultUniv.id);
        }
      }
    } catch (err: any) {
      setErrorNotice("Failed to load universities: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSchemes(univId: string) {
    if (!univId) return;
    try {
      const res = await fetch(`/api/admin/academic/schemes?universityId=${univId}`);
      if (res.ok) {
        const data = await res.json();
        setSchemes(data.schemes || []);
        if (data.schemes?.length > 0) {
          setSelectedSchemeId(data.schemes[0].id);
        } else {
          setSelectedSchemeId("");
        }
      }
    } catch {}
  }

  async function loadBranches(univId: string, schemeId: string) {
    if (!schemeId) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }
    try {
      const res = await fetch(`/api/admin/academic/branches?universityId=${univId}&schemeId=${schemeId}`);
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
        if (data.branches?.length > 0) {
          setSelectedBranchId(data.branches[0].id);
        } else {
          setSelectedBranchId("");
        }
      }
    } catch {}
  }

  async function loadSemesters(univId: string, schemeId: string, branchId: string) {
    if (!branchId) {
      setSemesters([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/academic/semesters?universityId=${univId}&schemeId=${schemeId}&branchId=${branchId}`
      );
      if (res.ok) {
        const data = await res.json();
        setSemesters(data.semesters || []);
      }
    } catch {}
  }

  async function loadSubjects() {
    if (!selectedBranchId) {
      setSubjects([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/academic/subjects?universityId=${selectedUnivId}&schemeId=${selectedSchemeId}&branchId=${selectedBranchId}&semester=${selectedSemester}`
      );
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects || []);
      }
    } catch {}
  }

  // Handle Add University
  async function handleCreateUniversity() {
    setErrorNotice(null);
    try {
      const res = await fetch("/api/admin/academic/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUnivData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create university");
      }
      setSuccessNotice(`University "${newUnivData.name}" created successfully.`);
      setAddUnivModalOpen(false);
      setNewUnivData({ name: "", code: "" });
      await loadHierarchy();
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  }

  // Handle Toggle University Status
  async function handleToggleUniversityStatus(univ: UniversityRecord) {
    const nextStatus = univ.status === "ENABLED" ? "DISABLED" : "ENABLED";
    try {
      const res = await fetch("/api/admin/academic/universities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: univ.id, status: nextStatus }),
      });
      if (res.ok) {
        setSuccessNotice(`University "${univ.name}" is now ${nextStatus}.`);
        await loadHierarchy();
      }
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  }

  // Handle Add Scheme
  async function handleCreateScheme() {
    setErrorNotice(null);
    try {
      const res = await fetch("/api/admin/academic/schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId: selectedUnivId,
          ...newSchemeData,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create scheme");
      setSuccessNotice(`Scheme "${newSchemeData.name}" created.`);
      setAddSchemeModalOpen(false);
      setNewSchemeData({ name: "", year: "", version: "1.0" });
      await loadSchemes(selectedUnivId);
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  }

  // Handle Add Branch
  async function handleCreateBranch() {
    setErrorNotice(null);
    try {
      const res = await fetch("/api/admin/academic/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId: selectedUnivId,
          schemeId: selectedSchemeId,
          ...newBranchData,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create branch");
      setSuccessNotice(`Branch "${newBranchData.name}" created.`);
      setAddBranchModalOpen(false);
      setNewBranchData({ name: "", code: "" });
      await loadBranches(selectedUnivId, selectedSchemeId);
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  }

  // Handle Add Semester
  async function handleCreateSemester(semNum: number) {
    setErrorNotice(null);
    try {
      const res = await fetch("/api/admin/academic/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId: selectedUnivId,
          schemeId: selectedSchemeId,
          branchId: selectedBranchId,
          semesterNumber: semNum,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to add semester");
      setSuccessNotice(`Semester ${semNum} added.`);
      await loadSemesters(selectedUnivId, selectedSchemeId, selectedBranchId);
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  }

  // Handle Save Subject (Create or Edit)
  async function handleSaveSubject() {
    setErrorNotice(null);
    try {
      if (editingSubject) {
        const res = await fetch("/api/admin/academic/subjects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSubject.id,
            ...subjectForm,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to update subject");
        setSuccessNotice(`Subject "${subjectForm.subjectCode}" updated.`);
      } else {
        const res = await fetch("/api/admin/academic/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            universityId: selectedUnivId,
            schemeId: selectedSchemeId,
            branchId: selectedBranchId,
            semester: selectedSemester,
            ...subjectForm,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to create subject");
        setSuccessNotice(`Subject "${subjectForm.subjectCode}" added to Semester ${selectedSemester}.`);
      }
      setAddSubjectModalOpen(false);
      setEditingSubject(null);
      setSubjectForm({
        subjectCode: "",
        subjectName: "",
        credits: 4,
        courseType: "Theory",
        seeApplicable: true,
      });
      await loadSubjects();
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  }

  // Handle Delete Subject
  async function handleDeleteSubject(id: string, code: string) {
    setConfirmModal({
      isOpen: true,
      title: `Delete Subject ${code}?`,
      message: `Are you sure you want to delete ${code} from Semester ${selectedSemester}? This action cannot be undone.`,
      action: async () => {
        try {
          const res = await fetch(`/api/admin/academic/subjects?id=${id}`, { method: "DELETE" });
          if (res.ok) {
            setSuccessNotice(`Subject ${code} removed.`);
            await loadSubjects();
          }
        } catch (err: any) {
          setErrorNotice(err.message);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  // Handle Publish Curriculum
  async function handlePublishCurriculum(targetStatus: CurriculumPublishStatus) {
    setConfirmModal({
      isOpen: true,
      title: `${targetStatus === "PUBLISHED" ? "Publish" : "Archive"} Curriculum?`,
      message: `This will mark all ${subjects.length} subjects in Semester ${selectedSemester} as ${targetStatus}. ${
        targetStatus === "PUBLISHED"
          ? "Published subjects immediately become active in the Student SGPA Calculator."
          : "Archived subjects will be hidden from students."
      }`,
      action: async () => {
        try {
          const res = await fetch("/api/admin/academic/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              universityId: selectedUnivId,
              schemeId: selectedSchemeId,
              branchId: selectedBranchId,
              semester: selectedSemester,
              targetStatus,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || "Publish failed");
          setSuccessNotice(`Curriculum successfully ${targetStatus.toLowerCase()} (${data.affectedCount} subjects updated).`);
          await loadSubjects();
        } catch (err: any) {
          setErrorNotice(err.message);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  // Handle Batch Import (CSV / JSON)
  async function handleImportCurriculum() {
    setErrorNotice(null);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/academic/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: importFormat,
          data: importData,
          universityId: selectedUnivId,
          schemeId: selectedSchemeId,
          branchId: selectedBranchId,
          semester: selectedSemester,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Import failed");
      setImportResult(data);
      if (data.importedCount > 0) {
        setSuccessNotice(`Successfully imported ${data.importedCount} subjects.`);
        await loadSubjects();
      }
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  }

  // Filtered subjects
  const filteredSubjects = subjects.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.subjectCode.toLowerCase().includes(q) ||
      s.subjectName.toLowerCase().includes(q) ||
      s.courseType.toLowerCase().includes(q)
    );
  });

  const selectedUniv = universities.find((u) => u.id === selectedUnivId);
  const selectedScheme = schemes.find((s) => s.id === selectedSchemeId);
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-600" />
            <span>Academic Control Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative platform management for Universities, Schemes, Branches, Semesters, Subjects, and Live SGPA Publishing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/curriculum/grading"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Grading Rules</span>
          </Link>
          <Link
            href="/student/sgpa-calculator"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <span>Live SGPA Calc</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Notices */}
      {errorNotice && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("subjects")}
          className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "subjects"
              ? "border-purple-600 text-purple-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Curriculum & Subjects</span>
        </button>
        <button
          onClick={() => setActiveTab("universities")}
          className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "universities"
              ? "border-purple-600 text-purple-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Universities ({universities.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("schemes")}
          className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "schemes"
              ? "border-purple-600 text-purple-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Schemes & Regulations ({schemes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("branches")}
          className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "branches"
              ? "border-purple-600 text-purple-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Branches ({branches.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "import"
              ? "border-purple-600 text-purple-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Batch Import (CSV/JSON)</span>
        </button>
      </div>

      {/* 1. UNIVERSITIES TAB */}
      {activeTab === "universities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Supported Universities</h2>
            <button
              onClick={() => setAddUnivModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add University</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">University Name</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {universities.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">{u.code}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === "ENABLED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleUniversityStatus(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          u.status === "ENABLED"
                            ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {u.status === "ENABLED" ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SCHEMES TAB */}
      {activeTab === "schemes" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filter University:</span>
              <select
                value={selectedUnivId}
                onChange={(e) => setSelectedUnivId(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setAddSchemeModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Scheme / Regulation</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Scheme Name</th>
                  <th className="py-3 px-3">Year</th>
                  <th className="py-3 px-3">Version</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schemes.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{s.year}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">v{s.version}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. BRANCHES TAB */}
      {activeTab === "branches" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Scheme:</span>
              <select
                value={selectedSchemeId}
                onChange={(e) => setSelectedSchemeId(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.year})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setAddBranchModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Branch</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Branch Name</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{b.name}</td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-600">{b.code}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CURRICULUM & SUBJECTS TAB */}
      {activeTab === "subjects" && (
        <div className="space-y-4">
          {/* Hierarchy Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. University */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">University</label>
                <select
                  value={selectedUnivId}
                  onChange={(e) => setSelectedUnivId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Scheme */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Scheme / Regulation</label>
                <select
                  value={selectedSchemeId}
                  onChange={(e) => setSelectedSchemeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.year})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Branch */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Semester */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Semester</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const nextSem = (semesters.length > 0 ? Math.max(...semesters.map((s) => s.semesterNumber)) : 8) + 1;
                      handleCreateSemester(nextSem);
                    }}
                    title="Add Next Semester (N)"
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shrink-0"
                  >
                    +N
                  </button>
                </div>
              </div>
            </div>

            {/* Scope Summary & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-medium">
                Scope: <span className="font-bold text-slate-800">{selectedUniv?.code}</span> →{" "}
                <span className="font-bold text-slate-800">{selectedScheme?.name}</span> →{" "}
                <span className="font-bold text-slate-800">{selectedBranch?.code}</span> →{" "}
                <span className="font-bold text-purple-700">Semester {selectedSemester}</span>{" "}
                ({subjects.length} subjects configured)
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setEditingSubject(null);
                    setSubjectForm({
                      subjectCode: "",
                      subjectName: "",
                      credits: 4,
                      courseType: "Theory",
                      seeApplicable: true,
                    });
                    setAddSubjectModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Subject</span>
                </button>

                <button
                  onClick={() => handlePublishCurriculum("PUBLISHED")}
                  disabled={subjects.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish to SGPA</span>
                </button>

                <button
                  onClick={() => handlePublishCurriculum("ARCHIVED")}
                  disabled={subjects.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search bar inside subjects */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject code, title, or type..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Subjects Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {filteredSubjects.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No subjects configured for this semester.</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click &quot;Add Subject&quot; or use &quot;Batch Import&quot; to populate courses. Students will see &quot;Curriculum not available yet&quot; until published.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Subject Code</th>
                      <th className="py-3 px-3">Subject Name</th>
                      <th className="py-3 px-3">Credits</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">SEE Exam</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubjects.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-purple-700">{s.subjectCode}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{s.subjectName}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold">
                            {s.credits} cr
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">{s.courseType}</td>
                        <td className="py-3 px-3">
                          {s.seeApplicable ? (
                            <span className="text-emerald-700 font-semibold text-[11px]">Yes (CIE + SEE)</span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No (CIE only)</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === "PUBLISHED"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : s.status === "DRAFT"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingSubject(s);
                                setSubjectForm({
                                  subjectCode: s.subjectCode,
                                  subjectName: s.subjectName,
                                  credits: s.credits,
                                  courseType: s.courseType,
                                  seeApplicable: s.seeApplicable,
                                });
                                setAddSubjectModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
                              title="Edit Subject"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubject(s.id, s.subjectCode)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete Subject"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. BATCH IMPORT TAB */}
      {activeTab === "import" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Batch Import Curriculum (CSV / JSON)</h2>
            <p className="text-xs text-slate-500 mt-1">
              Import a complete semester syllabus at once. Subjects will be added to the selected scope and verified for duplicate codes and positive credit values.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Target University & Scheme</label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800">
                {selectedUniv?.name} ({selectedUniv?.code}) → {selectedScheme?.name}
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Target Branch & Semester</label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800">
                {selectedBranch?.name} ({selectedBranch?.code}) → Semester {selectedSemester}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Format & Payload</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setImportFormat("csv");
                    setImportData(
                      "code,title,credits,type,see\nCS301,Data Structures and Algorithms,4,Theory,yes\nCS302,Operating Systems,4,Theory,yes\nCSL303,Data Structures Lab,2,Lab,yes"
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    importFormat === "csv" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  CSV Format
                </button>
                <button
                  onClick={() => {
                    setImportFormat("json");
                    setImportData(
                      JSON.stringify(
                        [
                          { subjectCode: "CS301", subjectName: "Data Structures", credits: 4, courseType: "Theory", seeApplicable: true },
                          { subjectCode: "CS302", subjectName: "Operating Systems", credits: 4, courseType: "Theory", seeApplicable: true }
                        ],
                        null,
                        2
                      )
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    importFormat === "json" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  JSON Format
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={
                importFormat === "csv"
                  ? "code,title,credits,type,see\n21CS31,Data Structures,4,Theory,yes"
                  : '[{"subjectCode":"21CS31","subjectName":"Data Structures","credits":4}]'
              }
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              Columns: Subject Code, Subject Name, Credits (Numeric &gt; 0), Course Type, SEE Applicable
            </span>
            <button
              onClick={handleImportCurriculum}
              disabled={!importData.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Validate & Import</span>
            </button>
          </div>

          {importResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                importResult.importedCount && importResult.importedCount > 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <div className="font-bold">
                Import complete: {importResult.importedCount || 0} subjects added.
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-1 pt-1 text-[11px] text-red-700 font-mono">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD UNIVERSITY */}
      {addUnivModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Add New University</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">University Name *</label>
                <input
                  type="text"
                  value={newUnivData.name}
                  onChange={(e) => setNewUnivData({ ...newUnivData, name: e.target.value })}
                  placeholder="e.g. Visvesvaraya Technological University"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">University Code *</label>
                <input
                  type="text"
                  value={newUnivData.code}
                  onChange={(e) => setNewUnivData({ ...newUnivData, code: e.target.value })}
                  placeholder="e.g. VTU"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAddUnivModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUniversity}
                disabled={!newUnivData.name || !newUnivData.code}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                Create University
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD SCHEME */}
      {addSchemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Add Scheme / Regulation ({selectedUniv?.code})</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Scheme Name *</label>
                <input
                  type="text"
                  value={newSchemeData.name}
                  onChange={(e) => setNewSchemeData({ ...newSchemeData, name: e.target.value })}
                  placeholder="e.g. 2026 Regulation"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Year *</label>
                  <input
                    type="text"
                    value={newSchemeData.year}
                    onChange={(e) => setNewSchemeData({ ...newSchemeData, year: e.target.value })}
                    placeholder="e.g. 2026"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Version</label>
                  <input
                    type="text"
                    value={newSchemeData.version}
                    onChange={(e) => setNewSchemeData({ ...newSchemeData, version: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAddSchemeModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateScheme}
                disabled={!newSchemeData.name || !newSchemeData.year}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                Create Scheme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD BRANCH */}
      {addBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Add Branch ({selectedScheme?.name})</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  value={newBranchData.name}
                  onChange={(e) => setNewBranchData({ ...newBranchData, name: e.target.value })}
                  placeholder="e.g. Artificial Intelligence & Data Science"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Code *</label>
                <input
                  type="text"
                  value={newBranchData.code}
                  onChange={(e) => setNewBranchData({ ...newBranchData, code: e.target.value })}
                  placeholder="e.g. AIDS"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAddBranchModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={!newBranchData.name || !newBranchData.code}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SUBJECT */}
      {addSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              {editingSubject ? "Edit Subject" : `Add Subject to Semester ${selectedSemester}`}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject Code *</label>
                  <input
                    type="text"
                    value={subjectForm.subjectCode}
                    onChange={(e) => setSubjectForm({ ...subjectForm, subjectCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. 21CS31"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credits (Numeric &gt; 0) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={subjectForm.credits}
                    onChange={(e) => setSubjectForm({ ...subjectForm, credits: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject Name *</label>
                <input
                  type="text"
                  value={subjectForm.subjectName}
                  onChange={(e) => setSubjectForm({ ...subjectForm, subjectName: e.target.value })}
                  placeholder="e.g. Data Structures and Applications"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Course Type</label>
                  <select
                    value={subjectForm.courseType}
                    onChange={(e) => setSubjectForm({ ...subjectForm, courseType: e.target.value as AcademicCourseType })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    <option value="Theory">Theory</option>
                    <option value="Lab">Lab / Practical</option>
                    <option value="Practical">Practical</option>
                    <option value="Project">Project</option>
                    <option value="Activity">Activity</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SEE Exam Applicable</label>
                  <select
                    value={subjectForm.seeApplicable ? "yes" : "no"}
                    onChange={(e) => setSubjectForm({ ...subjectForm, seeApplicable: e.target.value === "yes" })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    <option value="yes">Yes (CIE + SEE Exam)</option>
                    <option value="no">No (Continuous Internal Only)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setAddSubjectModalOpen(false);
                  setEditingSubject(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubject}
                disabled={!subjectForm.subjectCode.trim() || !subjectForm.subjectName.trim() || subjectForm.credits <= 0}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {editingSubject ? "Save Changes" : "Create Subject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Confirm Action"
        cancelText="Cancel"
      />
    </div>
  );
}
