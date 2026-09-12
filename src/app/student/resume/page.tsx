"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  CareerProfile,
  ResumeVersion,
  ResumeSectionId,
  ResumeTemplateId,
  CareerSkillCategory,
  CareerEducation,
  CareerExperience,
  CareerProject,
  CareerSkill,
  CareerCertification,
  CareerHackathon,
  CareerAchievement,
} from "@/types/career";
import {
  careerService,
  ALL_SKILL_CATEGORIES,
  ACTION_VERBS,
  DEFAULT_SECTION_ORDER,
} from "@/lib/services/careerService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { generateResumePdf } from "@/lib/tools/resume/pdf-export";
import { AIResumeFeedbackModal } from "@/components/career/AIResumeFeedbackModal";
import {
  FileText,
  Plus,
  Trash2,
  FileDown,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Eye,
  Settings,
  Sparkles,
  Download,
  RotateCcw,
  Check,
  Briefcase,
  GraduationCap,
  Award,
  Layers,
  Printer,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Copy,
} from "lucide-react";

const TEMPLATES: Array<{ id: ResumeTemplateId; name: string; description: string; badge: string }> = [
  {
    id: "classic-ats",
    name: "Classic ATS",
    description: "Single column, standard headings, pure text layout for maximum ATS parsing accuracy.",
    badge: "Recruiter Preferred",
  },
  {
    id: "modern-professional",
    name: "Modern Professional",
    description: "Subtle royal blue accents, clean metadata chips, polished hierarchy.",
    badge: "Popular",
  },
  {
    id: "executive",
    name: "Executive",
    description: "Deep navy header, prominent leadership and experience framing.",
    badge: "Senior",
  },
  {
    id: "student-clean",
    name: "Student Clean",
    description: "Prominently highlights VTU/university education, branch, CGPA, projects & hackathons.",
    badge: "Students",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "High information density, condensed typography, zero decorative dividers.",
    badge: "Compact",
  },
];

const SECTION_LABELS: Record<ResumeSectionId, string> = {
  contact: "Contact & Personal Information",
  summary: "Professional Summary",
  education: "Education & Academics",
  skills: "Technical Skills",
  experience: "Work Experience & Internships",
  projects: "Technical Projects",
  certifications: "Certifications",
  hackathons: "Hackathons & Competitions",
  achievements: "Honors & Achievements",
  leadership: "Leadership & Activities",
  volunteering: "Volunteering",
  languages: "Languages",
  additional: "Additional Information",
};

export default function StudentResumePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">Loading Resume Builder...</div>}>
      <ResumeBuilderComponent />
    </Suspense>
  );
}

