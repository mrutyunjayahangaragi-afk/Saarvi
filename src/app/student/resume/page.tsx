"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
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
  ResumeValidationResult,
  JobMatchResult,
  ResumeTemplateDefinition,
} from "@/types/career";
import {
  SAMPLE_RESUME_PROFILE,
  createSampleProfile,
  createEmptyUserProfile,
  isSampleProfile,
  RESUME_PLACEHOLDERS,
} from "@/lib/services/resumeSampleData";
import { resumeTemplateService } from "@/lib/services/resumeTemplateService";
import {
  careerService,
  ALL_SKILL_CATEGORIES,
  ACTION_VERBS,
  DEFAULT_SECTION_ORDER,
} from "@/lib/services/careerService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { generateResumePdf, generateControlledLatex } from "@/lib/tools/resume/pdf-export";
import { AIResumeFeedbackModal } from "@/components/career/AIResumeFeedbackModal";
import { ResumeLivePreview } from "@/components/career/ResumeLivePreview";
import { ResumeIntelligencePanel } from "@/components/career/ResumeIntelligencePanel";
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
  ChevronLeft,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Copy,
  Code,
  Search,
  BookOpen,
  Camera,
  Image as ImageIcon,
  Target,
} from "lucide-react";

const TEMPLATES: Array<{ id: ResumeTemplateId; name: string; description: string; badge: string }> = [
  {
    id: "classic-ats",
    name: "ATS Classic — Saarvi",
    description: "Official Saarvi single-column, Helvetica, text-based LaTeX structure with hyperref links and non-table skills flow.",
    badge: "ATS First & LaTeX",
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

export default function StudentResumePage({ initialTab = "builder" }: { initialTab?: "builder" | "ats_intelligence" }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">Loading Resume Builder...</div>}>
      <ResumeBuilderComponent initialTab={initialTab} />
    </Suspense>
  );
}

function ResumeBuilderComponent({ initialTab = "builder" }: { initialTab?: "builder" | "ats_intelligence" }) {
  const [mainTab, setMainTab] = useState<"builder" | "ats_intelligence">(initialTab);
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [showAiFeedbackModal, setShowAiFeedbackModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ResumeSectionId>("contact");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">("split");
  const [mobileWorkflow, setMobileWorkflow] = useState<"editor" | "preview" | "ats" | "export">("editor");
  const [showReorderPanel, setShowReorderPanel] = useState(false);

  // Dynamic template catalog from template service / API
  const [availableTemplates, setAvailableTemplates] = useState<ResumeTemplateDefinition[]>(() =>
    resumeTemplateService.getActiveTemplates()
  );

  useEffect(() => {
    fetch("/api/career/templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.templates) && data.templates.length > 0) {
          setAvailableTemplates(data.templates);
        }
      })
      .catch(() => {});
  }, []);

  // PDF & LaTeX Export States
  const [exporting, setExporting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [newVersionName, setNewVersionName] = useState("");
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [latexCopied, setLatexCopied] = useState(false);

  // Job Description Matching States
  const [jobDescriptionInput, setJobDescriptionInput] = useState("");
  const [jobMatchResult, setJobMatchResult] = useState<JobMatchResult | null>(null);
  const [isMatchingJob, setIsMatchingJob] = useState(false);
  const [showJobMatcher, setShowJobMatcher] = useState(false);

  // Profile Image ATS Warning Dialog state
  const [showImageAtsModal, setShowImageAtsModal] = useState(false);

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
        const hasContent = Boolean(
          p.fullName?.trim() ||
          (p.education && p.education.length > 0) ||
          (p.experience && p.experience.length > 0) ||
          (p.projects && p.projects.length > 0) ||
          (p.skills && p.skills.length > 0)
        );

        if (!hasContent) {
          setProfile(createSampleProfile());
        } else {
          setProfile(p);
        }

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

  const handleReplaceWithMyInfo = async () => {
    try {
      const savedProfile = await careerService.getOrCreateProfile();
      const hasSavedReal = Boolean(
        savedProfile.fullName?.trim() && !isSampleProfile(savedProfile)
      );

      if (hasSavedReal) {
        setProfile(savedProfile);
        setNotice("Restored your saved profile details.");
      } else {
        const emptyProfile = createEmptyUserProfile(savedProfile?.id || "user_career_profile");
        setProfile(emptyProfile);
        await academicStorage.saveCareerProfile(emptyProfile);
        setNotice("Ready! Enter your information below. Placeholders will guide you.");
      }
      setActiveTab("contact");
    } catch (err) {
      console.error("Failed to replace sample profile:", err);
    }
  };

  const handleLoadSampleResume = () => {
    setProfile(createSampleProfile());
    setNotice("Loaded realistic sample resume (Alex Johnson, Software Engineer).");
  };

  const activeVersion = useMemo(() => {
    return versions.find((v) => v.id === activeVersionId) || versions[0] || null;
  }, [versions, activeVersionId]);

  // Validation & Completeness Score
  const validationResult: ResumeValidationResult = useMemo(() => {
    if (!profile)
      return {
        isValid: false,
        completenessScore: 0,
        atsScore: 0,
        scoreLabel: "Needs Work" as const,
        categoryScores: [],
        recommendations: [],
        checks: [],
        warnings: [],
        errors: [],
        estimatedPages: 1,
      };
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

  const handleApplyParsedProfile = async (extracted: Partial<CareerProfile>) => {
    if (!profile) return;
    const updated: CareerProfile = {
      ...profile,
      ...extracted,
      skills: [
        ...profile.skills,
        ...(extracted.skills || []).filter(
          (newS) => !profile.skills.some((s) => s.name.toLowerCase() === newS.name.toLowerCase())
        ),
      ],
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    try {
      await careerService.saveProfile(updated);
      setNotice("Extracted resume profile data imported locally.");
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      console.error("Failed to save imported profile:", err);
    }
  };

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

  const handleMatchJobDescription = () => {
    if (!profile || !jobDescriptionInput.trim()) return;
    setIsMatchingJob(true);
    try {
      const res = careerService.matchJobDescription(profile, activeVersion, jobDescriptionInput);
      setJobMatchResult(res);
      // Persist to version in memory
      updateActiveVersion((v) => ({ ...v, jobDescriptionText: jobDescriptionInput, lastJobMatch: res }));
    } finally {
      setIsMatchingJob(false);
    }
  };

  const handleExportLatex = () => {
    if (!profile) return;
    const latex = generateControlledLatex(profile, activeVersion);
    const blob = new Blob([latex], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(profile.fullName || "Resume").replace(/\s+/g, "_")}_Saarvi_ATS.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyLatex = async () => {
    if (!profile) return;
    const latex = generateControlledLatex(profile, activeVersion);
    await navigator.clipboard.writeText(latex);
    setLatexCopied(true);
    setTimeout(() => setLatexCopied(false), 2000);
  };

  if (loading || !profile || !activeVersion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-600">
        Loading Career Resume Builder...
      </div>
    );
  }

  const renderNavigatorAndAtsChecks = () => (
    <div className="space-y-4">
      {/* ATS Score & Category Breakdown Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              ATS Resume Score
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">
                {validationResult.atsScore}
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ 100</span>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              validationResult.atsScore >= 85
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : validationResult.atsScore >= 70
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : validationResult.atsScore >= 50
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {validationResult.scoreLabel}
          </span>
        </div>

        {/* Overall Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              validationResult.atsScore >= 85
                ? "bg-emerald-500"
                : validationResult.atsScore >= 70
                ? "bg-blue-500"
                : validationResult.atsScore >= 50
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
            style={{ width: `${validationResult.atsScore}%` }}
          />
        </div>

        {/* Category Breakdown Bars */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Category Breakdowns
          </span>
          {validationResult.categoryScores.map((cat) => (
            <div key={cat.id} className="text-xs">
              <div className="flex items-center justify-between text-slate-700 mb-1">
                <span className="font-medium text-[11.5px] truncate max-w-[170px]">{cat.name}</span>
                <span className="font-semibold text-[11px] text-slate-500">
                  {cat.score}/{cat.maxScore}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    cat.percentage >= 80
                      ? "bg-emerald-500"
                      : cat.percentage >= 50
                      ? "bg-blue-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable "IMPROVE YOUR SCORE" Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Improve Your Score
          </span>
          <span className="text-[11px] text-slate-400">
            {validationResult.recommendations.length} action(s)
          </span>
        </div>

        {validationResult.recommendations.length === 0 ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Exceptional resume! All ATS score criteria are satisfied.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {validationResult.recommendations.map((rec) => {
              // Map recommendation category to form tab
              let targetTab: ResumeSectionId = "contact";
              if (rec.category.includes("Summary")) targetTab = "summary";
              else if (rec.category.includes("Skill")) targetTab = "skills";
              else if (rec.category.includes("Experience") || rec.category.includes("Project")) {
                targetTab = "projects";
              } else if (rec.category.includes("Education")) targetTab = "education";

              return (
                <div
                  key={rec.id}
                  onClick={() => {
                    setActiveTab(targetTab);
                    setMobileWorkflow("editor");
                  }}
                  className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all cursor-pointer group flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                        rec.impact === "high"
                          ? "bg-rose-100 text-rose-700"
                          : rec.impact === "medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rec.impact} impact
                    </span>
                    <span className="text-[10px] text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Fix now &rarr;
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 text-[11.5px] leading-snug">
                    {rec.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sections & Reordering */}
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
                  onClick={() => {
                    setActiveTab(secId);
                    setMobileWorkflow("editor");
                  }}
                  className="flex-1 text-left truncate flex items-center gap-2 mr-2 min-h-[36px]"
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleSection(secId);
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className={!isEnabled ? "line-through text-slate-400" : ""}>
                    {SECTION_LABELS[secId]}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveSection(secId, "up")}
                    disabled={idx === 0}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    title="Move section up"
                    aria-label={`Move ${SECTION_LABELS[secId]} up`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveSection(secId, "down")}
                    disabled={idx === activeVersion.sectionOrder.length - 1}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 min-w-[32px] min-h-[32px] flex items-center justify-center"
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
  );

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
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
          <Link href="/student/dashboard" className="hover:text-blue-600 transition-colors">
            Student Hub
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Resume & CV Builder</span>
        </nav>

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
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-sm transition-colors cursor-pointer"
              title="Get optional AI suggestions"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-indigo-600" />
              AI Review
            </button>

            <button
              onClick={() => setShowJobMatcher((prev) => !prev)}
              className={`inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border shadow-sm transition-colors cursor-pointer ${
                showJobMatcher
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
              title="Analyze Job Description keyword alignment"
            >
              <Target className="w-4 h-4 mr-1.5" />
              Job Match
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-1.5 text-slate-500" />
              Print
            </button>

            <button
              onClick={handleExportLatex}
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
              title="Export official ATS-compliant LaTeX source (.tex)"
            >
              <Code className="w-4 h-4 mr-1.5 text-slate-600" />
              {latexCopied ? "Copied LaTeX!" : "Export LaTeX"}
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
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
                className="inline-flex items-center px-3 py-2 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 mr-1" />
                Download Again
              </button>
            )}
          </div>
        </div>

        {/* Main Workspace Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2 my-6">
          <button
            onClick={() => setMainTab("builder")}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition ${
              mainTab === "builder"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Resume Builder & LaTeX Templates
          </button>
          <button
            onClick={() => setMainTab("ats_intelligence")}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              mainTab === "ats_intelligence"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Resume Intelligence & ATS Engine (PDF, DOCX, OCR)
          </button>
        </div>

        {mainTab === "ats_intelligence" ? (
          <ResumeIntelligencePanel
            profile={profile}
            activeVersion={activeVersion}
            onApplyParsedProfile={handleApplyParsedProfile}
          />
        ) : (
          <>

        {/* JOB DESCRIPTION KEYWORD MATCHER DRAWER */}
        {showJobMatcher && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-sm my-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Job Description Matcher</h3>
                  <p className="text-xs text-slate-500">
                    Paste a job posting to run deterministic keyword analysis and compare with your current resume.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowJobMatcher(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold px-2 py-1 rounded-md hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={4}
              value={jobDescriptionInput}
              onChange={(e) => setJobDescriptionInput(e.target.value)}
              placeholder="Paste job description requirements, qualifications, and role responsibilities here..."
              className="w-full text-xs font-mono border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />

            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={handleMatchJobDescription}
                disabled={!jobDescriptionInput.trim() || isMatchingJob}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {isMatchingJob ? "Analyzing..." : "Analyze Match"}
              </button>

              {jobMatchResult && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <span>Job Match Compatibility:</span>
                  <span className="text-sm font-extrabold text-emerald-700">{jobMatchResult.matchScore} / 100</span>
                </div>
              )}
            </div>

            {jobMatchResult && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                {jobMatchResult.skillsFound.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Matched Skills & Keywords ({jobMatchResult.skillsFound.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {jobMatchResult.skillsFound.map((kw, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          ✓ {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {jobMatchResult.skillsMissing.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Missing Qualifications Found in Posting ({jobMatchResult.skillsMissing.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {jobMatchResult.skillsMissing.map((kw, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          + {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {jobMatchResult.recommendations.map((rec, i) => (
                  <p key={i} className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    💡 <span className="font-medium">{rec}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

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

          {/* ATS Resume Score & Status Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                ATS Resume Score
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-slate-900">
                  {validationResult.atsScore}/100
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    validationResult.atsScore >= 85
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : validationResult.atsScore >= 70
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : validationResult.atsScore >= 50
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {validationResult.scoreLabel}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  validationResult.atsScore >= 85
                    ? "bg-emerald-500"
                    : validationResult.atsScore >= 70
                    ? "bg-blue-500"
                    : validationResult.atsScore >= 50
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${validationResult.atsScore}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">
                {validationResult.recommendations.length > 0 ? (
                  <button
                    onClick={() => {
                      setMobileWorkflow("ats");
                      setShowReorderPanel(true);
                    }}
                    className="text-amber-700 font-semibold hover:underline text-left"
                  >
                    {validationResult.recommendations.length} action(s) to improve
                  </button>
                ) : (
                  <span className="text-emerald-700 font-semibold">Fully ATS-optimized</span>
                )}
              </span>
              <span className="text-slate-500">
                {validationResult.checks.filter((c) => c.passed).length}/{validationResult.checks.length} checks
              </span>
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
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Select Professional Template
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Data is preserved automatically across templates
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSampleResume}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Preview this template with realistic completed sample resume data"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Preview with Sample Data
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {availableTemplates.map((tmpl) => {
              const isSelected = activeVersion.template === tmpl.id;
              const badge = tmpl.badges?.[0] || (tmpl.isPro ? "PRO" : tmpl.category);
              return (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    updateActiveVersion((v) => ({ ...v, template: tmpl.id }));
                    if (!profile?.fullName?.trim()) {
                      setProfile(createSampleProfile());
                    }
                  }}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <span className="text-xs font-bold text-slate-900 truncate">{tmpl.name}</span>
                    <span className="text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                      {badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{tmpl.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sample Profile Active Notice Banner */}
        {isSampleProfile(profile) && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-amber-950">
                    You're viewing sample information
                  </h4>
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                    Alex Johnson Demo
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  This realistic sample demonstrates layout, spacing, and typography. Ready to add your own experience?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={handleReplaceWithMyInfo}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Replace with My Information
              </button>
              <button
                onClick={() => {
                  if (profile) {
                    updateProfile((p) => ({ ...p, isSample: false }));
                    setNotice("Watermark cleared. You can edit this draft directly.");
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                title="Keep sample text as initial template draft"
              >
                Edit Sample
              </button>
            </div>
          </div>
        )}

        {/* Mobile Workflow Bar (< md screens: 320px - 767px) */}
        <div className="md:hidden bg-white rounded-xl border border-slate-200 p-1.5 mb-6 shadow-sm sticky top-16 z-20">
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => setMobileWorkflow("editor")}
              className={`min-h-[44px] px-2 py-2 text-xs font-bold rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5 ${
                mobileWorkflow === "editor"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setMobileWorkflow("preview")}
              className={`min-h-[44px] px-2 py-2 text-xs font-bold rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5 ${
                mobileWorkflow === "preview"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setMobileWorkflow("ats")}
              className={`min-h-[44px] px-2 py-2 text-xs font-bold rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5 ${
                mobileWorkflow === "ats"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black px-1 rounded bg-blue-100 text-blue-900">
                  {validationResult.atsScore}
                </span>
              </div>
              <span>ATS Score</span>
            </button>
            <button
              onClick={() => setMobileWorkflow("export")}
              className={`min-h-[44px] px-2 py-2 text-xs font-bold rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5 ${
                mobileWorkflow === "export"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <FileDown className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* MOBILE ATS SCORE VIEW (< md screens) */}
        {mobileWorkflow === "ats" && (
          <div className="md:hidden space-y-4 mb-8">
            {renderNavigatorAndAtsChecks()}
          </div>
        )}

        {/* MOBILE EXPORT VIEW (< md screens) */}
        {mobileWorkflow === "export" && (
          <div className="md:hidden bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5 mb-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Export & Print Resume</h2>
                <p className="text-xs text-slate-500">Vector PDF with ISO 32000 clickable links</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-700">
                <span>Version:</span>
                <strong className="text-slate-900">{activeVersion.name}</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Target Role:</span>
                <strong className="text-slate-900">{activeVersion.targetRole}</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>ATS Resume Score:</span>
                <strong className="text-emerald-700">{validationResult.atsScore}/100 ({validationResult.scoreLabel})</strong>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                {exporting
                  ? countdown !== null
                    ? `Downloading in ${countdown}s...`
                    : "Generating Vector PDF..."
                  : "Export PDF Now"}
              </button>

              {downloadUrl && (
                <button
                  onClick={handleManualDownloadAgain}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs border border-blue-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF Again
                </button>
              )}

              <button
                onClick={handlePrint}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                Print via Browser Dialog
              </button>
            </div>
          </div>
        )}

        {/* MOBILE PREVIEW VIEW (< md screens) */}
        {mobileWorkflow === "preview" && (
          <div className="md:hidden max-w-4xl mx-auto mb-8">
            <ResumeLivePreview
              profile={profile}
              version={activeVersion}
              onPrint={handlePrint}
              onExportPdf={handleExportPDF}
            />
          </div>
        )}

        {/* DESKTOP WORKSPACE VIEW SELECTOR (>= md screens) */}
        <div className="hidden md:flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2.5 mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Workspace View
            </span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode("edit")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === "edit"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Edit Form
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`hidden xl:inline-flex px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === "split"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Side-by-Side Live Preview
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === "preview"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Full Live Preview
            </button>
          </div>
        </div>

        {/* DESKTOP FULL PREVIEW MODE (>= md screens) */}
        {viewMode === "preview" && (
          <div className="hidden md:block max-w-4xl mx-auto mb-8">
            <ResumeLivePreview
              profile={profile}
              version={activeVersion}
              onPrint={handlePrint}
              onExportPdf={handleExportPDF}
            />
          </div>
        )}

        {/* SPLIT & EDIT MODES (Active on desktop, or on mobile when in 'editor' workflow) */}
        {((viewMode !== "preview") || (mobileWorkflow === "editor")) && (
          <div className={`grid grid-cols-1 ${viewMode === "split" ? "xl:grid-cols-12" : "lg:grid-cols-12"} gap-6 ${mobileWorkflow !== "editor" ? "hidden md:grid" : ""}`}>
            {/* Left Column in Edit Mode: Navigator & ATS Checklist */}
            {viewMode === "edit" && (
              <div className="hidden lg:block lg:col-span-4 space-y-4">
                {renderNavigatorAndAtsChecks()}
              </div>
            )}

            {/* Form Editor Card Column */}
            <div className={`${viewMode === "split" ? "xl:col-span-7 space-y-4" : "lg:col-span-8 space-y-6"}`}>
              {/* If split mode, show quick horizontal section pills & toggle for reorder */}
              {viewMode === "split" && (
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin flex-1">
                    {activeVersion.sectionOrder.map((secId) => {
                      const isEnabled = activeVersion.enabledSections[secId] ?? true;
                      return (
                        <button
                          key={secId}
                          onClick={() => setActiveTab(secId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                            activeTab === secId
                              ? "bg-blue-600 text-white shadow-xs"
                              : isEnabled
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-slate-50 text-slate-400 line-through"
                          }`}
                        >
                          {SECTION_LABELS[secId]}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setShowReorderPanel(!showReorderPanel)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      showReorderPanel
                        ? "bg-blue-50 text-blue-700 border-blue-300"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                    title="Toggle Section Order & ATS Checks"
                  >
                    {showReorderPanel ? "Hide Order" : "Reorder & ATS"}
                  </button>
                </div>
              )}

              {viewMode === "split" && showReorderPanel && (
                <div className="mb-4">
                  {renderNavigatorAndAtsChecks()}
                </div>
              )}

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
                        placeholder="e.g. Alex Johnson"
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
                        placeholder="e.g. Software Engineer"
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
                        placeholder="e.g. alex.johnson@example.com"
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
                        placeholder="e.g. +91 98765 43210"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Location</label>
                      <input
                        type="text"
                        value={profile.location}
                        onChange={(e) => updateProfile((p) => ({ ...p, location: e.target.value }))}
                        placeholder="e.g. Bengaluru, India"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">LinkedIn URL</label>
                      <input
                        type="text"
                        value={profile.linkedin || ""}
                        onChange={(e) => updateProfile((p) => ({ ...p, linkedin: e.target.value, linkedinUrl: e.target.value }))}
                        placeholder="e.g. linkedin.com/in/alexjohnson"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">GitHub URL</label>
                      <input
                        type="text"
                        value={profile.github || ""}
                        onChange={(e) => updateProfile((p) => ({ ...p, github: e.target.value, githubUrl: e.target.value }))}
                        placeholder="e.g. github.com/alexjohnson"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Portfolio / Website</label>
                      <input
                        type="text"
                        value={profile.portfolio || profile.website || ""}
                        onChange={(e) =>
                          updateProfile((p) => ({
                            ...p,
                            portfolio: e.target.value,
                            website: e.target.value,
                          }))
                        }
                        placeholder="yourportfolio.dev"
                        className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Photo & ATS Guidance Section */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                          Profile Photo (Optional)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Recommended for portfolio & creative formats. ATS-parsed applications typically prefer no photo.
                        </p>
                      </div>
                      {(profile.profileImage || profile.photoUrl) && (
                        <button
                          type="button"
                          onClick={() =>
                            updateProfile((p) => ({
                              ...p,
                              profileImage: undefined,
                              photoUrl: undefined,
                            }))
                          }
                          className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center gap-4">
                      {/* Thumbnail or Placeholder */}
                      <div className="relative w-16 h-16 rounded-full border-2 border-slate-300 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 shadow-inner">
                        {profile.profileImage || profile.photoUrl ? (
                          <img
                            src={profile.profileImage || profile.photoUrl}
                            alt={profile.fullName || "Profile"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-[200px]">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          id="photo-upload-input"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) {
                              alert("Photo size must be under 2MB.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              updateProfile((p) => ({
                                ...p,
                                profileImage: result,
                                photoUrl: result,
                              }));
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="photo-upload-input"
                            className="cursor-pointer px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
                          >
                            Upload Photo
                          </label>
                          <span className="text-[11px] text-slate-400">PNG, JPG or WebP (max 2MB)</span>
                        </div>
                      </div>
                    </div>

                    {/* Non-blocking ATS Guidance Banner if photo is present */}
                    {(profile.profileImage || profile.photoUrl) && (
                      <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/90 text-amber-900 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="font-semibold text-amber-900 flex items-center justify-between">
                            <span>ATS Photo Guidance (-5 pts in ATS Score Mode)</span>
                            <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">Non-blocking</span>
                          </div>
                          <p className="text-amber-800 leading-relaxed text-[11.5px]">
                            Applicant Tracking Systems (Workday, Greenhouse, Lever, Taleo) do not parse photos, and photos are discouraged in US/UK/EU hiring compliance to prevent unconscious bias.
                          </p>
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                // Keep photo (acknowledged)
                              }}
                              className="px-2 py-1 text-[11px] font-medium bg-white border border-amber-300 text-amber-900 rounded hover:bg-amber-100 transition-colors shadow-2xs"
                            >
                              Keep photo
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateProfile((p) => ({
                                  ...p,
                                  profileImage: undefined,
                                  photoUrl: undefined,
                                }))
                              }
                              className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                            >
                              Remove photo for 100% ATS score
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                            className="px-3 py-1 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 transition-colors shadow-xs"
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
                            className="px-3 py-1 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 transition-colors shadow-xs"
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

          {/* Right Column in Split Mode: Sticky Live Preview */}
          {viewMode === "split" && (
            <div className="xl:col-span-5">
              <div className="sticky top-6">
                <ResumeLivePreview
                  profile={profile}
                  version={activeVersion}
                  onPrint={handlePrint}
                  onExportPdf={handleExportPDF}
                />
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </main>

      {/* New Version Modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200/90">
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
