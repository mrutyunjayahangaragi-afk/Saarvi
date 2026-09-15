"use client";

import React, { useState, useMemo } from "react";
import {
  CareerProfile,
  ResumeVersion,
  ResumeTemplateId,
  ResumeSectionId,
} from "@/types/career";
import {
  FileText,
  Printer,
  FileDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export interface ResumeLivePreviewProps {
  profile: CareerProfile;
  version: ResumeVersion;
  onPrint?: () => void;
  onExportPdf?: () => void;
  className?: string;
}

export function ResumeLivePreview({
  profile,
  version,
  onPrint,
  onExportPdf,
  className = "",
}: ResumeLivePreviewProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const template: ResumeTemplateId = version.template || "classic-ats";
  const isAtsClassic = template === "classic-ats" || template === "ats-latex";
  const isModern = template === "modern-professional";
  const isExecutive = template === "executive";
  const isStudent = template === "student-clean";
  const isMinimal = template === "minimal";

  // Template accent color classes & inline styles
  const accentTextClass = isModern
    ? "text-blue-700"
    : isExecutive
    ? "text-slate-900"
    : isStudent
    ? "text-teal-700"
    : "text-slate-900";

  const dividerClass = isMinimal
    ? "hidden"
    : isAtsClassic
    ? "border-b border-slate-900 pb-0.5 mb-2"
    : isModern
    ? "border-b-2 border-blue-600 pb-1 mb-2.5"
    : isExecutive
    ? "border-b-2 border-slate-800 pb-1 mb-2.5"
    : isStudent
    ? "border-b-2 border-teal-600 pb-1 mb-2.5"
    : "border-b border-slate-300 pb-1 mb-2.5";

  const headerBorder = isMinimal
    ? "hidden"
    : isAtsClassic
    ? "border-b border-slate-400 pb-2 mb-3"
    : isModern
    ? "border-b-2 border-blue-600 pb-2 mb-4"
    : isExecutive
    ? "border-b-2 border-slate-800 pb-2 mb-4"
    : isStudent
    ? "border-b-2 border-teal-600 pb-2 mb-4"
    : "border-b border-slate-300 pb-2 mb-4";

  // Contact items
  interface PreviewContactItem {
    label: string;
    url?: string;
    isLink?: boolean;
  }

  const contactItems: PreviewContactItem[] = useMemo(() => {
    const list: PreviewContactItem[] = [];
    if (profile.email) {
      list.push({ label: profile.email, url: `mailto:${profile.email}`, isLink: true });
    }
    if (profile.phone) {
      list.push({ label: profile.phone, url: `tel:${profile.phone}`, isLink: true });
    }
    if (profile.location && !isAtsClassic) {
      list.push({ label: profile.location });
    }
    if (profile.linkedin) {
      const url = profile.linkedin.startsWith("http") ? profile.linkedin : `https://${profile.linkedin}`;
      list.push({ label: "LinkedIn", url, isLink: true });
    }
    if (profile.github) {
      const url = profile.github.startsWith("http") ? profile.github : `https://${profile.github}`;
      list.push({ label: "GitHub", url, isLink: true });
    }
    const portfolioUrl = profile.portfolio || profile.website;
    if (portfolioUrl) {
      const url = portfolioUrl.startsWith("http") ? portfolioUrl : `https://${portfolioUrl}`;
      list.push({ label: "Portfolio", url, isLink: true });
    }
    if (profile.portfolio && profile.website && profile.portfolio !== profile.website) {
      const url = profile.website.startsWith("http") ? profile.website : `https://${profile.website}`;
      list.push({ label: "Website", url, isLink: true });
    }
    return list;
  }, [profile, isAtsClassic]);

  // Handle zoom
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 140));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 60));
  const handleResetZoom = () => setZoomLevel(100);

  return (
    <div className={`flex flex-col bg-slate-100 rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Top Preview Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live A4 Preview</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200 capitalize">
            {isAtsClassic ? "ATS Classic" : template.replace("-", " ")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-slate-600">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 60}
              className="p-1 rounded hover:bg-white hover:text-slate-900 disabled:opacity-40 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-0.5 text-[11px] font-mono hover:bg-white hover:text-slate-900 rounded transition-colors"
              title="Reset Zoom"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 140}
              className="p-1 rounded hover:bg-white hover:text-slate-900 disabled:opacity-40 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {onPrint && (
            <button
              onClick={onPrint}
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
              title="Print resume"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Print
            </button>
          )}

          {onExportPdf && (
            <button
              onClick={onExportPdf}
              className="inline-flex items-center px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
              title="Export PDF"
            >
              <FileDown className="w-3.5 h-3.5 mr-1" />
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* Main Preview Container with Zoom Canvas */}
      <div className="p-4 sm:p-8 flex justify-center overflow-auto max-h-[850px]">
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease-out",
          }}
          className="w-full max-w-[720px]"
        >
          {/* Realistic A4 Paper Sheet */}
          <div
            className="bg-white text-slate-900 shadow-2xl ring-1 ring-slate-900/10 rounded-sm p-8 sm:p-10 font-sans min-h-[1020px] transition-all"
            style={{
              fontSize: "12px",
              lineHeight: "1.45",
            }}
          >
            {/* Header: Name & Title */}
            <div className={headerBorder}>
              {isAtsClassic ? (
                <div className="text-center">
                  <h1 className="font-bold tracking-normal uppercase text-xl sm:text-2xl text-slate-900">
                    {profile.fullName || "Your Name"}
                  </h1>

                  {(profile.professionalTitle || version.targetRole || profile.location) && (
                    <p className="text-xs font-medium text-slate-600 mt-1">
                      {[profile.professionalTitle || version.targetRole, profile.location].filter(Boolean).join("  |  ")}
                    </p>
                  )}

                  {/* Contact line */}
                  {contactItems.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-slate-700 mt-2">
                      {contactItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-slate-400">|</span>}
                          {item.isLink && item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-900 hover:text-blue-700 hover:underline font-medium transition-colors"
                            >
                              {item.label}
                            </a>
                          ) : (
                            <span>{item.label}</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h1
                        className={`font-bold tracking-tight uppercase ${
                          isExecutive ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
                        } ${accentTextClass}`}
                      >
                        {profile.fullName || "Your Name"}
                      </h1>

                      {(profile.professionalTitle || version.targetRole) && (
                        <p className="text-xs font-medium text-slate-500 italic mt-0.5">
                          {profile.professionalTitle || version.targetRole}
                        </p>
                      )}
                    </div>

                    {(profile.profileImage || profile.photoUrl) && (
                      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-slate-300 overflow-hidden shadow-xs">
                        <img
                          src={profile.profileImage || profile.photoUrl}
                          alt={profile.fullName || "Profile"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Contact line */}
                  {contactItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 mt-2">
                      {contactItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-slate-300">•</span>}
                          {item.isLink && item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5 transition-colors font-medium"
                            >
                              {item.label}
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </a>
                          ) : (
                            <span>{item.label}</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dynamic Sections by sectionOrder */}
            <div className="space-y-4">
              {version.sectionOrder.map((sectionId) => {
                if (!version.enabledSections[sectionId]) return null;

                switch (sectionId) {
                  case "summary": {
                    const summary = (version.summaryOverride || profile.summary || "").trim();
                    if (!summary) return null;
                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Professional Summary
                          </h2>
                        </div>
                        <p className="text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {summary}
                        </p>
                      </section>
                    );
                  }

                  case "education": {
                    const activeEdu = profile.education.filter(
                      (e) => version.selectedEducationIds.length === 0 || version.selectedEducationIds.includes(e.id)
                    );
                    if (activeEdu.length === 0) return null;
                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Education
                          </h2>
                        </div>
                        <div className="space-y-2.5">
                          {activeEdu.map((edu) => (
                            <div key={edu.id}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-bold text-slate-900 text-[12px]">{edu.institution}</span>
                                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                  {edu.startDate} – {edu.endDate || (edu.current ? "Present" : "")}
                                </span>
                              </div>
                              <div className="text-[11.5px] text-slate-700">
                                <span>
                                  {edu.degree} in {edu.fieldOfStudy}
                                </span>
                                {edu.gpa && <span className="text-slate-500"> • GPA/CGPA: {edu.gpa}</span>}
                                {edu.scheme && <span className="text-slate-500"> • {edu.scheme}</span>}
                              </div>
                              {edu.highlights && edu.highlights.length > 0 && (
                                <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1 space-y-0.5 pl-1">
                                  {edu.highlights.map((h, hIdx) => (
                                    <li key={hIdx}>{h}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  case "skills": {
                    const activeSkills = profile.skills.filter(
                      (s) => version.selectedSkillIds.length === 0 || version.selectedSkillIds.includes(s.id)
                    );
                    if (activeSkills.length === 0) return null;

                    // Group by category
                    const grouped: Record<string, string[]> = {};
                    for (const sk of activeSkills) {
                      const cat = sk.category || "General";
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(sk.name);
                    }

                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Technical Skills
                          </h2>
                        </div>
                        <div className="space-y-1 text-[11.5px]">
                          {Object.entries(grouped).map(([category, items]) => (
                            <div key={category} className="flex items-baseline gap-1.5 leading-snug">
                              <span className="font-bold text-slate-900 whitespace-nowrap">{category}:</span>
                              <span className="text-slate-700">{items.join(", ")}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  case "experience": {
                    const activeExp = profile.experience.filter(
                      (e) => version.selectedExperienceIds.length === 0 || version.selectedExperienceIds.includes(e.id)
                    );
                    if (activeExp.length === 0) return null;

                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Experience & Internships
                          </h2>
                        </div>
                        <div className="space-y-3">
                          {activeExp.map((exp) => (
                            <div key={exp.id}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-bold text-slate-900 text-[12px]">{exp.role}</span>
                                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                  {exp.startDate} – {exp.endDate || (exp.current ? "Present" : "")}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 italic mb-1">
                                {exp.company}
                                {exp.location && ` • ${exp.location}`}
                                {exp.type && ` (${exp.type})`}
                              </div>
                              {exp.bullets && exp.bullets.length > 0 && (
                                <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1 leading-relaxed">
                                  {exp.bullets.map((b, bIdx) => (
                                    <li key={bIdx}>{b}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  case "projects": {
                    const activeProj = profile.projects.filter(
                      (p) => version.selectedProjectIds.length === 0 || version.selectedProjectIds.includes(p.id)
                    );
                    if (activeProj.length === 0) return null;

                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Technical Projects
                          </h2>
                        </div>
                        <div className="space-y-3">
                          {activeProj.map((proj) => {
                            const link = proj.liveUrl || proj.githubUrl || proj.role || "";
                            return (
                              <div key={proj.id}>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="font-bold text-slate-900 text-[12px]">{proj.title}</span>
                                  <div className="flex items-center gap-2 text-[11px]">
                                    {proj.role && <span className="text-slate-500 italic">{proj.role}</span>}
                                    {proj.liveUrl && (
                                      <a
                                        href={proj.liveUrl.startsWith("http") ? proj.liveUrl : `https://${proj.liveUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5 font-medium"
                                      >
                                        Live Demo <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                      </a>
                                    )}
                                    {proj.githubUrl && (
                                      <a
                                        href={proj.githubUrl.startsWith("http") ? proj.githubUrl : `https://${proj.githubUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5 font-medium"
                                      >
                                        GitHub <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {proj.technologies && proj.technologies.length > 0 && (
                                  <div className="text-[11px] text-slate-500 italic mb-1">
                                    Technologies: {proj.technologies.join(", ")}
                                  </div>
                                )}
                                {proj.highlights && proj.highlights.length > 0 && (
                                  <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1 leading-relaxed">
                                    {proj.highlights.map((h, hIdx) => (
                                      <li key={hIdx}>{h}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  }

                  case "certifications": {
                    const activeCerts = profile.certifications.filter(
                      (c) => version.selectedCertificationIds.length === 0 || version.selectedCertificationIds.includes(c.id)
                    );
                    if (activeCerts.length === 0) return null;

                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Certifications
                          </h2>
                        </div>
                        <div className="space-y-1.5">
                          {activeCerts.map((cert) => (
                            <div key={cert.id} className="flex items-baseline justify-between gap-2 text-[11.5px]">
                              <span className="text-slate-800">
                                • <strong className="font-semibold">{cert.name}</strong> — {cert.issuer}
                              </span>
                              {cert.date && <span className="text-[11px] text-slate-500 whitespace-nowrap">{cert.date}</span>}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  case "hackathons": {
                    const activeHacks = profile.hackathons.filter(
                      (h) => version.selectedHackathonIds.length === 0 || version.selectedHackathonIds.includes(h.id)
                    );
                    if (activeHacks.length === 0) return null;

                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Hackathons & Competitions
                          </h2>
                        </div>
                        <div className="space-y-2">
                          {activeHacks.map((hack) => (
                            <div key={hack.id}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-bold text-slate-900 text-[11.5px]">
                                  {hack.title} [{hack.outcome}]
                                  {hack.projectTitle && ` • ${hack.projectTitle}`}
                                </span>
                                {hack.date && (
                                  <span className="text-[11px] text-slate-500 whitespace-nowrap">{hack.date}</span>
                                )}
                              </div>
                              {hack.technologies && hack.technologies.length > 0 && (
                                <div className="text-[11px] text-slate-500 pl-2">
                                  Technologies: {hack.technologies.join(", ")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  case "achievements": {
                    const activeAch = profile.achievements.filter(
                      (a) => version.selectedAchievementIds.length === 0 || version.selectedAchievementIds.includes(a.id)
                    );
                    if (activeAch.length === 0) return null;

                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Honors & Achievements
                          </h2>
                        </div>
                        <div className="space-y-1.5 text-[11.5px]">
                          {activeAch.map((ach) => (
                            <div key={ach.id} className="text-slate-800">
                              • <strong className="font-semibold">{ach.title}</strong>
                              {ach.issuer && ` (${ach.issuer})`}
                              {ach.description && ` — ${ach.description}`}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  case "leadership": {
                    if (!profile.leadership || profile.leadership.length === 0) return null;
                    return (
                      <section key={sectionId}>
                        <div className={dividerClass}>
                          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${accentTextClass}`}>
                            Leadership & Extracurricular
                          </h2>
                        </div>
                        <div className="space-y-2">
                          {profile.leadership.map((lead) => (
                            <div key={lead.id}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-bold text-slate-900 text-[11.5px]">
                                  {lead.title} — {lead.organization}
                                </span>
                                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                                  {lead.startDate} – {lead.endDate || (lead.current ? "Present" : "")}
                                </span>
                              </div>
                              {lead.description && (
                                <p className="text-[11px] text-slate-700 pl-2 mt-0.5">{lead.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  default:
                    return null;
                }
              })}
            </div>

            {/* Bottom Page Indicator Footer */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 select-none">
              <span>Standard A4 Document Format</span>
              <span>100% Private • Local-First Storage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