function ResumeBuilderComponent() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [showAiFeedbackModal, setShowAiFeedbackModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ResumeSectionId>("contact");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // PDF Export States
  const [exporting, setExporting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [newVersionName, setNewVersionName] = useState("");
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);

  // Deterministic Summary Builder form
  const [summaryRole, setSummaryRole] = useState("");
  const [summaryLevel, setSummaryLevel] = useState("Undergraduate student");
  const [summarySpecialization, setSummarySpecialization] = useState("");
  const [summaryFocus, setSummaryFocus] = useState("");

  // Deterministic Bullet Builder form
  const [bulletVerb, setBulletVerb] = useState("Built");
  const [bulletTech, setBulletTech] = useState("");
  const [bulletOutcome, setBulletOutcome] = useState("");
  const [targetBulletEntryId, setTargetBulletEntryId] = useState<string>("");

  // Load profile and versions from IndexedDB on mount
  useEffect(() => {
    async function loadData() {
      try {
        const p = await careerService.getOrCreateProfile();
        setProfile(p);

        let vList = await academicStorage.getAllResumeVersions();
        if (vList.length === 0) {
          const defaultVersion = careerService.createDefaultResumeVersion(
            "Software Engineer Resume",
            "Software Engineer"
          );
          await academicStorage.saveResumeVersion(defaultVersion);
          vList = [defaultVersion];
        }
        setVersions(vList);
        setActiveVersionId(vList[0].id);
      } catch (err) {
        console.error("Failed to load career data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeVersion = useMemo(() => {
    return versions.find((v) => v.id === activeVersionId) || versions[0] || null;
  }, [versions, activeVersionId]);

  // Validation & Completeness Score
  const validationResult = useMemo(() => {
    if (!profile) return { isValid: false, completenessScore: 0, checks: [], warnings: [], errors: [], estimatedPages: 1 };
    return careerService.validateResume(profile, activeVersion || undefined);
  }, [profile, activeVersion]);

  // Save profile helper (Strictly local-first IndexedDB)
  const updateProfile = useCallback(
    async (updater: (prev: CareerProfile) => CareerProfile) => {
      if (!profile) return;
      const next = updater(profile);
      setProfile(next);
      await academicStorage.saveCareerProfile(next);
    },
    [profile]
  );

  // Save version helper
  const updateActiveVersion = useCallback(
    async (updater: (prev: ResumeVersion) => ResumeVersion) => {
      if (!activeVersion) return;
      const next = updater(activeVersion);
      setVersions((prev) => prev.map((v) => (v.id === next.id ? next : v)));
      await academicStorage.saveResumeVersion(next);
    },
    [activeVersion]
  );

  // Reorder sections
  const handleMoveSection = (sectionId: ResumeSectionId, direction: "up" | "down") => {
    if (!activeVersion) return;
    const order = [...activeVersion.sectionOrder];
    const index = order.indexOf(sectionId);
    if (index === -1) return;

    if (direction === "up" && index > 0) {
      const temp = order[index - 1];
      order[index - 1] = order[index];
      order[index] = temp;
    } else if (direction === "down" && index < order.length - 1) {
      const temp = order[index + 1];
      order[index + 1] = order[index];
      order[index] = temp;
    }

    updateActiveVersion((v) => ({ ...v, sectionOrder: order }));
  };

  // Toggle section enabled
  const handleToggleSection = (sectionId: ResumeSectionId) => {
    if (!activeVersion) return;
    const current = activeVersion.enabledSections[sectionId] ?? true;
    updateActiveVersion((v) => ({
      ...v,
      enabledSections: {
        ...v.enabledSections,
        [sectionId]: !current,
      },
    }));
  };

  // Create new resume version
  const handleCreateVersion = async () => {
    if (!newVersionName.trim()) return;
    const newVer = careerService.createDefaultResumeVersion(
      newVersionName.trim(),
      activeVersion?.targetRole || "Software Engineer"
    );
    await academicStorage.saveResumeVersion(newVer);
    setVersions((prev) => [...prev, newVer]);
    setActiveVersionId(newVer.id);
    setNewVersionName("");
    setShowNewVersionModal(false);
    setNotice(`Created new version "${newVer.name}".`);
    setTimeout(() => setNotice(null), 3000);
  };

  // Delete current resume version
  const handleDeleteVersion = async (versionId: string) => {
    if (versions.length <= 1) {
      alert("You must keep at least one resume version.");
      return;
    }
    if (!confirm("Are you sure you want to delete this resume version?")) return;

    await academicStorage.deleteResumeVersion(versionId);
    const remaining = versions.filter((v) => v.id !== versionId);
    setVersions(remaining);
    setActiveVersionId(remaining[0].id);
    setNotice("Resume version deleted.");
    setTimeout(() => setNotice(null), 3000);
  };

  // Sync existing academic, certificate, hackathon, and internship records
  const handleSyncExistingData = async () => {
    if (!profile) return;
    setSyncing(true);
    try {
      const res = await careerService.syncExistingDataToProfile(profile);
      setProfile(res.profile);
      const total =
        res.imported.education +
        res.imported.certificates +
        res.imported.hackathons +
        res.imported.internships;
      setNotice(
        total > 0
          ? `Synced ${total} local item(s) into your Career Profile.`
          : "All existing records are already connected."
      );
    } catch {
      setNotice("Failed to sync records.");
    } finally {
      setSyncing(false);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  // Generate deterministic summary
  const handleGenerateSummary = () => {
    if (!profile) return;
    const skills = profile.skills.slice(0, 5).map((s) => s.name);
    const summary = careerService.generateDeterministicSummary({
      targetRole: summaryRole || activeVersion?.targetRole || profile.professionalTitle || "Software Engineer",
      level: summaryLevel,
      specialization: summarySpecialization,
      careerFocus: summaryFocus,
      topSkills: skills,
    });
    updateProfile((p) => ({ ...p, summary }));
    updateActiveVersion((v) => ({ ...v, summaryOverride: summary }));
    setNotice("Deterministic summary updated.");
    setTimeout(() => setNotice(null), 2500);
  };

  // Append deterministic bullet point
  const handleAddBulletToEntry = (type: "project" | "experience", entryId: string) => {
    if (!bulletOutcome.trim()) {
      alert("Please enter a measurable outcome for the bullet.");
      return;
    }
    const bullet = careerService.generateDeterministicBullet({
      actionVerb: bulletVerb,
      technology: bulletTech,
      outcome: bulletOutcome,
    });

    if (type === "project") {
      updateProfile((p) => ({
        ...p,
        projects: p.projects.map((proj) =>
          proj.id === entryId ? { ...proj, highlights: [...proj.highlights, bullet] } : proj
        ),
      }));
    } else {
      updateProfile((p) => ({
        ...p,
        experience: p.experience.map((exp) =>
          exp.id === entryId ? { ...exp, bullets: [...exp.bullets, bullet] } : exp
        ),
      }));
    }

    setBulletTech("");
    setBulletOutcome("");
    setNotice("Bullet point added.");
    setTimeout(() => setNotice(null), 2000);
  };

  // Client-Side Vector PDF Export with single 3-second countdown
  const handleExportPDF = async () => {
    if (!profile || !activeVersion) return;
    setExporting(true);
    setDownloadUrl(null);

    try {
      const res = await generateResumePdf({ profile, version: activeVersion });
      setDownloadUrl(res.blobUrl);
      setPdfPageCount(res.pageCount);

      // Save deterministic snapshot to IndexedDB
      const snap = careerService.createSnapshot(activeVersion, profile, res.pageCount);
      await academicStorage.saveResumeSnapshot(snap);

      // Trigger 3-second countdown rule -> single auto-download
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) {
            clearInterval(timer);
            return null;
          }
          if (prev <= 1) {
            clearInterval(timer);
            // Single automatic download
            const a = document.createElement("a");
            a.href = res.blobUrl;
            a.download = `${(profile.fullName || "Resume").replace(/\s+/g, "_")}_${activeVersion.name.replace(/\s+/g, "_")}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setExporting(false);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Check console for details.");
      setExporting(false);
    }
  };

  const handleManualDownloadAgain = () => {
    if (!downloadUrl || !profile || !activeVersion) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${(profile.fullName || "Resume").replace(/\s+/g, "_")}_${activeVersion.name.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || !profile || !activeVersion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-600">
        Loading Career Resume Builder...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      {/* Action Banners & Notices */}
      {notice && (
        <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm font-medium shadow-sm transition-all">
          {notice}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Resume & CV Builder</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Local-First
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Create targeted ATS-friendly resumes across multiple roles using your actual academic, project, and certification records.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSyncExistingData}
              disabled={syncing}
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
              title="Pull VTU records, certificates, hackathons & internships"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              Sync Local Records
            </button>

            <button
              onClick={() => setShowAiFeedbackModal(true)}
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-sm transition-colors"
              title="Get optional AI suggestions"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-indigo-600" />
              AI Review
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4 mr-1.5 text-slate-500" />
              Print
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
            >
              <FileDown className="w-4 h-4 mr-1.5" />
              {exporting
                ? countdown !== null
                  ? `Downloading in ${countdown}s...`
                  : "Generating PDF..."
                : "Export PDF"}
            </button>

            {downloadUrl && (
              <button
                onClick={handleManualDownloadAgain}
                className="inline-flex items-center px-3 py-2 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Download className="w-4 h-4 mr-1" />
                Download Again
              </button>
            )}
          </div>
        </div>

        {/* Top Control Bar: Version Selector & Completeness Indicator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 my-6">
          {/* Resume Version Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current Resume Version
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowNewVersionModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-0.5" />
                  New Version
                </button>
                {versions.length > 1 && (
                  <button
                    onClick={() => handleDeleteVersion(activeVersion.id)}
                    className="text-xs text-red-600 hover:text-red-700 font-medium ml-2 inline-flex items-center"
                    title="Delete Version"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <select
              value={activeVersion.id}
              onChange={(e) => setActiveVersionId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.targetRole})
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <span>Target Role: <strong className="text-slate-700">{activeVersion.targetRole}</strong></span>
              <span>Template: <strong className="text-slate-700">{activeVersion.template}</strong></span>
            </div>
          </div>

          {/* ATS-Friendly Checks & Completeness */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resume Completeness
              </span>
              <span className="text-sm font-bold text-slate-900">
                {validationResult.completenessScore}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  validationResult.completenessScore >= 80
                    ? "bg-emerald-500"
                    : validationResult.completenessScore >= 50
                    ? "bg-blue-500"
                    : "bg-amber-500"
                }`}
                style={{ width: `${validationResult.completenessScore}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">
                ATS-Friendly Status:{" "}
                <strong className={validationResult.isValid ? "text-emerald-700" : "text-amber-700"}>
                  {validationResult.isValid ? "Passes Standard Checks" : "Action Needed"}
                </strong>
              </span>
              <span className="text-slate-500">{validationResult.checks.filter((c) => c.passed).length}/{validationResult.checks.length} checks</span>
            </div>
          </div>

          {/* One-Page Layout Preference */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Layout Preference
                </span>
                <span className="text-sm font-medium text-slate-800">Prefer Single Page</span>
              </div>
              <input
                type="checkbox"
                checked={activeVersion.preferOnePage}
                onChange={(e) => updateActiveVersion((v) => ({ ...v, preferOnePage: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>

            {validationResult.estimatedPages > 1 && activeVersion.preferOnePage && (
              <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>Your resume contains more content than can comfortably fit on one page. Consider shortening sections.</span>
              </div>
            )}

            <div className="mt-2 text-xs text-slate-500">
              Estimated page length: <strong>{validationResult.estimatedPages} page(s)</strong> (A4)
            </div>
          </div>
        </div>

        {/* Template Selector Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-3">
            Select Professional Template
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {TEMPLATES.map((tmpl) => {
              const isSelected = activeVersion.template === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => updateActiveVersion((v) => ({ ...v, template: tmpl.id }))}
                  className={`p-3 rounded-lg text-left border transition-all ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-900">{tmpl.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {tmpl.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{tmpl.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Editor & Section Reordering View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Section Navigator & Reordering */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sections & Reordering
                </span>
                <span className="text-[11px] text-slate-400">Controls order in export</span>
              </div>

              <div className="space-y-1.5">
                {activeVersion.sectionOrder.map((secId, idx) => {
                  const isEnabled = activeVersion.enabledSections[secId] ?? true;
                  const isCurrentTab = activeTab === secId;

                  return (
                    <div
                      key={secId}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-colors ${
                        isCurrentTab
                          ? "bg-blue-50 text-blue-900 border border-blue-200"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent"
                      }`}
                    >
                      <button
                        onClick={() => setActiveTab(secId)}
                        className="flex-1 text-left truncate flex items-center gap-2 mr-2"
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSection(secId);
                          }}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className={!isEnabled ? "line-through text-slate-400" : ""}>
                          {SECTION_LABELS[secId]}
                        </span>
                      </button>

                      {/* Accessible Up/Down Reorder Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveSection(secId, "up")}
                          disabled={idx === 0}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move section up"
                          aria-label={`Move ${SECTION_LABELS[secId]} up`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveSection(secId, "down")}
                          disabled={idx === activeVersion.sectionOrder.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move section down"
                          aria-label={`Move ${SECTION_LABELS[secId]} down`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ATS Verification Checklist */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-3">
                ATS-Friendly Verification Checks
              </span>
              <div className="space-y-2">
                {validationResult.checks.map((chk) => (
                  <div key={chk.id} className="flex items-start gap-2 text-xs">
                    {chk.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className={`font-semibold ${chk.passed ? "text-slate-800" : "text-amber-800"}`}>
                        {chk.label}
                      </span>
                      <p className="text-slate-500 text-[11px] leading-tight mt-0.5">{chk.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Section Content Editor */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              {/* Active Tab Title */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{SECTION_LABELS[activeTab]}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data updates automatically persist locally to IndexedDB.
                  </p>
                </div>
              </div>

              {/* TAB 1: CONTACT */}
              {activeTab === "contact" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={profile.fullName}
                        onChange={(e) => updateProfile((p) => ({ ...p, fullName: e.target.value }))}
                        placeholder="e.g. John Doe"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Professional Title
                      </label>
                      <input
                        type="text"
                        value={profile.professionalTitle}
                        onChange={(e) => updateProfile((p) => ({ ...p, professionalTitle: e.target.value }))}
                        placeholder="e.g. Computer Science Student / Software Developer"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => updateProfile((p) => ({ ...p, email: e.target.value }))}
                        placeholder="name@university.edu"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => updateProfile((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Location</label>
                      <input
                        type="text"
                        value={profile.location}
                        onChange={(e) => updateProfile((p) => ({ ...p, location: e.target.value }))}
                        placeholder="Bengaluru, Karnataka"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">LinkedIn URL</label>
                      <input
                        type="text"
                        value={profile.linkedin || ""}
                        onChange={(e) => updateProfile((p) => ({ ...p, linkedin: e.target.value }))}
                        placeholder="linkedin.com/in/username"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">GitHub URL</label>
                      <input
                        type="text"
                        value={profile.github || ""}
                        onChange={(e) => updateProfile((p) => ({ ...p, github: e.target.value }))}
                        placeholder="github.com/username"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUMMARY */}
              {activeTab === "summary" && (
                <div className="space-y-4">
                  {/* Deterministic Summary Builder Tool */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      Deterministic Summary Builder (Structured Template — No AI)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Role</label>
                        <input
                          type="text"
                          value={summaryRole}
                          onChange={(e) => setSummaryRole(e.target.value)}
                          placeholder="e.g. Frontend Developer"
                          className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Specialization</label>
                        <input
                          type="text"
                          value={summarySpecialization}
                          onChange={(e) => setSummarySpecialization(e.target.value)}
                          placeholder="e.g. React & TypeScript"
                          className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleGenerateSummary}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                    >
                      Assemble Structured Summary
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Professional Summary Text
                    </label>
                    <textarea
                      rows={5}
                      value={activeVersion.summaryOverride ?? profile.summary ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateProfile((p) => ({ ...p, summary: val }));
                        updateActiveVersion((v) => ({ ...v, summaryOverride: val }));
                      }}
                      placeholder="Write a concise overview of your background, technical interests, and projects..."
                      className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Character count: {(activeVersion.summaryOverride ?? profile.summary ?? "").length}</span>
                      <span>Recommended: under 500 characters</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EDUCATION */}
              {activeTab === "education" && (
                <div className="space-y-4">
                  {profile.education.map((edu, idx) => (
                    <div key={edu.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Education #{idx + 1}</span>
                        <button
                          onClick={() => updateProfile((p) => ({ ...p, education: p.education.filter((e) => e.id !== edu.id) }))}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Institution</label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                education: p.education.map((ed) => (ed.id === edu.id ? { ...ed, institution: e.target.value } : ed)),
                              }))
                            }
                            placeholder="e.g. Visvesvaraya Technological University"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Degree & Field</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                education: p.education.map((ed) => (ed.id === edu.id ? { ...ed, degree: e.target.value } : ed)),
                              }))
                            }
                            placeholder="e.g. Bachelor of Engineering in Computer Science"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Start Year</label>
                          <input
                            type="text"
                            value={edu.startDate}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                education: p.education.map((ed) => (ed.id === edu.id ? { ...ed, startDate: e.target.value } : ed)),
                              }))
                            }
                            placeholder="2022"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">End Year (or Present)</label>
                          <input
                            type="text"
                            value={edu.endDate}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                education: p.education.map((ed) => (ed.id === edu.id ? { ...ed, endDate: e.target.value } : ed)),
                              }))
                            }
                            placeholder="2026"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">CGPA / Marks</label>
                          <input
                            type="text"
                            value={edu.gpa || ""}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                education: p.education.map((ed) => (ed.id === edu.id ? { ...ed, gpa: e.target.value } : ed)),
                              }))
                            }
                            placeholder="e.g. 8.85 CGPA"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      updateProfile((p) => ({
                        ...p,
                        education: [
                          ...p.education,
                          {
                            id: `edu_${Date.now()}`,
                            institution: "",
                            degree: "",
                            fieldOfStudy: "",
                            startDate: "",
                            endDate: "",
                            showOnResume: true,
                          },
                        ],
                      }))
                    }
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Education
                  </button>
                </div>
              )}

              {/* TAB 4: SKILLS */}
              {activeTab === "skills" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ALL_SKILL_CATEGORIES.map((cat) => {
                      const categorySkills = profile.skills.filter((s) => s.category === cat);
                      return (
                        <div key={cat} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800">{cat}</span>
                            <button
                              onClick={() => {
                                const name = prompt(`Enter skill for ${cat}:`);
                                if (name && name.trim()) {
                                  updateProfile((p) => ({
                                    ...p,
                                    skills: [
                                      ...p.skills,
                                      {
                                        id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                                        name: name.trim(),
                                        category: cat,
                                      },
                                    ],
                                  }));
                                }
                              }}
                              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold"
                            >
                              + Add
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {categorySkills.map((sk) => (
                              <span
                                key={sk.id}
                                className="inline-flex items-center text-xs bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800"
                              >
                                {sk.name}
                                <button
                                  onClick={() =>
                                    updateProfile((p) => ({
                                      ...p,
                                      skills: p.skills.filter((s) => s.id !== sk.id),
                                    }))
                                  }
                                  className="ml-1 text-slate-400 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            {categorySkills.length === 0 && (
                              <span className="text-[11px] text-slate-400 italic">No skills added yet</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: EXPERIENCE */}
              {activeTab === "experience" && (
                <div className="space-y-4">
                  {profile.experience.map((exp, idx) => (
                    <div key={exp.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Experience #{idx + 1}</span>
                        <button
                          onClick={() => updateProfile((p) => ({ ...p, experience: p.experience.filter((e) => e.id !== exp.id) }))}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Company</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                experience: p.experience.map((ex) => (ex.id === exp.id ? { ...ex, company: e.target.value } : ex)),
                              }))
                            }
                            placeholder="e.g. Acme Tech"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Role</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                experience: p.experience.map((ex) => (ex.id === exp.id ? { ...ex, role: e.target.value } : ex)),
                              }))
                            }
                            placeholder="e.g. Software Engineering Intern"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                      </div>

                      {/* Bullets List */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bullet Points</label>
                        <div className="space-y-1 mb-2">
                          {exp.bullets.map((b, bIdx) => (
                            <div key={bIdx} className="flex items-start gap-1 text-xs bg-white border border-slate-200 p-1.5 rounded">
                              <span className="flex-1">{b}</span>
                              <button
                                onClick={() =>
                                  updateProfile((p) => ({
                                    ...p,
                                    experience: p.experience.map((ex) =>
                                      ex.id === exp.id
                                        ? { ...ex, bullets: ex.bullets.filter((_, i) => i !== bIdx) }
                                        : ex
                                    ),
                                  }))
                                }
                                className="text-slate-400 hover:text-red-500"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Bullet Builder Subpanel */}
                        <div className="p-2.5 bg-white border border-slate-200 rounded text-xs space-y-2">
                          <span className="font-semibold text-slate-700 block">Structured Bullet Builder</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                              value={targetBulletEntryId === exp.id ? bulletVerb : "Built"}
                              onChange={(e) => {
                                setTargetBulletEntryId(exp.id);
                                setBulletVerb(e.target.value);
                              }}
                              className="border border-slate-300 rounded p-1.5 text-xs"
                            >
                              {ACTION_VERBS.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={targetBulletEntryId === exp.id ? bulletTech : ""}
                              onChange={(e) => {
                                setTargetBulletEntryId(exp.id);
                                setBulletTech(e.target.value);
                              }}
                              placeholder="Tech (e.g. Next.js & REST APIs)"
                              className="border border-slate-300 rounded p-1.5 text-xs"
                            />
                            <input
                              type="text"
                              value={targetBulletEntryId === exp.id ? bulletOutcome : ""}
                              onChange={(e) => {
                                setTargetBulletEntryId(exp.id);
                                setBulletOutcome(e.target.value);
                              }}
                              placeholder="Outcome (e.g. improve query speed by 35%)"
                              className="border border-slate-300 rounded p-1.5 text-xs"
                            />
                          </div>
                          <button
                            onClick={() => handleAddBulletToEntry("experience", exp.id)}
                            className="px-3 py-1 bg-slate-800 text-white rounded text-[11px] font-medium hover:bg-slate-900"
                          >
                            Add Structured Bullet
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      updateProfile((p) => ({
                        ...p,
                        experience: [
                          ...p.experience,
                          {
                            id: `exp_${Date.now()}`,
                            company: "",
                            role: "",
                            startDate: "",
                            endDate: "",
                            bullets: [],
                            showOnResume: true,
                          },
                        ],
                      }))
                    }
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Experience
                  </button>
                </div>
              )}

              {/* TAB 6: PROJECTS */}
              {activeTab === "projects" && (
                <div className="space-y-4">
                  {profile.projects.map((proj, idx) => (
                    <div key={proj.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Project #{idx + 1}</span>
                        <button
                          onClick={() => updateProfile((p) => ({ ...p, projects: p.projects.filter((pr) => pr.id !== proj.id) }))}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Title</label>
                          <input
                            type="text"
                            value={proj.title}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                projects: p.projects.map((pr) => (pr.id === proj.id ? { ...pr, title: e.target.value } : pr)),
                              }))
                            }
                            placeholder="e.g. Saarvi Productivity Suite"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">GitHub / Live URL</label>
                          <input
                            type="text"
                            value={proj.githubUrl || proj.liveUrl || ""}
                            onChange={(e) =>
                              updateProfile((p) => ({
                                ...p,
                                projects: p.projects.map((pr) => (pr.id === proj.id ? { ...pr, githubUrl: e.target.value } : pr)),
                              }))
                            }
                            placeholder="github.com/user/project"
                            className="w-full text-xs border border-slate-300 rounded p-2"
                          />
                        </div>
                      </div>

                      {/* Highlights */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Highlights</label>
                        <div className="space-y-1 mb-2">
                          {proj.highlights.map((h, hIdx) => (
                            <div key={hIdx} className="flex items-start gap-1 text-xs bg-white border border-slate-200 p-1.5 rounded">
                              <span className="flex-1">{h}</span>
                              <button
                                onClick={() =>
                                  updateProfile((p) => ({
                                    ...p,
                                    projects: p.projects.map((pr) =>
                                      pr.id === proj.id
                                        ? { ...pr, highlights: pr.highlights.filter((_, i) => i !== hIdx) }
                                        : pr
                                    ),
                                  }))
                                }
                                className="text-slate-400 hover:text-red-500"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Bullet Builder Subpanel */}
                        <div className="p-2.5 bg-white border border-slate-200 rounded text-xs space-y-2">
                          <span className="font-semibold text-slate-700 block">Structured Bullet Builder</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                              value={targetBulletEntryId === proj.id ? bulletVerb : "Built"}
                              onChange={(e) => {
                                setTargetBulletEntryId(proj.id);
                                setBulletVerb(e.target.value);
                              }}
                              className="border border-slate-300 rounded p-1.5 text-xs"
                            >
                              {ACTION_VERBS.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={targetBulletEntryId === proj.id ? bulletTech : ""}
                              onChange={(e) => {
                                setTargetBulletEntryId(proj.id);
                                setBulletTech(e.target.value);
                              }}
                              placeholder="Tech (e.g. React & IndexedDB)"
                              className="border border-slate-300 rounded p-1.5 text-xs"
                            />
                            <input
                              type="text"
                              value={targetBulletEntryId === proj.id ? bulletOutcome : ""}
                              onChange={(e) => {
                                setTargetBulletEntryId(proj.id);
                                setBulletOutcome(e.target.value);
                              }}
                              placeholder="Outcome (e.g. deliver offline-first sync)"
                              className="border border-slate-300 rounded p-1.5 text-xs"
                            />
                          </div>
                          <button
                            onClick={() => handleAddBulletToEntry("project", proj.id)}
                            className="px-3 py-1 bg-slate-800 text-white rounded text-[11px] font-medium hover:bg-slate-900"
                          >
                            Add Structured Bullet
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      updateProfile((p) => ({
                        ...p,
                        projects: [
                          ...p.projects,
                          {
                            id: `proj_${Date.now()}`,
                            title: "",
                            technologies: [],
                            highlights: [],
                            showOnResume: true,
                          },
                        ],
                      }))
                    }
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Project
                  </button>
                </div>
              )}

              {/* TAB 7: CERTIFICATIONS */}
              {activeTab === "certifications" && (
                <div className="space-y-4">
                  {profile.certifications.map((cert) => (
                    <div key={cert.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <strong className="text-xs text-slate-900">{cert.name}</strong>
                        <p className="text-[11px] text-slate-500">{cert.issuer} {cert.date ? `• ${cert.date}` : ""}</p>
                      </div>
                      <button
                        onClick={() =>
                          updateProfile((p) => ({
                            ...p,
                            certifications: p.certifications.filter((c) => c.id !== cert.id),
                          }))
                        }
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const name = prompt("Certificate name:");
                      if (!name) return;
                      const issuer = prompt("Issuing Organization:") || "";
                      updateProfile((p) => ({
                        ...p,
                        certifications: [
                          ...p.certifications,
                          {
                            id: `cert_${Date.now()}`,
                            name,
                            issuer,
                            date: new Date().toISOString().split("T")[0],
                            showOnResume: true,
                          },
                        ],
                      }));
                    }}
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Certification
                  </button>
                </div>
              )}

              {/* TAB 8: HACKATHONS */}
              {activeTab === "hackathons" && (
                <div className="space-y-4">
                  {profile.hackathons.map((h) => (
                    <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs text-slate-900">{h.title}</strong>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                            {h.outcome}
                          </span>
                        </div>
                        {h.projectTitle && <p className="text-[11px] text-slate-500">Project: {h.projectTitle}</p>}
                      </div>
                      <button
                        onClick={() =>
                          updateProfile((p) => ({
                            ...p,
                            hackathons: p.hackathons.filter((hk) => hk.id !== h.id),
                          }))
                        }
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const title = prompt("Hackathon Title:");
                      if (!title) return;
                      const outcome = prompt("Outcome (Winner / Finalist / Participant):") || "Participant";
                      updateProfile((p) => ({
                        ...p,
                        hackathons: [
                          ...p.hackathons,
                          {
                            id: `hack_${Date.now()}`,
                            title,
                            outcome: outcome as "Winner" | "Finalist" | "Participant",
                            date: new Date().toISOString().split("T")[0],
                            showOnResume: true,
                          },
                        ],
                      }));
                    }}
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Hackathon
                  </button>
                </div>
              )}

              {/* TAB 9: ACHIEVEMENTS */}
              {activeTab === "achievements" && (
                <div className="space-y-4">
                  {profile.achievements.map((ach) => (
                    <div key={ach.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <strong className="text-xs text-slate-900">{ach.title}</strong>
                        {ach.issuer && <p className="text-[11px] text-slate-500">{ach.issuer}</p>}
                      </div>
                      <button
                        onClick={() =>
                          updateProfile((p) => ({
                            ...p,
                            achievements: p.achievements.filter((a) => a.id !== ach.id),
                          }))
                        }
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const title = prompt("Achievement Title:");
                      if (!title) return;
                      updateProfile((p) => ({
                        ...p,
                        achievements: [
                          ...p.achievements,
                          {
                            id: `ach_${Date.now()}`,
                            title,
                            showOnResume: true,
                          },
                        ],
                      }));
                    }}
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Achievement
                  </button>
                </div>
              )}

              {/* Other Tabs fallback */}
              {["leadership", "volunteering", "languages", "additional"].includes(activeTab) && (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-sm">
                  Configure additional optional sections or enable them directly in the section ordering navigator on the left.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* New Version Modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create New Resume Version</h3>
            <p className="text-xs text-slate-600">
              New versions let you tailor selected sections and templates for specific job types (e.g. Frontend Developer, Data Science).
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Version Name</label>
              <input
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="e.g. Frontend Internship Resume"
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewVersionModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={!newVersionName.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Resume Feedback Modal */}
      {showAiFeedbackModal && activeVersion && (
        <AIResumeFeedbackModal
          isOpen={showAiFeedbackModal}
          onClose={() => setShowAiFeedbackModal(false)}
          resume={activeVersion}
        />
      )}

      <Footer />
    </div>
  );
}
