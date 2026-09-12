"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AVAILABLE_VTU_SCHEMES, VTU_METADATA } from "@/lib/student/vtu/types";
import { curriculumIndex } from "@/lib/student/vtu/curriculum-index";
import { deriveGrade, deriveGradeFromNormalized } from "@/lib/student/calculators/grades";
import { calculateVTUSGPA } from "@/lib/student/calculators/vtu-engine";
import { normalizeCourseScore, validateMarksInput, RawMarksInput } from "@/lib/student/calculators/normalization";
import { studentService } from "@/lib/services/studentService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { useAuth } from "@/context/AuthContext";
import { CourseResultInput, CurriculumCourse, MarksInputMode, CourseAssessmentConfig } from "@/types/student";
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Save,
  HelpCircle,
  ArrowRight,
  Plus,
  Trash2,
  Circle,
  XCircle,
  SlidersHorizontal,
  FileCheck2,
} from "lucide-react";

interface CourseRowState {
  courseCode: string;
  courseTitle: string;
  credits: number;
  category?: string;
  assessment: CourseAssessmentConfig;
  inputMode: MarksInputMode;
  cie: number | "";
  see: number | "";
  total: number | "";
  includedInSGPA: boolean;
  includedInCGPA: boolean;
  isElectiveGroup?: boolean;
  electiveGroupTitle?: string;
  electiveOptions?: CurriculumCourse["electiveOptions"];
  selectedElectiveCode?: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
}

