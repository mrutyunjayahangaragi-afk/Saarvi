"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CoverLetterVersion, CoverLetterType } from "@/types/career";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { careerService } from "@/lib/services/careerService";
import {
  SAMPLE_COVER_LETTER_DATA,
  isSampleCoverLetter,
  createSampleCoverLetterData,
} from "@/lib/services/resumeSampleData";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  FileText,
  Save,
  FileDown,
  CheckCircle2,
  Sparkles,
  Building,
  User,
  Mail,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Loader2,
  ShieldCheck,
  Info,
  AlertTriangle,
  X,
  Edit3,
} from "lucide-react";

const COVER_LETTER_TYPES: Array<{ type: CoverLetterType; label: string; desc: string }> = [
  { type: "general", label: "General", desc: "Adaptable overview for various technical opportunities" },
  { type: "company-specific", label: "Company-Specific", desc: "Tailored to a specific organization and team mission" },
  { type: "internship", label: "Internship", desc: "Highlights academic coursework, potential, and project execution" },
  { type: "software-engineer", label: "Software Engineer", desc: "Emphasizes algorithms, system building, and clean code" },
  { type: "frontend-developer", label: "Frontend Developer", desc: "Showcases UI architecture, modern frameworks, and UX" },
  { type: "custom", label: "Custom", desc: "Completely open-ended structured cover letter" },
];

function createDefaultCoverLetter(
  type: CoverLetterType = "general",
  userName: string = "",
  userEmail: string = "",
  userPhone: string = "",
  userLoc: string = ""
): CoverLetterVersion {
  const now = new Date().toISOString();
  const sample = SAMPLE_COVER_LETTER_DATA;
  return {
    id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: `${COVER_LETTER_TYPES.find((t) => t.type === type)?.label || "General"} Cover Letter`,
    type,
    fullName: userName || sample.fullName,
    email: userEmail || sample.email,
    phone: userPhone || sample.phone,
    location: userLoc || sample.location,
    date: now.split("T")[0],
    recipientName: sample.recipientName,
    recipientTitle: sample.recipientTitle,
    companyName: sample.companyName,
    companyAddress: sample.companyAddress,
    targetRole: type === "frontend-developer" ? "Frontend Developer" : sample.targetRole,
    opening: sample.opening,
    bodyParagraph1: sample.bodyParagraph1,
    bodyParagraph2: sample.bodyParagraph2,
    skillsHighlight: sample.skillsHighlight,
    closing: sample.closing,
    template: "classic",
    createdAt: now,
    updatedAt: now,
  };
}

