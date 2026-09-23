"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Opportunity, OpportunityCategory } from "@/lib/opportunities/types";
import { CareerProfile, ResumeVersion } from "@/types/career";
import { careerService } from "@/lib/services/careerService";
import {
  calculateOpportunityMatch,
  OpportunityMatchReport,
} from "@/lib/opportunities/matching-engine";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import {
  Briefcase,
  Search,
  Sparkles,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Bookmark,
  Check,
  Filter,
  X,
  ChevronRight,
  Award,
  Zap,
} from "lucide-react";

type FeedTab = "ALL" | "RECOMMENDED" | "INTERNSHIPS" | "FRESHER" | "CLOSING_SOON" | "SAVED";

export default function CareerOpportunitiesPage() {
  const [activeTab, setActiveTab] = useState<FeedTab>("ALL");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string | null>(null);

  // Candidate Profile for Matching
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [savedOppIds, setSavedOppIds] = useState<Set<string>>(new Set());
  const [appliedOppIds, setAppliedOppIds] = useState<Set<string>>(new Set());

  // Match Modal State
  const [selectedOppForMatch, setSelectedOppForMatch] = useState<{
    opp: Opportunity;
    report: OpportunityMatchReport;
  } | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  // Load Profile & Applications
  useEffect(() => {
    async function loadCandidate() {
      try {
        const [prof, apps] = await Promise.all([
          careerService.getOrCreateProfile(),
          academicStorage.getAllJobApplications().catch(() => []),
        ]);
        setProfile(prof);

        const applied = new Set<string>();
        const saved = new Set<string>();
        for (const app of apps) {
          if (app.status === "SAVED") saved.add(app.jobUrl || app.id);
          else applied.add(app.jobUrl || app.id);
        }
        setAppliedOppIds(applied);
        setSavedOppIds(saved);
      } catch (err) {
        console.warn("Could not load candidate profile:", err);
      }
    }
    loadCandidate();
  }, []);

  // Load Opportunities from internal API
  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (remoteOnly) params.set("remoteOnly", "true");
      if (selectedSkillFilter) params.set("skills", selectedSkillFilter);

      const res = await fetch(`/api/opportunities?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load opportunities:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, remoteOnly, selectedSkillFilter]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Compute matches for all items if profile is present
  const matchMap = useMemo(() => {
    const map = new Map<string, OpportunityMatchReport>();
    if (!profile) return map;

    for (const opp of opportunities) {
      const rep = calculateOpportunityMatch(profile, opp);
      map.set(opp.id, rep);
    }
    return map;
  }, [profile, opportunities]);

  // Filter items by FeedTab
  const displayedOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      const match = matchMap.get(opp.id);

      if (activeTab === "RECOMMENDED") {
        return match && match.overallMatchScore >= 75;
      }
      if (activeTab === "INTERNSHIPS") {
        return opp.isInternship || opp.category === "internship";
      }
      if (activeTab === "FRESHER") {
        return opp.experienceLevel === "fresher" && !opp.isInternship;
      }
      if (activeTab === "CLOSING_SOON") {
        if (!opp.applicationDeadline) return false;
        const diffMs = new Date(opp.applicationDeadline).getTime() - Date.now();
        return diffMs > 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
      }
      if (activeTab === "SAVED") {
        return savedOppIds.has(opp.id) || savedOppIds.has(opp.applyUrl);
      }
      return true;
    });
  }, [opportunities, activeTab, matchMap, savedOppIds]);

  // Action: Track Application
  const handleTrackApplication = async (opp: Opportunity) => {
    try {
      await academicStorage.saveJobApplication({
        id: `app_${opp.id}`,
        company: opp.companyName,
        role: opp.title,
        location: opp.location,
        jobUrl: opp.applyUrl,
        applicationDate: new Date().toISOString().split("T")[0],
        deadline: opp.applicationDeadline || undefined,
        status: "SAVED",
        priority: "high",
        notes: `Discovered on Saarvi via ${opp.source}`,
        events: [
          {
            id: `ev_${Date.now()}`,
            status: "SAVED",
            date: new Date().toISOString().split("T")[0],
            notes: "Saved to private Application Tracker",
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSavedOppIds((prev) => new Set([...prev, opp.id, opp.applyUrl]));
      setNotice(`Saved "${opp.title}" to your private Application Tracker.`);
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice("Failed to save application to local storage.");
    }
  };

  const handleOpenMatchModal = (opp: Opportunity) => {
    if (!profile) return;
    const report = matchMap.get(opp.id) || calculateOpportunityMatch(profile, opp);
    setSelectedOppForMatch({ opp, report });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <Link href="/student" className="hover:text-blue-600">Career Hub</Link>
              <span>/</span>
              <span className="text-blue-600">Opportunity Discovery</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Verified Opportunities
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Real internships and fresher jobs discovered from verified sources. Zero fake listings.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
            >
              <Search className="w-3.5 h-3.5" />
              Live External Search
            </Link>
            <Link
              href="/student/applications"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Application Tracker
            </Link>
          </div>
        </div>

        {/* Real-Time Live Search Banner */}
        <div className="p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Looking for Real-Time External Jobs & Internships?</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Search thousands of live employer openings worldwide with our high-speed SerpApi discovery engine & resume matcher.
              </p>
            </div>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition sm:flex-shrink-0"
          >
            <span>Open Jobs & Internships</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {notice && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-blue-500 hover:text-blue-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/80">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role, company (e.g. Google, Microsoft), or tech stack (React, Python)..."
              className="w-full text-xs sm:text-sm bg-transparent border-none focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              Remote Only
            </label>
          </div>
        </div>

        {/* Feed Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none text-xs font-bold">
          {(
            [
              { key: "ALL", label: "All Verified Jobs" },
              { key: "RECOMMENDED", label: "Recommended For You", badge: "Match >= 75%" },
              { key: "INTERNSHIPS", label: "Internships" },
              { key: "FRESHER", label: "Fresher & Graduate Roles" },
              { key: "CLOSING_SOON", label: "Closing Soon (< 7d)" },
              { key: "SAVED", label: "Saved for Later" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              {"badge" in tab && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Opportunities Feed List */}
        <div className="space-y-4">
          {displayedOpportunities.map((opp) => {
            const match = matchMap.get(opp.id);
            const isSaved = savedOppIds.has(opp.id) || savedOppIds.has(opp.applyUrl);
            const isApplied = appliedOppIds.has(opp.id) || appliedOppIds.has(opp.applyUrl);

            return (
              <div
                key={opp.id}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 sm:p-6 shadow-xs transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                        {opp.companyName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Verified by Saarvi
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {opp.category}
                      </span>
                      {opp.remoteType === "remote" && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Remote
                        </span>
                      )}
                    </div>

                    <Link href={`/jobs/${opp.id}`}>
                      <h3 className="text-lg font-bold text-slate-900 hover:text-blue-600 transition">
                        {opp.title}
                      </h3>
                    </Link>

                    <p className="text-xs text-slate-500">
                      {opp.location} • {opp.employmentType} • Experience: {opp.experienceLevel}
                    </p>
                  </div>

                  {/* Match Score Badge & Quick CTA */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                    {match ? (
                      <button
                        onClick={() => handleOpenMatchModal(opp)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
                          match.overallMatchScore >= 80
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : match.overallMatchScore >= 60
                            ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                        }`}
                        title="Click to view explainable 7-factor match breakdown"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{match.overallMatchScore}% Resume Match</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenMatchModal(opp)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Match My Resume
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {opp.description}
                </p>

                {/* Skills tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {opp.skills.map((skill) => {
                    const isMatched = match?.matchedSkills.includes(skill);
                    return (
                      <span
                        key={skill}
                        className={`text-xs px-2.5 py-0.5 rounded-md font-medium ${
                          isMatched
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : "bg-slate-50 border border-slate-200 text-slate-600"
                        }`}
                      >
                        {isMatched ? `✓ ${skill}` : skill}
                      </span>
                    );
                  })}
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="text-[11px] text-slate-500">
                    Source: <span className="font-semibold text-slate-700">{opp.source.replace(/_/g, " ")}</span>
                    {opp.applicationDeadline && (
                      <span className="ml-3 font-medium text-amber-700">
                        Closing: {opp.applicationDeadline}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTrackApplication(opp)}
                      disabled={isSaved || isApplied}
                      className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition border ${
                        isApplied
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : isSaved
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {isApplied ? "Applied ✓" : isSaved ? "Tracked ✓" : "Track Application"}
                    </button>

                    <a
                      href={opp.applyUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="px-4 py-1.5 font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <span>Apply on Official Site</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}

          {displayedOpportunities.length === 0 && !loading && (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl text-slate-400 space-y-2">
              <Briefcase className="w-10 h-10 mx-auto opacity-40 text-slate-500" />
              <h3 className="text-base font-bold text-slate-800">
                No verified opportunities match your current filter.
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Saarvi strictly displays administrator-verified listings and official opportunities. Check back shortly as newly verified listings are approved.
              </p>
              <button
                onClick={() => { setActiveTab("ALL"); setSearchQuery(""); setRemoteOnly(false); }}
                className="mt-2 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 7-Factor Explainable Match Modal */}
      {selectedOppForMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Explainable Match Breakdown
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedOppForMatch.report.overallMatchScore}% Resume Match
                </h3>
              </div>
              <button
                onClick={() => setSelectedOppForMatch(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Match score calculated deterministically for <strong>{selectedOppForMatch.opp.title}</strong> at <strong>{selectedOppForMatch.opp.companyName}</strong>.
            </div>

            {/* 7 Factor Progress Bars */}
            <div className="space-y-2">
              {selectedOppForMatch.report.factors.map((f) => (
                <div key={f.name} className="text-xs">
                  <div className="flex items-center justify-between text-slate-700 mb-1">
                    <span>{f.name}</span>
                    <span className="font-bold text-slate-900">{f.earned} / {f.weight} pts</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${f.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Matched vs Missing Skills */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <div>
                <span className="font-bold text-emerald-700">✓ Detected Skills: </span>
                <span className="text-slate-700">
                  {selectedOppForMatch.report.matchedSkills.join(", ") || "None"}
                </span>
              </div>
              {selectedOppForMatch.report.missingSkills.length > 0 && (
                <div>
                  <span className="font-bold text-amber-700">• Potential Skill Gaps: </span>
                  <span className="text-slate-700">
                    {selectedOppForMatch.report.missingSkills.join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedOppForMatch(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Close
              </button>
              <a
                href={selectedOppForMatch.opp.applyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                <span>Apply on Official Site</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