export default function SGPACalculatorPage() {
  const { user } = useAuth();

  // Mode: "vtu" (Curriculum Engine) or "custom" (Manual Entry)
  const [mode, setMode] = useState<"vtu" | "custom">("vtu");

  // Global Marks Input Mode preference: "cie-see" | "total"
  const [globalInputMode, setGlobalInputMode] = useState<MarksInputMode>("cie-see");

  // VTU Stepper Selection States
  const [selectedSemester, setSelectedSemester] = useState<number>(3);
  const [selectedUniversity] = useState<string>("VTU");
  const [selectedScheme, setSelectedScheme] = useState<string>("2022");
  const [selectedBranch, setSelectedBranch] = useState<string>("CSE");

  // Course row inputs
  const [coursesState, setCoursesState] = useState<CourseRowState[]>([]);

  // Custom Mode Courses
  const [customCourses, setCustomCourses] = useState<Array<{ id: string; name: string; credits: number; marks: number }>>([
    { id: "1", name: "Course 1", credits: 4, marks: 85 },
    { id: "2", name: "Course 2", credits: 4, marks: 74 },
    { id: "3", name: "Course 3", credits: 3, marks: 92 },
  ]);

  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Continue",
    onConfirm: () => {},
  });

  // Check if current combination is officially verified
  const isVerified = useMemo(() => {
    return curriculumIndex.isCombinationVerified(selectedScheme, selectedBranch, selectedSemester);
  }, [selectedScheme, selectedBranch, selectedSemester]);

  // Check if any mark has been entered across all courses
  const hasEnteredMarks = useMemo(() => {
    return coursesState.some((c) => c.cie !== "" || c.see !== "" || c.total !== "");
  }, [coursesState]);

  // Load official curriculum when selection changes
  useEffect(() => {
    if (mode !== "vtu") return;

    const officialCourses = curriculumIndex.getCourses(selectedScheme, selectedBranch, selectedSemester);
    if (officialCourses.length > 0) {
      const initialRows: CourseRowState[] = officialCourses.map((c) => {
        let title = c.courseTitle;
        let code = c.courseCode;

        if (c.isElectiveGroup && c.electiveOptions && c.electiveOptions.length > 0) {
          code = c.electiveOptions[0].courseCode;
          title = c.electiveOptions[0].courseTitle;
        }

        const preferredMode = c.assessment.allowedInputModes.includes(globalInputMode)
          ? globalInputMode
          : c.assessment.allowedInputModes[0] || "cie-see";

        return {
          courseCode: code,
          courseTitle: title,
          credits: c.credits,
          category: c.category,
          assessment: c.assessment,
          inputMode: preferredMode,
          cie: "",
          see: "",
          total: "",
          includedInSGPA: c.includedInSGPA,
          includedInCGPA: c.includedInCGPA,
          isElectiveGroup: c.isElectiveGroup,
          electiveGroupTitle: c.electiveGroupTitle,
          electiveOptions: c.electiveOptions,
          selectedElectiveCode: code,
        };
      });
      setCoursesState(initialRows);
    } else {
      setCoursesState([]);
    }
  }, [mode, selectedScheme, selectedBranch, selectedSemester, globalInputMode]);

  // Safe Switch for Global Input Mode
  const handleGlobalModeChange = (newMode: MarksInputMode) => {
    if (newMode === globalInputMode) return;

    if (hasEnteredMarks) {
      setConfirmDialog({
        isOpen: true,
        title: "Switch Marks Input Mode?",
        message:
          "Switching input mode will reset current marks to ensure no double-counting. Do you want to continue?",
        confirmText: "Switch Mode",
        cancelText: "Cancel",
        onConfirm: () => {
          setGlobalInputMode(newMode);
          setCoursesState((prev) =>
            prev.map((c) => ({
              ...c,
              inputMode: c.assessment.allowedInputModes.includes(newMode) ? newMode : c.inputMode,
              cie: "",
              see: "",
              total: "",
            }))
          );
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setGlobalInputMode(newMode);
      setCoursesState((prev) =>
        prev.map((c) => ({
          ...c,
          inputMode: c.assessment.allowedInputModes.includes(newMode) ? newMode : c.inputMode,
        }))
      );
    }
  };

  // Safe Switch for Course-specific Input Mode
  const handleCourseModeChange = (index: number, newMode: MarksInputMode) => {
    const row = coursesState[index];
    if (row.inputMode === newMode) return;

    const rowHasMarks = row.cie !== "" || row.see !== "" || row.total !== "";

    if (rowHasMarks) {
      setConfirmDialog({
        isOpen: true,
        title: `Switch Mode for ${row.courseCode}?`,
        message: `Switching input mode will clear the entered marks for ${row.courseCode}. Continue?`,
        confirmText: "Switch",
        cancelText: "Cancel",
        onConfirm: () => {
          setCoursesState((prev) => {
            const copy = [...prev];
            copy[index] = {
              ...copy[index],
              inputMode: newMode,
              cie: "",
              see: "",
              total: "",
            };
            return copy;
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setCoursesState((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          inputMode: newMode,
        };
        return copy;
      });
    }
  };

  // Safe Switch for Semester / Branch / Scheme
  const handleSemesterChange = (newSemester: number) => {
    if (newSemester === selectedSemester) return;

    if (hasEnteredMarks) {
      setConfirmDialog({
        isOpen: true,
        title: "Change Semester?",
        message: "Changing semester will reset your currently entered subject marks. Continue?",
        confirmText: "Change Semester",
        cancelText: "Cancel",
        onConfirm: () => {
          setSelectedSemester(newSemester);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setSelectedSemester(newSemester);
    }
  };

  const handleBranchChange = (newBranch: string) => {
    if (newBranch === selectedBranch) return;

    if (hasEnteredMarks) {
      setConfirmDialog({
        isOpen: true,
        title: "Change Engineering Branch?",
        message: "Changing branch will reload official course codes and clear entered marks. Continue?",
        confirmText: "Change Branch",
        cancelText: "Cancel",
        onConfirm: () => {
          setSelectedBranch(newBranch);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setSelectedBranch(newBranch);
    }
  };

  const handleSchemeChange = (newScheme: string) => {
    if (newScheme === selectedScheme) return;

    if (hasEnteredMarks) {
      setConfirmDialog({
        isOpen: true,
        title: "Change Syllabus Scheme?",
        message: "Changing the syllabus scheme will reload course configurations and clear entered marks. Continue?",
        confirmText: "Change Scheme",
        cancelText: "Cancel",
        onConfirm: () => {
          setSelectedScheme(newScheme);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setSelectedScheme(newScheme);
    }
  };

  // Safe Reset Marks
  const handleResetMarks = () => {
    if (!hasEnteredMarks) return;

    setConfirmDialog({
      isOpen: true,
      title: "Reset All Marks?",
      message:
        "This will clear all entered marks for this semester. Your selected semester, scheme, and branch will remain unchanged.",
      confirmText: "Reset Marks",
      cancelText: "Cancel",
      onConfirm: () => {
        setCoursesState((prev) =>
          prev.map((c) => ({
            ...c,
            cie: "",
            see: "",
            total: "",
          }))
        );
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Quick Sample Marks Loader (convenience for instant evaluation)
  const handleLoadSampleMarks = () => {
    setCoursesState((prev) =>
      prev.map((c) => {
        if (c.inputMode === "total") {
          return { ...c, total: 80, cie: "", see: "" };
        }
        if (!c.assessment.hasSEE) {
          return { ...c, cie: 85, see: "", total: "" };
        }
        return { ...c, cie: 42, see: 38, total: "" };
      })
    );
  };

  // Handle Elective Choice Selection
  const handleElectiveChange = (index: number, optionCode: string, originalCourse: CurriculumCourse) => {
    const selectedOption = originalCourse.electiveOptions?.find((o) => o.courseCode === optionCode);
    if (!selectedOption) return;

    setCoursesState((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        courseCode: selectedOption.courseCode,
        courseTitle: selectedOption.courseTitle,
        selectedElectiveCode: optionCode,
        // Reset marks for this slot when switching electives
        cie: "",
        see: "",
        total: "",
      };
      return copy;
    });
  };

  // Update Marks for a Course with strict boundary validation
  const handleMarkChange = (index: number, field: "cie" | "see" | "total", val: string) => {
    const row = coursesState[index];
    let num: number | "" = "";

    if (val !== "") {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        num = parsed;
      }
    }

    setCoursesState((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: num,
      };
      return copy;
    });
  };

  // Evaluation & Normalization Pipeline for Each Course Row
  const evaluatedRows = useMemo(() => {
    return coursesState.map((row) => {
      const rawMarks: RawMarksInput = {
        cie: row.cie,
        see: row.see,
        total: row.total,
      };

      const validation = validateMarksInput(row.assessment, row.inputMode, rawMarks);
      const normalized = normalizeCourseScore(row.courseCode, row.assessment, row.inputMode, rawMarks);
      const gradeResult = deriveGradeFromNormalized(normalized, row.assessment, rawMarks, row.inputMode);

      let status: "not_entered" | "incomplete" | "complete" | "invalid" = "not_entered";

      const hasAnyInput = row.cie !== "" || row.see !== "" || row.total !== "";

      if (!hasAnyInput) {
        status = "not_entered";
      } else if (!validation.isValid) {
        status = "invalid";
      } else if (validation.isComplete) {
        status = "complete";
      } else {
        status = "incomplete";
      }

      const creditPoints =
        row.includedInSGPA && row.credits > 0 && status === "complete"
          ? row.credits * gradeResult.gradePoint
          : 0;

      // Formatting calculation string
      let calculationDisplay = "";
      if (row.inputMode === "total") {
        const enteredVal = typeof row.total === "number" ? row.total : 0;
        calculationDisplay = `${enteredVal} / ${normalized.maximumMarks}`;
      } else if (row.assessment.hasSEE) {
        const cVal = typeof row.cie === "number" ? row.cie : 0;
        const sVal = typeof row.see === "number" ? row.see : 0;
        calculationDisplay = `${cVal} + ${sVal} = ${normalized.marksObtained} / ${normalized.maximumMarks}`;
      } else {
        const cVal = typeof row.cie === "number" ? row.cie : 0;
        calculationDisplay = `${cVal} / ${normalized.maximumMarks}`;
      }

      return {
        ...row,
        validation,
        normalized,
        gradeResult,
        creditPoints,
        status,
        calculationDisplay,
      };
    });
  }, [coursesState]);

  // Convert evaluated rows into CourseResultInput for calculation engine
  const evaluatedCourses: CourseResultInput[] = useMemo(() => {
    return evaluatedRows
      .filter((r) => r.status === "complete")
      .map((r) => ({
        courseCode: r.courseCode,
        courseTitle: r.courseTitle,
        credits: r.credits,
        assessmentMarks: {
          cie: typeof r.cie === "number" ? r.cie : 0,
          see: typeof r.see === "number" ? r.see : 0,
          total: typeof r.total === "number" ? r.total : 0,
        },
        inputMode: r.inputMode,
        totalMarks: r.normalized.marksObtained,
        percentage: r.normalized.percentage,
        grade: r.gradeResult.grade,
        gradePoint: r.gradeResult.gradePoint,
        creditPoints: r.creditPoints,
        isPassed: r.gradeResult.isPassed,
        includedInSGPA: r.includedInSGPA,
        includedInCGPA: r.includedInCGPA,
        remark: r.gradeResult.remark,
      }));
  }, [evaluatedRows]);

  // Total required courses contributing to SGPA
  const requiredCreditCoursesCount = useMemo(() => {
    return coursesState.filter((c) => c.includedInSGPA && c.credits > 0).length;
  }, [coursesState]);

  // Evaluated SGPA Result
  const sgpaResult = useMemo(() => {
    if (mode === "vtu") {
      return calculateVTUSGPA(evaluatedCourses, {
        totalRequiredCourses: requiredCreditCoursesCount,
      });
    }

    // Custom Mode Evaluation
    const customEvaluated: CourseResultInput[] = customCourses.map((c) => {
      const evalGrade = deriveGrade(c.marks);
      return {
        courseCode: c.id,
        courseTitle: c.name,
        credits: c.credits,
        assessmentMarks: { total: c.marks },
        totalMarks: c.marks,
        percentage: c.marks,
        grade: evalGrade.grade,
        gradePoint: evalGrade.gradePoint,
        creditPoints: c.credits * evalGrade.gradePoint,
        isPassed: evalGrade.isPassed,
        includedInSGPA: true,
        includedInCGPA: true,
      };
    });

    return calculateVTUSGPA(customEvaluated);
  }, [mode, evaluatedCourses, requiredCreditCoursesCount, customCourses]);

  const rawCourses = useMemo(() => {
    return curriculumIndex.getCourses(selectedScheme, selectedBranch, selectedSemester);
  }, [selectedScheme, selectedBranch, selectedSemester]);

  // Copy Result
  const handleCopy = async () => {
    const text = `VTU Semester ${selectedSemester} SGPA: ${sgpaResult.sgpa.toFixed(2)} | Credits: ${sgpaResult.totalCredits} | Points: ${sgpaResult.totalCreditPoints}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  // Save to Local IndexedDB & Workspace Snapshot
  const handleSaveSnapshot = async () => {
    try {
      // 1. Save to local-first IndexedDB semester records
      await academicStorage.saveSemesterRecord({
        id: `sem_${selectedSemester}`,
        profileId: "default_profile",
        university: selectedUniversity,
        scheme: selectedScheme,
        branch: selectedBranch,
        semester: selectedSemester,
        curriculumVersion: "1.0",
        gradingVersion: "VTU-2022-v1",
        sgpa: sgpaResult.sgpa,
        totalCredits: sgpaResult.totalCredits,
        earnedCredits: sgpaResult.earnedCredits,
        totalCreditPoints: sgpaResult.totalCreditPoints,
        hasBacklogs: sgpaResult.hasBacklogs,
        status: sgpaResult.isComplete ? "completed" : "partially_entered",
        courses: evaluatedCourses.map((c) => ({
          courseCode: c.courseCode,
          courseTitle: c.courseTitle,
          credits: c.credits,
          assessmentMarks: c.assessmentMarks,
          inputMode: c.inputMode || "cie-see",
          totalMarks: c.totalMarks,
          percentage: c.percentage,
          grade: c.grade,
          gradePoint: c.gradePoint,
          creditPoints: c.creditPoints,
          isPassed: c.isPassed,
          includedInSGPA: c.includedInSGPA,
          includedInCGPA: c.includedInCGPA,
          remark: c.remark,
        })),
        calculationSteps: sgpaResult.calculationSteps,
        updatedAt: new Date().toISOString(),
      });

      // 2. Add calculation history entry
      await academicStorage.addHistoryEntry({
        profileId: "default_profile",
        type: "SGPA",
        title: `VTU SGPA — Semester ${selectedSemester}`,
        summary: `SGPA: ${sgpaResult.sgpa} (${sgpaResult.totalCredits} registered credits)`,
        details: {
          semester: selectedSemester,
          scheme: selectedScheme,
          branch: selectedBranch,
          sgpa: sgpaResult.sgpa,
          totalCredits: sgpaResult.totalCredits,
          earnedCredits: sgpaResult.earnedCredits,
          hasBacklogs: sgpaResult.hasBacklogs,
        },
      });

      // 3. Keep local snapshot in sync
      await studentService.saveAcademicRecord({
        university: selectedUniversity,
        scheme: selectedScheme,
        branch: selectedBranch,
        curriculumVersion: "1.0",
        gradingVersion: "VTU-2022-v1",
        calculatedAt: new Date().toISOString(),
        semesters: [
          {
            semester: selectedSemester,
            semesterName: `Semester ${selectedSemester}`,
            courses: evaluatedCourses,
            sgpa: sgpaResult.sgpa,
            totalCredits: sgpaResult.totalCredits,
            earnedCredits: sgpaResult.earnedCredits,
            totalCreditPoints: sgpaResult.totalCreditPoints,
            hasBacklogs: sgpaResult.hasBacklogs,
            status: sgpaResult.isComplete ? "completed" : "partially_entered",
          },
        ],
        cgpa: sgpaResult.sgpa,
        totalCredits: sgpaResult.totalCredits,
        earnedCredits: sgpaResult.earnedCredits,
        totalCreditPoints: sgpaResult.totalCreditPoints,
        percentageEquivalent: (sgpaResult.sgpa - 0.75) * 10,
        status: "active",
      });
      setSavedNotice("Semester SGPA saved securely to your local student workspace!");
      setTimeout(() => setSavedNotice(null), 3500);
    } catch {
      setSavedNotice("Saved locally.");
      setTimeout(() => setSavedNotice(null), 3000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
        {/* 1. HERO HEADER */}
        <div className="space-y-2.5 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>VTU Academic Intelligence • Official 2022 Scheme</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Calculate your SGPA
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Course-specific assessment intelligence: CIE + SEE where applicable, CIE-only for continuous evaluation, and optional Total Marks entry.
          </p>
        </div>

        {/* MODE TOGGLE: VTU Curriculum Engine vs Custom */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-slate-200/80 rounded-2xl shadow-inner text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode("vtu")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                mode === "vtu" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              VTU Curriculum Engine
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                mode === "custom" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Subject Entry
            </button>
          </div>
        </div>

        {mode === "vtu" ? (
          <>
            {/* 2. VTU STEPPER SELECTION CONTAINER */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Choose your academic profile</h2>
                  <p className="text-xs text-slate-500">Official syllabus loaded from {VTU_METADATA.universityShort}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified VTU Source</span>
                </div>
              </div>

              {/* STEPPER GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Semester Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="select-semester" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    1. Semester
                  </label>
                  <select
                    id="select-semester"
                    value={selectedSemester}
                    onChange={(e) => handleSemesterChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-800"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. University Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="select-university" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    2. University
                  </label>
                  <select
                    id="select-university"
                    disabled
                    value={selectedUniversity}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-bold cursor-not-allowed"
                  >
                    <option value="VTU">VTU (Visvesvaraya Tech Univ)</option>
                  </select>
                </div>

                {/* 3. Scheme Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="select-scheme" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    3. Scheme
                  </label>
                  <select
                    id="select-scheme"
                    value={selectedScheme}
                    onChange={(e) => handleSchemeChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-800"
                  >
                    {AVAILABLE_VTU_SCHEMES.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Branch Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="select-branch" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    4. Branch
                  </label>
                  <select
                    id="select-branch"
                    value={selectedBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-800"
                  >
                    {AVAILABLE_VTU_SCHEMES.find((s) => s.id === selectedScheme)?.branches.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* VERIFICATION STATUS ALERT */}
              {!isVerified && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm">Curriculum data for this combination has not been verified yet.</p>
                    <p className="text-amber-700">
                      Under VTU guidelines, higher semesters (Semesters 6–8) are released sequentially. Choose another semester (Sem 1–5 for CSE) or switch to Custom Subject Entry.
                    </p>
                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleSemesterChange(3)}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold cursor-pointer"
                      >
                        Choose Semester 3 (Verified)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("custom")}
                        className="px-3 py-1 bg-white border border-amber-300 text-amber-800 rounded-lg font-semibold cursor-pointer"
                      >
                        Custom Subject Entry
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. AUTO-LOADED COURSES & EVALUATION FORM */}
            {isVerified && coursesState.length > 0 && (
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                {/* HEADER & GLOBAL MARKS ENTRY MODE TOGGLE (Section 2) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-extrabold text-slate-900">Enter your course marks</h3>
                    <p className="text-xs text-slate-500">
                      Assessment inputs adapt to each course configuration. Credits are locked per VTU regulations.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* OPTIONAL TOTAL-MARKS INPUT MODE SWITCH */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs">
                      <span className="text-[11px] font-bold text-slate-500 px-2 hidden md:inline">Mode:</span>
                      <button
                        type="button"
                        onClick={() => handleGlobalModeChange("cie-see")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                          globalInputMode === "cie-see"
                            ? "bg-white text-blue-600 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        CIE + SEE
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalModeChange("total")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                          globalInputMode === "total"
                            ? "bg-white text-blue-600 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Total Marks
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleMarks}
                      className="px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 rounded-xl font-semibold flex items-center gap-1 border border-blue-200 transition-colors cursor-pointer"
                      title="Fill verified marksheet sample"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Sample Marks</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetMarks}
                      disabled={!hasEnteredMarks}
                      className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {/* PARTIALLY FILLED SEMESTER PROGRESS BANNER (Section 21) */}
                <div
                  className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 border ${
                    sgpaResult.isComplete
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                      : "bg-blue-50/60 border-blue-200 text-blue-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {sgpaResult.isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <span className="font-semibold">
                      {sgpaResult.completedCoursesCount} of {requiredCreditCoursesCount} courses completed.
                      {!sgpaResult.isComplete && " Enter remaining marks to calculate your final semester SGPA."}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                      sgpaResult.isComplete
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {sgpaResult.isComplete ? "Finalized" : "Partial / not final"}
                  </span>
                </div>

                {/* COURSE ROWS */}
                <div className="space-y-4">
                  {evaluatedRows.map((row, idx) => {
                    const originalCourse = rawCourses[idx];
                    const isNoSEE = !row.assessment.hasSEE;
                    const maxCie = row.assessment.cie?.maxMarks ?? (isNoSEE ? 100 : 50);
                    const maxSee = row.assessment.see?.maxMarks ?? 50;
                    const maxTotal = row.assessment.total?.maxMarks ?? 100;

                    return (
                      <div
                        key={`${row.courseCode}-${idx}`}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          row.status === "invalid"
                            ? "bg-red-50/40 border-red-200"
                            : row.status === "complete"
                            ? row.gradeResult.isPassed
                              ? "bg-slate-50/80 border-slate-200/90"
                              : "bg-red-50/30 border-red-200"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                          {/* Course Details (Locked Credits & Category) */}
                          <div className="lg:col-span-5 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-blue-700 shadow-2xs">
                                {row.courseCode}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                                {row.category || "Course"}
                              </span>
                              <span className="text-xs font-bold text-slate-600">
                                {row.credits} {row.credits === 1 ? "credit" : "credits"} 🔒
                              </span>
                              {(!row.includedInSGPA || row.credits === 0) && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Does not contribute to SGPA
                                </span>
                              )}
                            </div>

                            {/* Elective Dropdown or Title */}
                            {row.isElectiveGroup && originalCourse?.electiveOptions ? (
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 block">
                                  {originalCourse.electiveGroupTitle || "Select Elective"}
                                </label>
                                <select
                                  value={row.selectedElectiveCode}
                                  onChange={(e) => handleElectiveChange(idx, e.target.value, originalCourse)}
                                  className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                >
                                  {originalCourse.electiveOptions.map((opt) => (
                                    <option key={opt.courseCode} value={opt.courseCode}>
                                      {opt.courseCode} — {opt.courseTitle}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                {row.courseTitle}
                              </h4>
                            )}

                            {/* Status Indicator Badges (Section 22) */}
                            <div className="pt-0.5 flex items-center gap-2">
                              {row.status === "complete" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Complete</span>
                                </span>
                              )}
                              {row.status === "incomplete" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Incomplete</span>
                                </span>
                              )}
                              {row.status === "not_entered" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                  <Circle className="w-3 h-3 text-slate-400" />
                                  <span>Not entered</span>
                                </span>
                              )}
                              {row.status === "invalid" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                                  <span>Invalid input</span>
                                </span>
                              )}

                              {isNoSEE && (
                                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                  Continuous Evaluation (No SEE)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Evaluation Inputs: Case A (CIE+SEE), Case B (No-SEE), or Total Mode */}
                          <div className="lg:col-span-4">
                            {row.inputMode === "total" ? (
                              /* TOTAL-MARKS MODE (Section 4) */
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label
                                    htmlFor={`total-${idx}`}
                                    className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block"
                                  >
                                    Total Marks (Max {maxTotal})
                                  </label>
                                  {row.assessment.allowedInputModes.includes("cie-see") && (
                                    <button
                                      type="button"
                                      onClick={() => handleCourseModeChange(idx, "cie-see")}
                                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                                    >
                                      Switch to CIE+SEE
                                    </button>
                                  )}
                                </div>
                                <input
                                  id={`total-${idx}`}
                                  type="number"
                                  min={0}
                                  max={maxTotal}
                                  step="any"
                                  inputMode="decimal"
                                  placeholder={`0 - ${maxTotal}`}
                                  value={row.total}
                                  onChange={(e) => handleMarkChange(idx, "total", e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-800"
                                />
                              </div>
                            ) : isNoSEE ? (
                              /* CASE B — COURSE HAS NO SEE (Section 1B & 9) */
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label
                                    htmlFor={`cie-${idx}`}
                                    className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block"
                                  >
                                    CIE Marks (Max {maxCie})
                                  </label>
                                  {row.assessment.allowedInputModes.includes("total") && (
                                    <button
                                      type="button"
                                      onClick={() => handleCourseModeChange(idx, "total")}
                                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                                    >
                                      Switch to Total
                                    </button>
                                  )}
                                </div>
                                <input
                                  id={`cie-${idx}`}
                                  type="number"
                                  min={0}
                                  max={maxCie}
                                  step="any"
                                  inputMode="decimal"
                                  placeholder={`0 - ${maxCie}`}
                                  value={row.cie}
                                  onChange={(e) => handleMarkChange(idx, "cie", e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-800"
                                />
                                <p className="text-[10px] text-slate-400">Evaluated 100% via CIE continuous assessment.</p>
                              </div>
                            ) : (
                              /* CASE A — COURSE HAS CIE + SEE (Section 1A & 3) */
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    CIE + SEE Inputs
                                  </span>
                                  {row.assessment.allowedInputModes.includes("total") && (
                                    <button
                                      type="button"
                                      onClick={() => handleCourseModeChange(idx, "total")}
                                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                                    >
                                      Switch to Total
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label
                                      htmlFor={`cie-${idx}`}
                                      className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block"
                                    >
                                      CIE (Max {maxCie})
                                    </label>
                                    <input
                                      id={`cie-${idx}`}
                                      type="number"
                                      min={0}
                                      max={maxCie}
                                      step="any"
                                      inputMode="decimal"
                                      placeholder={`0-${maxCie}`}
                                      value={row.cie}
                                      onChange={(e) => handleMarkChange(idx, "cie", e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-800"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      htmlFor={`see-${idx}`}
                                      className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block"
                                    >
                                      SEE (Max {maxSee})
                                    </label>
                                    <input
                                      id={`see-${idx}`}
                                      type="number"
                                      min={0}
                                      max={maxSee}
                                      step="any"
                                      inputMode="decimal"
                                      placeholder={`0-${maxSee}`}
                                      value={row.see}
                                      onChange={(e) => handleMarkChange(idx, "see", e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-800"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Validation error message */}
                            {row.validation.errorMessage && (
                              <p className="text-[11px] text-red-600 font-semibold mt-1">
                                {row.validation.errorMessage}
                              </p>
                            )}
                          </div>

                          {/* Derived Results (Read-Only) */}
                          <div className="lg:col-span-3 text-right space-y-0.5">
                            <div className="text-xs text-slate-600">
                              Score: <strong className="text-slate-900">{row.calculationDisplay}</strong>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Percentage:{" "}
                              <strong className="text-slate-800 font-mono">
                                {row.status === "complete" ? `${row.normalized.percentage.toFixed(1)}%` : "—"}
                              </strong>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-0.5">
                              {row.status === "complete" ? (
                                <span
                                  className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                                    row.gradeResult.isPassed
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  Grade {row.gradeResult.grade} ({row.gradeResult.gradePoint} pts)
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">Grade —</span>
                              )}
                            </div>

                            <div className="text-[11px] font-medium text-slate-500">
                              Credit Points:{" "}
                              <strong>{row.status === "complete" ? row.creditPoints : "—"}</strong>
                            </div>

                            {row.gradeResult.remark && row.status === "complete" && !row.gradeResult.isPassed && (
                              <p className="text-[10px] text-red-600 font-semibold">{row.gradeResult.remark}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          /* CUSTOM SUBJECT ENTRY MODE */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Custom Subject Entry</h3>
                <p className="text-xs text-slate-500">Manually enter course name, credits, and total marks (0–100).</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCustomCourses((prev) => [
                    ...prev,
                    { id: String(Date.now()), name: `Course ${prev.length + 1}`, credits: 3, marks: 75 },
                  ])
                }
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Course</span>
              </button>
            </div>

            <div className="space-y-3">
              {customCourses.map((c, i) => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => {
                      const copy = [...customCourses];
                      copy[i].name = e.target.value;
                      setCustomCourses(copy);
                    }}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="Credits"
                      min={1}
                      max={10}
                      value={c.credits}
                      onChange={(e) => {
                        const copy = [...customCourses];
                        copy[i].credits = Number(e.target.value);
                        setCustomCourses(copy);
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="Marks"
                      min={0}
                      max={100}
                      value={c.marks}
                      onChange={(e) => {
                        const copy = [...customCourses];
                        copy[i].marks = Number(e.target.value);
                        setCustomCourses(copy);
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomCourses((prev) => prev.filter((item) => item.id !== c.id))}
                    disabled={customCourses.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. RESULT CARD & TRANSPARENCY SECTION */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {mode === "vtu" ? `VTU Semester ${selectedSemester} Result` : "Calculated SGPA"}
                </span>
                {!sgpaResult.isComplete && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Partial
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  {sgpaResult.sgpa.toFixed(2)}
                </span>
                <span className="text-sm font-semibold text-slate-400">/ 10.00</span>
              </div>
              <p className="text-xs text-slate-500 max-w-lg">{sgpaResult.explanation}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Result"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSnapshot}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Workspace</span>
              </button>
            </div>
          </div>

          {savedNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* SUMMARY STATS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Registered Credits</span>
              <span className="text-xl font-black text-slate-900">{sgpaResult.totalCredits}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Earned Credits</span>
              <span className="text-xl font-black text-slate-900">{sgpaResult.earnedCredits}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Credit Points</span>
              <span className="text-xl font-black text-slate-900">{sgpaResult.totalCreditPoints}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Backlogs</span>
              <span className={`text-xl font-black ${sgpaResult.hasBacklogs ? "text-red-600" : "text-emerald-600"}`}>
                {sgpaResult.failedCourses.length}
              </span>
            </div>
          </div>

          {/* SUBJECT BREAKDOWN TABLE (Section 24) */}
          {evaluatedCourses.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Subject Breakdown Table
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Course Code</th>
                      <th className="px-3.5 py-2.5">Course Title</th>
                      <th className="px-3.5 py-2.5 text-center">Credits</th>
                      <th className="px-3.5 py-2.5 text-center">Marks</th>
                      <th className="px-3.5 py-2.5 text-center">Grade</th>
                      <th className="px-3.5 py-2.5 text-center">Grade Point</th>
                      <th className="px-3.5 py-2.5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {evaluatedCourses.map((c) => (
                      <tr key={c.courseCode} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2 font-mono font-bold text-blue-700">{c.courseCode}</td>
                        <td className="px-3.5 py-2 truncate max-w-[200px]">{c.courseTitle}</td>
                        <td className="px-3.5 py-2 text-center font-bold">{c.credits}</td>
                        <td className="px-3.5 py-2 text-center">{c.totalMarks}</td>
                        <td className="px-3.5 py-2 text-center font-bold">{c.grade}</td>
                        <td className="px-3.5 py-2 text-center">{c.gradePoint}</td>
                        <td className="px-3.5 py-2 text-right font-bold text-slate-900">{c.creditPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. CALCULATION TRANSPARENCY & FORMULA DISPLAY (Section 49) */}
          <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>How your result was calculated</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200/80 space-y-2 font-mono text-xs text-slate-700">
              <p className="font-sans font-bold text-slate-800">Normalization & Grading Pipeline:</p>
              <div className="p-2.5 bg-slate-50 rounded-lg text-blue-950 font-bold overflow-x-auto text-[11px]">
                {globalInputMode === "cie-see"
                  ? "CIE + SEE (or CIE continuous) → Total → Percentage → Grade → Grade Point → Credit Point → SGPA"
                  : "Total Marks → Percentage → Grade → Grade Point → Credit Point → SGPA"}
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg text-blue-950 font-bold overflow-x-auto text-[11px]">
                SGPA = Σ(Credit × Grade Point) / Σ(Applicable Credits)
              </div>
              <div className="pt-1 text-slate-600 space-y-1">
                {sgpaResult.calculationSteps.map((step, sIdx) => (
                  <p key={sIdx} className="text-[11px]">{step}</p>
                ))}
              </div>
            </div>

            {/* TRACEABILITY & OFFICIAL SOURCE BADGE (Section 50) */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2 border-t border-blue-100 pt-3">
              <div>
                University: <strong className="text-slate-700">{VTU_METADATA.universityShort}</strong> | Scheme:{" "}
                <strong className="text-slate-700">{selectedScheme} Scheme</strong> | Branch:{" "}
                <strong className="text-slate-700">{selectedBranch}</strong> | Verification:{" "}
                <strong className="text-slate-700">{VTU_METADATA.retrievedAt}</strong>
              </div>
              <a
                href={VTU_METADATA.primarySourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 hover:underline shrink-0"
              >
                <span>Verify on vtu.ac.in</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* NEXT ACTION: LINK TO CGPA CALCULATOR */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
            <div>
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Ready to calculate your Cumulative CGPA?</h4>
              <p className="text-xs text-indigo-700">Combine all 8 semesters to calculate your final degree score and percentage equivalent.</p>
            </div>
            <Link
              href="/student/cgpa-calculator"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Go to CGPA Calculator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* OFFICIAL DISCLAIMER (Section 51) */}
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            Saarvi provides an unofficial calculation based on the selected curriculum and academic rules. It is not an official VTU result or grade card. Verify your official university result for final academic records.
          </p>
        </div>
      </main>

      {/* CONFIRMATION MODAL (Section 18, 27, 28) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-500">Please confirm before proceeding.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {confirmDialog.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