export default function CoverLetterPage() {
  const [letters, setLetters] = useState<CoverLetterVersion[]>([]);
  const [activeLetterId, setActiveLetterId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingNotice, setSavingNotice] = useState<string | null>(null);

  // PDF Export state
  const [exporting, setExporting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Sample Safety Confirmation Modal state
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);

  // Post-Export Feedback States
  const [showExportFeedback, setShowExportFeedback] = useState(false);
  const [exportFeedbackRating, setExportFeedbackRating] = useState(0);
  const [exportFeedbackComment, setExportFeedbackComment] = useState("");
  const [exportFeedbackSubmitted, setExportFeedbackSubmitted] = useState(false);
  const [exportFeedbackSubmitting, setExportFeedbackSubmitting] = useState(false);

  const handleSendExportFeedback = async () => {
    if (exportFeedbackRating < 1 || !activeLetter) return;
    setExportFeedbackSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: exportFeedbackRating,
          category: "General",
          message: exportFeedbackComment.trim() || `Rated ${exportFeedbackRating} stars for cover letter: ${activeLetter.name}`,
          toolKey: "cover_letter",
          operationId: `cover_letter_export_${activeLetter.id}_${Date.now()}`,
          pageUrl: "/student/cover-letter",
          idempotencyKey: `idem_cl_${activeLetter.id}_${Date.now()}`,
        }),
      });
      setExportFeedbackSubmitted(true);
    } catch {
      setExportFeedbackSubmitted(true);
    } finally {
      setExportFeedbackSubmitting(false);
    }
  };

  // Load stored letters & career profile
  useEffect(() => {
    async function load() {
      try {
        const profile = await careerService.getOrCreateProfile();
        let stored = await academicStorage.getAllCoverLetterVersions();

        if (stored.length === 0) {
          const initial = createDefaultCoverLetter(
            "general",
            profile.fullName,
            profile.email,
            profile.phone,
            profile.location
          );
          await academicStorage.saveCoverLetterVersion(initial);
          stored = [initial];
        }

        setLetters(stored);
        setActiveLetterId(stored[0].id);
      } catch (err) {
        console.error("Failed to load cover letters:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeLetter = useMemo(() => {
    return letters.find((l) => l.id === activeLetterId) || letters[0] || null;
  }, [letters, activeLetterId]);

  // Is active letter displaying demonstration sample data?
  const isSampleActive = useMemo(() => {
    if (!activeLetter) return false;
    return isSampleCoverLetter(activeLetter);
  }, [activeLetter]);

  const updateActiveLetter = useCallback(
    async (updater: (prev: CoverLetterVersion) => CoverLetterVersion) => {
      if (!activeLetter) return;
      const next = updater(activeLetter);
      setLetters((prev) => prev.map((l) => (l.id === next.id ? next : l)));
      await academicStorage.saveCoverLetterVersion(next);
    },
    [activeLetter]
  );

  const handleCreateNewLetter = async (type: CoverLetterType = "general") => {
    const profile = await careerService.getOrCreateProfile();
    const newLetter = createDefaultCoverLetter(
      type,
      profile.fullName,
      profile.email,
      profile.phone,
      profile.location
    );
    await academicStorage.saveCoverLetterVersion(newLetter);
    setLetters((prev) => [...prev, newLetter]);
    setActiveLetterId(newLetter.id);
    setSavingNotice(`Created new ${newLetter.name}`);
    setTimeout(() => setSavingNotice(null), 2500);
  };

  const handleDeleteLetter = async (id: string) => {
    if (letters.length <= 1) {
      alert("You must keep at least one cover letter draft.");
      return;
    }
    if (!confirm("Are you sure you want to delete this cover letter?")) return;

    await academicStorage.deleteCoverLetterVersion(id);
    const remaining = letters.filter((l) => l.id !== id);
    setLetters(remaining);
    setActiveLetterId(remaining[0].id);
    setSavingNotice("Cover letter deleted.");
    setTimeout(() => setSavingNotice(null), 2500);
  };

  // Structured content population helper (deterministic templates — NO AI)
  const handlePopulateTemplateCopy = () => {
    if (!activeLetter) return;
    const role = activeLetter.targetRole || "Software Engineer";
    const comp = activeLetter.companyName || "your team";

    const opening = `I am writing to express my enthusiastic interest in the ${role} position at ${comp}. With a rigorous academic foundation in computer science and practical experience building web systems, I am excited about the prospect of contributing to your engineering initiatives.`;

    const p1 = `Through my project work and engineering coursework, I have developed strong proficiency in modern software development, data structures, and responsive user interfaces. I take pride in authoring clean, maintainable code and solving complex technical challenges systematically.`;

    const p2 = `I thrive in collaborative environments where continuous learning and attention to detail are valued. I am particularly drawn to ${comp}'s mission and would welcome the chance to bring my problem-solving skills to your team.`;

    updateActiveLetter((l) => ({
      ...l,
      opening,
      bodyParagraph1: p1,
      bodyParagraph2: p2,
    }));
    setSavingNotice("Structured template content populated.");
    setTimeout(() => setSavingNotice(null), 2500);
  };

  // Build with this template action (replace sample personal info with user profile)
  const handleBuildWithThisTemplate = async () => {
    const profile = await careerService.getOrCreateProfile();
    updateActiveLetter((l) => ({
      ...l,
      fullName: profile.fullName || "",
      email: profile.email || "",
      phone: profile.phone || "",
      location: profile.location || "",
      companyName: "",
      recipientName: "Hiring Manager",
      recipientTitle: "Engineering Lead",
      companyAddress: "",
    }));
    setSavingNotice("Sample info cleared. Enter your details below.");
    setTimeout(() => setSavingNotice(null), 3000);
  };

  // Check safety before export
  const handleExportClick = () => {
    if (isSampleActive) {
      setSafetyModalOpen(true);
      return;
    }
    executeExportPDF();
  };

  // Vector PDF export via pdf-lib with 3-second countdown and single auto-download
  const executeExportPDF = async () => {
    if (!activeLetter) return;
    setSafetyModalOpen(false);
    setExporting(true);
    setDownloadUrl(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const { width, height } = page.getSize();

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      let curY = height - 50;
      const margin = 50;
      const maxWidth = width - margin * 2;

      const template = activeLetter.template || "classic";
      const isModern = template === "modern";
      const primaryColor = isModern ? rgb(0.12, 0.35, 0.8) : rgb(0.1, 0.1, 0.1);

      // Header: Sender
      const senderName = activeLetter.fullName || "Your Name";
      page.drawText(senderName.toUpperCase(), {
        x: margin,
        y: curY,
        size: 16,
        font: fontBold,
        color: primaryColor,
      });
      curY -= 15;

      const senderContact = [activeLetter.email, activeLetter.phone, activeLetter.location]
        .filter(Boolean)
        .join("  |  ");
      if (senderContact) {
        page.drawText(senderContact, {
          x: margin,
          y: curY,
          size: 9,
          font: fontRegular,
          color: rgb(0.3, 0.3, 0.3),
        });
        curY -= 20;
      }

      // Date
      page.drawText(activeLetter.date || new Date().toISOString().split("T")[0], {
        x: margin,
        y: curY,
        size: 9,
        font: fontRegular,
      });
      curY -= 20;

      // Recipient Block
      if (activeLetter.recipientName) {
        page.drawText(activeLetter.recipientName, { x: margin, y: curY, size: 10, font: fontBold });
        curY -= 13;
      }
      if (activeLetter.recipientTitle) {
        page.drawText(activeLetter.recipientTitle, { x: margin, y: curY, size: 9, font: fontRegular });
        curY -= 12;
      }
      if (activeLetter.companyName) {
        page.drawText(activeLetter.companyName, { x: margin, y: curY, size: 10, font: fontBold });
        curY -= 13;
      }
      if (activeLetter.companyAddress) {
        page.drawText(activeLetter.companyAddress, { x: margin, y: curY, size: 9, font: fontRegular });
        curY -= 12;
      }

      curY -= 14;

      // Salutation
      const salutation = `Dear ${activeLetter.recipientName || "Hiring Team"},`;
      page.drawText(salutation, { x: margin, y: curY, size: 10, font: fontBold });
      curY -= 16;

      // Helper for wrapping text
      function drawParagraph(text: string) {
        if (!text) return;
        const words = text.split(" ");
        let line = "";
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (fontRegular.widthOfTextAtSize(test, 10) <= maxWidth) {
            line = test;
          } else {
            page.drawText(line, { x: margin, y: curY, size: 10, font: fontRegular });
            curY -= 14;
            line = word;
          }
        }
        if (line) {
          page.drawText(line, { x: margin, y: curY, size: 10, font: fontRegular });
          curY -= 14;
        }
        curY -= 8;
      }

      drawParagraph(activeLetter.opening);
      drawParagraph(activeLetter.bodyParagraph1);
      if (activeLetter.bodyParagraph2) drawParagraph(activeLetter.bodyParagraph2);
      if (activeLetter.skillsHighlight) {
        page.drawText("Key Strengths: ", { x: margin, y: curY, size: 10, font: fontBold });
        const prefixWidth = fontBold.widthOfTextAtSize("Key Strengths: ", 10);
        page.drawText(activeLetter.skillsHighlight, {
          x: margin + prefixWidth,
          y: curY,
          size: 10,
          font: fontOblique,
        });
        curY -= 20;
      }
      drawParagraph(activeLetter.closing);

      curY -= 8;
      page.drawText("Sincerely,", { x: margin, y: curY, size: 10, font: fontRegular });
      curY -= 18;
      page.drawText(senderName, { x: margin, y: curY, size: 10, font: fontBold });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);

      // 3-second countdown -> exactly one automatic download
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) {
            clearInterval(timer);
            return null;
          }
          if (prev <= 1) {
            clearInterval(timer);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(activeLetter.fullName || "Cover_Letter").replace(/\s+/g, "_")}_${activeLetter.companyName || "Application"}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setExporting(false);
            setShowExportFeedback(true);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to generate Cover Letter PDF:", err);
      alert("Failed to export PDF.");
      setExporting(false);
    }
  };

  const handleDownloadAgain = () => {
    if (!downloadUrl || !activeLetter) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${(activeLetter.fullName || "Cover_Letter").replace(/\s+/g, "_")}_${activeLetter.companyName || "Application"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading || !activeLetter) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-600">
        Loading Cover Letter Workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      {savingNotice && (
        <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm font-medium shadow-sm transition-all">
          {savingNotice}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
          <Link href="/student/dashboard" className="hover:text-blue-600 transition-colors">
            Student Hub
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Cover Letter Builder</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Cover Letter Builder 2.0</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Local-First
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Create and maintain role-targeted cover letters stored strictly in your browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePopulateTemplateCopy}
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-blue-600" />
              Structured Draft Assistance
            </button>

            <button
              onClick={handleExportClick}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
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
                onClick={handleDownloadAgain}
                className="inline-flex items-center px-3 py-2 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 mr-1" />
                Download Again
              </button>
            )}
          </div>
        </div>

        {/* POST-EXPORT COVER LETTER FEEDBACK PROMPT (NON-BLOCKING) */}
        {showExportFeedback && (
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-xs space-y-2.5 shadow-2xs my-4 animate-in fade-in">
            {exportFeedbackSubmitted ? (
              <div className="flex items-center gap-2 text-emerald-800 font-semibold py-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Thank you! Your feedback helps us make Saarvi templates even better.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">Was this cover letter editor useful?</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setExportFeedbackRating(s)}
                        className={`p-1 cursor-pointer transition-colors text-base leading-none ${
                          exportFeedbackRating >= s ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                        }`}
                        aria-label={`Rate ${s} stars`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {exportFeedbackRating > 0 && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      placeholder="What could we improve? (Optional)"
                      value={exportFeedbackComment}
                      onChange={(e) => setExportFeedbackComment(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowExportFeedback(false)}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Not Now
                      </button>
                      <button
                        type="button"
                        disabled={exportFeedbackSubmitting}
                        onClick={handleSendExportFeedback}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        {exportFeedbackSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Send Feedback</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Sample Demonstration Banner */}
        {isSampleActive && (
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 my-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-900 block">
                  You are previewing completed demonstration sample data
                </span>
                <span className="text-[11px] text-amber-700 block mt-0.5">
                  This realistic sample demonstrates typography and spacing. Replace fields below or click &quot;Build with this template&quot; to begin editing with your own credentials.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleBuildWithThisTemplate}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Build with this template</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Control Bar: Version Selector & Types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cover Letter Version
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const name = prompt("Enter version name (e.g., 'Acme Internship', 'Frontend Role'):");
                    if (name) handleCreateNewLetter("company-specific");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold inline-flex items-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-0.5" /> New Version
                </button>
                {letters.length > 1 && (
                  <button
                    onClick={() => handleDeleteLetter(activeLetter.id)}
                    className="text-xs text-red-600 hover:text-red-700 cursor-pointer"
                    title="Delete Draft"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <select
              value={activeLetter.id}
              onChange={(e) => setActiveLetterId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {letters.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.companyName ? `(${l.companyName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Letter Type
            </label>
            <select
              value={activeLetter.type}
              onChange={(e) => updateActiveLetter((l) => ({ ...l, type: e.target.value as CoverLetterType }))}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {COVER_LETTER_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Template Design
            </label>
            <div className="flex gap-2">
              {(["classic", "modern", "minimal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateActiveLetter((l) => ({ ...l, template: t }))}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl border capitalize transition-colors cursor-pointer ${
                    activeLetter.template === t
                      ? "bg-blue-50 border-blue-600 text-blue-700 font-bold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Editor & Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form Editor */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Cover Letter Content
            </h2>

            {/* Sender Details */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Sender Information
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={activeLetter.fullName || ""}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, fullName: e.target.value }))}
                    placeholder="e.g. Alex Johnson"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Your Email</label>
                  <input
                    type="email"
                    value={activeLetter.email || ""}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, email: e.target.value }))}
                    placeholder="e.g. alex.johnson@example.com"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Your Phone</label>
                  <input
                    type="tel"
                    value={activeLetter.phone || ""}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Your Location</label>
                  <input
                    type="text"
                    value={activeLetter.location || ""}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, location: e.target.value }))}
                    placeholder="Bengaluru, India"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Target Details */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Recipient & Company Details
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={activeLetter.companyName}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, companyName: e.target.value }))}
                    placeholder="e.g. Acme Technologies"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Job Title *</label>
                  <input
                    type="text"
                    value={activeLetter.targetRole}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, targetRole: e.target.value }))}
                    placeholder="e.g. Software Engineer"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Hiring Manager</label>
                  <input
                    type="text"
                    value={activeLetter.recipientName || ""}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, recipientName: e.target.value }))}
                    placeholder="e.g. Priya Sharma"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Recipient Title</label>
                  <input
                    type="text"
                    value={activeLetter.recipientTitle || ""}
                    onChange={(e) => updateActiveLetter((l) => ({ ...l, recipientTitle: e.target.value }))}
                    placeholder="e.g. Engineering Lead"
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
              </div>
            </div>

            {/* Paragraphs */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Opening Paragraph</label>
              <textarea
                rows={3}
                value={activeLetter.opening}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, opening: e.target.value }))}
                placeholder="State the role you're applying for and why you're interested in the company..."
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Body Paragraph 1 (Skills & Experience)</label>
              <textarea
                rows={4}
                value={activeLetter.bodyParagraph1}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, bodyParagraph1: e.target.value }))}
                placeholder="Highlight your key coursework, relevant engineering projects, and technical proficiencies..."
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Body Paragraph 2 (Alignment & Impact)</label>
              <textarea
                rows={3}
                value={activeLetter.bodyParagraph2 || ""}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, bodyParagraph2: e.target.value }))}
                placeholder="Explain why you are enthusiastic about this specific team, problem space, or mission..."
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Skills Highlight Line (Optional)</label>
              <input
                type="text"
                value={activeLetter.skillsHighlight || ""}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, skillsHighlight: e.target.value }))}
                placeholder="e.g. TypeScript, React, PostgreSQL, REST APIs, Git"
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Closing Paragraph</label>
              <textarea
                rows={2}
                value={activeLetter.closing}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, closing: e.target.value }))}
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Right Live Preview Panel */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
              Live Preview ({activeLetter.template} template)
            </span>

            <div className="flex-1 bg-slate-50/70 border border-slate-200/90 rounded-2xl p-6 text-slate-800 text-xs font-sans space-y-4 shadow-xs">
              <div className="border-b border-slate-200/80 pb-3">
                <strong className="text-sm block text-slate-900">
                  {activeLetter.fullName || "Your Name"}
                </strong>
                <span className="text-[11px] text-slate-500">
                  {[activeLetter.email, activeLetter.phone, activeLetter.location].filter(Boolean).join(" • ")}
                </span>
              </div>

              <div className="text-[11px] text-slate-600">
                <span>{activeLetter.date || new Date().toISOString().split("T")[0]}</span>
                <div className="mt-2 font-medium">
                  {activeLetter.recipientName && <div>{activeLetter.recipientName}</div>}
                  {activeLetter.recipientTitle && <div>{activeLetter.recipientTitle}</div>}
                  {activeLetter.companyName && <div className="font-bold text-slate-900">{activeLetter.companyName}</div>}
                  {activeLetter.companyAddress && <div>{activeLetter.companyAddress}</div>}
                </div>
              </div>

              <p className="font-semibold text-slate-900">
                Dear {activeLetter.recipientName || "Hiring Team"},
              </p>

              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {activeLetter.opening || <span className="text-slate-400 italic">[Opening statement will appear here]</span>}
              </p>

              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {activeLetter.bodyParagraph1 || <span className="text-slate-400 italic">[First body paragraph highlighting experience]</span>}
              </p>

              {activeLetter.bodyParagraph2 && (
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {activeLetter.bodyParagraph2}
                </p>
              )}

              {activeLetter.skillsHighlight && (
                <p className="text-slate-800 font-medium">
                  Key Strengths: <span className="font-normal italic">{activeLetter.skillsHighlight}</span>
                </p>
              )}

              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {activeLetter.closing}
              </p>

              <div className="pt-2">
                <p className="text-slate-600">Sincerely,</p>
                <p className="font-bold text-slate-900 mt-1">{activeLetter.fullName || "Your Name"}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pre-Export Sample Safety Confirmation Modal */}
      {safetyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Sample Data Detected</h3>
                <span className="text-[11px] text-slate-500">Pre-Export Verification</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your cover letter appears to contain sample demonstration data (such as &quot;Alex Johnson&quot; or &quot;Acme Cloud Technologies&quot;). Would you like to edit your details or export the sample preview anyway?
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSafetyModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Edit My Details
              </button>
              <button
                type="button"
                onClick={executeExportPDF}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
              >
                Export Sample Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
