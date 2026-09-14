"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { careerService } from "@/lib/services/careerService";
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Plus,
  X,
  Copy,
  Check,
  Award,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BookOpen,
} from "lucide-react";

const AVAILABLE_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "DevOps Engineer",
  "Mobile Developer",
];

const PRESET_SKILLS = [
  "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python",
  "SQL", "PostgreSQL", "MongoDB", "Git", "Docker", "REST APIs",
  "Data Structures", "Algorithms", "AWS", "Linux", "Tailwind CSS",
];

export default function SkillGapPage() {
  const [selectedRole, setSelectedRole] = useState("Software Engineer");
  const [skills, setSkills] = useState<string[]>([
    "JavaScript",
    "React",
    "Git",
    "HTML",
    "CSS",
  ]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [copied, setCopied] = useState(false);

  // Load from local profile if available
  useEffect(() => {
    careerService.getOrCreateProfile().then((profile) => {
      if (profile.skills && profile.skills.length > 0) {
        const profileSkillNames = profile.skills.map((s) => s.name.trim()).filter(Boolean);
        if (profileSkillNames.length > 0) {
          setSkills((prev) => Array.from(new Set([...prev, ...profileSkillNames])));
        }
      }
    }).catch(() => {});
  }, []);

  const analysis = useMemo(() => {
    return careerService.analyzeSkillGap(selectedRole, skills);
  }, [selectedRole, skills]);

  const handleAddSkill = (skillToAdd?: string) => {
    const s = (skillToAdd || newSkillInput).trim();
    if (!s) return;
    if (!skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
      setSkills([...skills, s]);
    }
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase()));
  };

  const handleCopySummary = () => {
    const totalReq = analysis.matchedSkills.length + analysis.missingSkills.length;
    const summary = `Saarvi Skill Gap Analysis — ${selectedRole}
Match Score: ${analysis.matchPercentage}% (${analysis.matchedSkills.length} of ${totalReq} core requirements)
Matched Skills: ${analysis.matchedSkills.join(", ") || "None"}
Missing Required Skills: ${analysis.missingSkills.join(", ") || "None"}
Recommended Skills: ${analysis.optionalSkills.join(", ") || "None"}
    `.trim();
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header Breadcrumbs & Title */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
            <Link href="/student/career" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Career Suite
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">Skill Gap Analyzer</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                <TrendingUp className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                Skill Gap Analyzer
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                Benchmark your current skill set against verified tech industry roles with zero server leakage.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% Client-Side
              </span>
              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Report"}
              </button>
            </div>
          </div>
        </div>

        {/* Top Controls: Role Selection & Score Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Target Role Selector */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Target Career Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {AVAILABLE_ROLES.map((role) => {
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border transition text-left ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>

            {/* Quick Add Preset Skills */}
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Quick add popular skills:</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_SKILLS.filter((p) => !skills.some((s) => s.toLowerCase() === p.toLowerCase())).slice(0, 8).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleAddSkill(p)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Plus className="w-3 h-3" /> {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Match Score Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/40 dark:via-purple-950/20 border border-indigo-200/60 dark:border-indigo-800/60 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Target Role Readiness
                </span>
                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {analysis.matchPercentage}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({analysis.matchedSkills.length} of {analysis.matchedSkills.length + analysis.missingSkills.length} core requirements)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full transition-all duration-500 ${
                    analysis.matchPercentage >= 75
                      ? "bg-emerald-500"
                      : analysis.matchPercentage >= 50
                      ? "bg-amber-500"
                      : "bg-indigo-600"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, analysis.matchPercentage))}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
              {analysis.matchPercentage >= 80
                ? "Excellent readiness! You fulfill almost all core requirements for this position."
                : analysis.matchPercentage >= 50
                ? "Good foundation! Focus on the highlighted missing requirements to boost interview callback rates."
                : "Promising start! Add your acquired skills above or review the missing fundamentals."}
            </p>
          </div>
        </div>

        {/* Skills Management Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Your Current Skills */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between mb-3">
              <span>Your Current Skills ({skills.length})</span>
            </h2>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSkill();
              }}
              className="flex gap-2 mb-4"
            >
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                placeholder="e.g. Docker, Python..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Active Skills Badges */}
            <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto pr-1">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 group"
                >
                  {skill}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-slate-400 hover:text-rose-500 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <p className="text-xs text-slate-400 italic py-4">
                  No skills listed yet. Add what you know or click quick tags above.
                </p>
              )}
            </div>
          </div>

          {/* Center & Right Column: Gap Breakdown */}
          <div className="lg:col-span-2 space-y-5">
            {/* Matched Skills */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Matched Skills ({analysis.matchedSkills.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.matchedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                  >
                    <Check className="w-3.5 h-3.5" /> {skill}
                  </span>
                ))}
                {analysis.matchedSkills.length === 0 && (
                  <p className="text-xs text-slate-400 italic">None yet matching {selectedRole}.</p>
                )}
              </div>
            </div>

            {/* Missing Required Skills */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/70 dark:border-rose-900/50 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    High Priority Gaps (Core Requirements)
                  </h3>
                </div>
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {analysis.missingSkills.length} missing
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                These are standard baseline expectations recruiters evaluate for {selectedRole} candidates:
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.missingSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => handleAddSkill(skill)}
                    title="Click to add to your skills if you already know this"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 transition group"
                  >
                    <span>{skill}</span>
                    <Plus className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
                {analysis.missingSkills.length === 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    All core requirements fulfilled!
                  </p>
                )}
              </div>
            </div>

            {/* Optional / Recommended Bonus Skills */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Recommended Bonus Skills
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Not strictly mandatory, but give you a major competitive advantage:
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.optionalSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => handleAddSkill(skill)}
                    title="Click to add to your skills if you already know this"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition group"
                  >
                    <span>{skill}</span>
                    <Plus className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links to Resume Builder & Career Suite */}
        <div className="mt-8 p-6 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-sm">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Ready to showcase your skills?
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Update your live resume preview and generate an ATS-friendly PDF tailored for {selectedRole}.
              </p>
            </div>
          </div>
          <Link
            href="/career/resume-builder"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm inline-flex items-center gap-2 transition whitespace-nowrap"
          >
            Launch Resume Builder <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
