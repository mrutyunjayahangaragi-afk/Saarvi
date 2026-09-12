"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CoverLetterVersion, CoverLetterType } from "@/types/career";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { careerService } from "@/lib/services/careerService";
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
  ShieldCheck,
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
  return {
    id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: `${COVER_LETTER_TYPES.find((t) => t.type === type)?.label || "General"} Cover Letter`,
    type,
    fullName: userName,
    email: userEmail,
    phone: userPhone,
    location: userLoc,
    date: now.split("T")[0],
    recipientName: "Hiring Manager",
    recipientTitle: "Engineering Lead",
    companyName: "",
    companyAddress: "",
    targetRole: type === "frontend-developer" ? "Frontend Developer" : "Software Engineer",
    opening: "",
    bodyParagraph1: "",
    bodyParagraph2: "",
    skillsHighlight: "",
    closing:
      "Thank you for your time and consideration. I welcome the opportunity to discuss how my technical background, enthusiasm, and commitment to software quality align with your team's mission. I look forward to hearing from you.",
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

  // Vector PDF export via pdf-lib with 3-second countdown and single auto-download
  const handleExportPDF = async () => {
    if (!activeLetter) return;
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
        curY -= 12;
      }

      curY -= 8;
      page.drawLine({
        start: { x: margin, y: curY },
        end: { x: margin + maxWidth, y: curY },
        thickness: 0.75,
        color: rgb(0.8, 0.8, 0.8),
      });
      curY -= 20;

      // Date
      page.drawText(activeLetter.date || new Date().toLocaleDateString(), {
        x: margin,
        y: curY,
        size: 10,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      });
      curY -= 18;

      // Recipient
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
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Cover Letter Builder</h1>
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
              className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-blue-600" />
              Structured Draft Assistance
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
                onClick={handleDownloadAgain}
                className="inline-flex items-center px-3 py-2 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Download className="w-4 h-4 mr-1" />
                Download Again
              </button>
            )}
          </div>
        </div>

        {/* Top Control Bar: Version Selector & Types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cover Letter Version
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const name = prompt("Enter version name (e.g., 'Google Internship', 'Frontend Role'):");
                    if (name) handleCreateNewLetter("company-specific");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-0.5" /> New Version
                </button>
                {letters.length > 1 && (
                  <button
                    onClick={() => handleDeleteLetter(activeLetter.id)}
                    className="text-xs text-red-600 hover:text-red-700"
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
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {letters.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.companyName ? `(${l.companyName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Letter Type
            </label>
            <select
              value={activeLetter.type}
              onChange={(e) => updateActiveLetter((l) => ({ ...l, type: e.target.value as CoverLetterType }))}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {COVER_LETTER_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Template
            </label>
            <div className="flex gap-2">
              {(["classic", "modern", "minimal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateActiveLetter((l) => ({ ...l, template: t }))}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border capitalize transition-colors ${
                    activeLetter.template === t
                      ? "bg-blue-50 border-blue-600 text-blue-700 font-semibold"
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
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Cover Letter Content
            </h2>

            {/* Target Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Company Name *</label>
                <input
                  type="text"
                  value={activeLetter.companyName}
                  onChange={(e) => updateActiveLetter((l) => ({ ...l, companyName: e.target.value }))}
                  placeholder="e.g. Acme Corporation"
                  className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Role *</label>
                <input
                  type="text"
                  value={activeLetter.targetRole}
                  onChange={(e) => updateActiveLetter((l) => ({ ...l, targetRole: e.target.value }))}
                  placeholder="e.g. Software Engineering Intern"
                  className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={activeLetter.recipientName || ""}
                  onChange={(e) => updateActiveLetter((l) => ({ ...l, recipientName: e.target.value }))}
                  placeholder="e.g. Hiring Manager"
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Recipient Title</label>
                <input
                  type="text"
                  value={activeLetter.recipientTitle || ""}
                  onChange={(e) => updateActiveLetter((l) => ({ ...l, recipientTitle: e.target.value }))}
                  placeholder="e.g. Engineering Lead"
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
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
                className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Body Paragraph 1 (Skills & Experience)</label>
              <textarea
                rows={4}
                value={activeLetter.bodyParagraph1}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, bodyParagraph1: e.target.value }))}
                placeholder="Highlight your key coursework, relevant engineering projects, and technical proficiencies..."
                className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Body Paragraph 2 (Alignment & Impact)</label>
              <textarea
                rows={3}
                value={activeLetter.bodyParagraph2 || ""}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, bodyParagraph2: e.target.value }))}
                placeholder="Explain why you are enthusiastic about this specific team, problem space, or mission..."
                className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Skills Highlight Line (Optional)</label>
              <input
                type="text"
                value={activeLetter.skillsHighlight || ""}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, skillsHighlight: e.target.value }))}
                placeholder="e.g. TypeScript, React, PostgreSQL, REST APIs, Git"
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Closing Paragraph</label>
              <textarea
                rows={2}
                value={activeLetter.closing}
                onChange={(e) => updateActiveLetter((l) => ({ ...l, closing: e.target.value }))}
                className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Right Live Preview Panel */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
              Live Preview ({activeLetter.template} template)
            </span>

            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-5 text-slate-800 text-xs font-sans space-y-3 shadow-inner">
              <div className="border-b border-slate-200 pb-2">
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

      <Footer />
    </div>
  );
}
