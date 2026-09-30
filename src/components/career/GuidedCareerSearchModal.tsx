"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Briefcase,
  GraduationCap,
  Layers,
  MapPin,
  Clock,
  Code,
  Check,
  Search,
} from "lucide-react";
import {
  BRANCH_TAXONOMY,
  ROLE_TAXONOMY,
  DOMAIN_TAXONOMY,
  SKILL_TAXONOMY,
  CareerProfilePreferences,
} from "@/lib/career/career-profile-service";

interface GuidedCareerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreferences: (prefs: CareerProfilePreferences) => void;
  initialPreferences?: CareerProfilePreferences | null;
}

export default function GuidedCareerSearchModal({
  isOpen,
  onClose,
  onApplyPreferences,
  initialPreferences,
}: GuidedCareerSearchModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  // Form State
  const [branch, setBranch] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [opportunityTypes, setOpportunityTypes] = useState<
    ('jobs' | 'internships' | 'training' | 'apprenticeships')[]
  >(['jobs', 'internships']);
  const [workMode, setWorkMode] = useState<'all' | 'remote' | 'hybrid' | 'onsite'>('all');
  const [location, setLocation] = useState('Any Location');
  const [experience, setExperience] = useState<'fresher' | '0-2' | '2-5' | '5+'>('fresher');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState("");

  useEffect(() => {
    if (initialPreferences) {
      if (initialPreferences.branch) setBranch(initialPreferences.branch);
      if (initialPreferences.roles) setRoles(initialPreferences.roles);
      if (initialPreferences.domains) setDomains(initialPreferences.domains);
      if (initialPreferences.opportunityTypes) setOpportunityTypes(initialPreferences.opportunityTypes);
      if (initialPreferences.workMode) setWorkMode(initialPreferences.workMode);
      if (initialPreferences.location) setLocation(initialPreferences.location);
      if (initialPreferences.experience) setExperience(initialPreferences.experience);
      if (initialPreferences.skills) setSkills(initialPreferences.skills);
    }
  }, [initialPreferences]);

  if (!isOpen) return null;

  const availableRoles = branch && ROLE_TAXONOMY[branch] ? ROLE_TAXONOMY[branch] : Object.values(ROLE_TAXONOMY).flat().slice(0, 10);

  const toggleRole = (r: string) => {
    if (roles.includes(r)) {
      setRoles(roles.filter((item) => item !== r));
    } else {
      if (roles.length < 3) {
        setRoles([...roles, r]);
      }
    }
  };

  const toggleDomain = (d: string) => {
    if (domains.includes(d)) {
      setDomains(domains.filter((item) => item !== d));
    } else {
      setDomains([...domains, d]);
    }
  };

  const toggleOppType = (t: 'jobs' | 'internships' | 'training' | 'apprenticeships') => {
    if (opportunityTypes.includes(t)) {
      if (opportunityTypes.length > 1) {
        setOpportunityTypes(opportunityTypes.filter((item) => item !== t));
      }
    } else {
      setOpportunityTypes([...opportunityTypes, t]);
    }
  };

  const toggleSkill = (s: string) => {
    if (skills.includes(s)) {
      setSkills(skills.filter((item) => item !== s));
    } else {
      if (skills.length < 8) {
        setSkills([...skills, s]);
      }
    }
  };

  const handleFinish = () => {
    const finalPrefs: CareerProfilePreferences = {
      branch,
      roles,
      domains,
      opportunityTypes,
      workMode,
      location,
      experience,
      skills,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saarvi_career_prefs', JSON.stringify(finalPrefs));
      } catch {}
    }

    // Persist to backend asynchronously
    fetch('/api/career/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPrefs),
    }).catch(() => {});

    onApplyPreferences(finalPrefs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Guided Career Discovery</h2>
              <p className="text-[11px] text-slate-500">Step {currentStep} of {totalSteps}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* STEP CONTENT */}
        <div className="min-h-[260px] flex flex-col justify-center">
          {/* STEP 1: BRANCH */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">What is your branch or discipline?</h3>
              <p className="text-xs text-slate-500">We prioritize opportunities tailored to your core background.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {BRANCH_TAXONOMY.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBranch(b)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                      branch === b
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                    }`}
                  >
                    <span className="truncate">{b}</span>
                    {branch === b && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: ROLE */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">What roles are you interested in?</h3>
              <p className="text-xs text-slate-500">Select 1 to 3 primary roles.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {availableRoles.map((r) => {
                  const isSelected = roles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                      }`}
                    >
                      <span className="truncate">{r}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: DOMAIN */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Which industry domains interest you?</h3>
              <p className="text-xs text-slate-500">Pick domains that match your career focus.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {DOMAIN_TAXONOMY.map((d) => {
                  const isSelected = domains.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDomain(d)}
                      className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                      }`}
                    >
                      <span className="line-clamp-1">{d}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: OPPORTUNITY TYPE & WORK MODE */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">What are you looking for?</h3>
                <p className="text-xs text-slate-500 mb-2">Select all opportunity types you want to discover.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'jobs', label: 'Full-Time Jobs' },
                    { key: 'internships', label: 'Internships' },
                    { key: 'training', label: 'Training & Bootcamps' },
                    { key: 'apprenticeships', label: 'Apprenticeships' },
                  ].map((t) => {
                    const isSelected = opportunityTypes.includes(t.key as any);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleOppType(t.key as any)}
                        className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : "border-slate-200 text-slate-700 bg-white"
                        }`}
                      >
                        <span>{t.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-1.5">Work Mode</h4>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {['all', 'remote', 'hybrid', 'onsite'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWorkMode(m as any)}
                      className={`p-2 rounded-lg border text-center font-semibold capitalize cursor-pointer ${
                        workMode === m
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 text-slate-700 bg-white"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: LOCATION */}
          {currentStep === 5 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Preferred Location</h3>
              <p className="text-xs text-slate-500">Specify city, state, or leave flexible.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  'Any Location',
                  'Bengaluru',
                  'Hyderabad',
                  'Pune',
                  'Mumbai',
                  'Chennai',
                  'Delhi NCR',
                  'Karnataka',
                  'Remote Only',
                ].map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`p-3 rounded-xl border text-center text-xs font-semibold cursor-pointer ${
                      location === loc
                        ? "border-blue-600 bg-blue-50 text-blue-900 font-bold"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: EXPERIENCE */}
          {currentStep === 6 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Experience Level</h3>
              <p className="text-xs text-slate-500">Target roles matching your current career stage.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { key: 'fresher', title: 'Fresher / Student', desc: 'No prior full-time experience' },
                  { key: '0-2', title: '0–2 Years', desc: 'Entry-level professional experience' },
                  { key: '2-5', title: '2–5 Years', desc: 'Mid-level industry experience' },
                  { key: '5+', title: '5+ Years', desc: 'Senior / Specialist roles' },
                ].map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => setExperience(e.key as any)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      experience === e.key
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                    }`}
                  >
                    <div className="text-xs font-bold">{e.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{e.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: SKILLS */}
          {currentStep === 7 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Highlight Your Skills</h3>
              <p className="text-xs text-slate-500">Pick up to 8 core skills to power deterministic matching.</p>
              <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                {SKILL_TAXONOMY.map((s) => {
                  const isSelected = skills.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER CONTROLS */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < totalSteps ? (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>Find Opportunities</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
