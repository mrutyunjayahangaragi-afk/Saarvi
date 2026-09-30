"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import type { JobItem, JobSortOption, JobReportReason } from "@/lib/jobs/types";
import { calculateJobMatch, extractCandidateContext } from "@/lib/jobs/matching";
import { careerService } from "@/lib/services/careerService";
import { academicStorage } from "@/lib/academic/storage/academic-db";
import { useAuth } from "@/context/AuthContext";
import { analytics } from "@/lib/analytics/tracker";
import {
  saveSearchIntent,
  getSearchIntent,
  clearSearchIntent,
  buildReturnUrlWithSearch,
} from "@/lib/jobs/search-intent";
import JobsAuthGateModal from "@/components/career/JobsAuthGateModal";
import { revealDestination } from "@/lib/ux/action-destination";
import {
  Briefcase,
  Search,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Bookmark,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Layers,
  ArrowRight,
  Flag,
  Bell,
  RefreshCw,
  Lock,
  Sliders,
  SlidersHorizontal,
  GraduationCap,
  Info,
  Calendar,
  DollarSign,
  Award,
  Palette,
  Check,
  RotateCcw,
} from "lucide-react";
import GuidedCareerSearchModal from "@/components/career/GuidedCareerSearchModal";
import TrainingOpportunityCard from "@/components/career/TrainingOpportunityCard";
import { CareerProfilePreferences } from "@/lib/career/career-profile-service";
import type { TrainingOpportunity } from "@/lib/career/training-service";
import { isJobLiveForUsers } from "@/lib/jobs/live-predicate";
import {
  CANONICAL_JOB_ROLES,
  CANONICAL_BRANCHES,
  CANONICAL_DOMAINS,
  CANONICAL_LOCATIONS,
  CANONICAL_EXPERIENCE_LEVELS,
  CANONICAL_WORK_MODES,
  CANONICAL_OPPORTUNITY_TYPES,
  CANONICAL_SKILLS,
} from "@/lib/career/career-taxonomy";
import { CareerFilterDependencyEngine } from "@/lib/career/career-dependency-engine";
import {
  resolveAdaptiveTheme,
  getStoredThemePreference,
  setStoredThemePreference,
  getStoredLastCareerSearch,
  saveStoredLastCareerSearch,
  StoredCareerSearch,
  ThemePreferenceMode,
  ThemeColors,
} from "@/lib/theme/adaptive-theme";
import SearchableSelect from "@/components/career/SearchableSelect";

type SearchState = "idle" | "auth_required" | "authenticating" | "searching" | "ready" | "empty" | "error";

const SUGGESTED_SEARCHES = [
  "Frontend internship in Bengaluru",
  "Java fresher role",
  "Remote AI internship",
  "Full-stack training",
  "Data Analyst entry-level",
  "Python developer remote",
];

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // Theme State
  const [themeMode, setThemeMode] = useState<ThemePreferenceMode>("adaptive");

  // Pre-Search Guided Requirement Selectors
  const [selectedRole, setSelectedRole] = useState(searchParams.get("role") || "");
  const [selectedBranch, setSelectedBranch] = useState(searchParams.get("branch") || "");
  const [selectedDomain, setSelectedDomain] = useState(searchParams.get("domain") || "");
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get("location") || "");
  
  // Scope / Opportunity Type
  const initialType = searchParams.get("type") || searchParams.get("category");
  const initialEmp = searchParams.get("employmentType");
  const hasUrlParams = Boolean(
    searchParams.get("role") ||
      searchParams.get("q") ||
      searchParams.get("location") ||
      searchParams.get("branch") ||
      searchParams.get("domain") ||
      searchParams.get("type") ||
      searchParams.get("category") ||
      searchParams.get("employmentType") ||
      searchParams.get("autoSearch") === "true"
  );

  const derivedInitialType =
    initialType === "internship" || initialEmp === "internship"
      ? "internship"
      : initialType === "training"
      ? "training"
      : initialType === "job" || initialEmp === "full-time"
      ? "job"
      : initialType === "any"
      ? "any"
      : hasUrlParams
      ? "any"
      : "";

  const [selectedOpportunityType, setSelectedOpportunityType] = useState<string>(derivedInitialType);
  const [selectedExperience, setSelectedExperience] = useState<string>(searchParams.get("experience") || "all");
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>(searchParams.get("workMode") || searchParams.get("remote") || "all");
  const [customQuery, setCustomQuery] = useState(searchParams.get("q") || "");

  // Progressive Disclosure: Contextual Filters
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    searchParams.get("skills") ? searchParams.get("skills")!.split(",").filter(Boolean) : []
  );
  const [duration, setDuration] = useState(searchParams.get("duration") || "all");
  const [stipend, setStipend] = useState(searchParams.get("stipend") || "all");
  const [salary, setSalary] = useState(searchParams.get("salary") || "all");
  const [employmentType, setEmploymentType] = useState(searchParams.get("employmentType") || "all");
  const [deliveryMode, setDeliveryMode] = useState(searchParams.get("deliveryMode") || "all");
  const [company, setCompany] = useState(searchParams.get("company") || "");
  const [eligibility, setEligibility] = useState(searchParams.get("eligibility") || "all");
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "all");
  const [feeType, setFeeType] = useState(searchParams.get("feeType") || "all");
  const [provider, setProvider] = useState(searchParams.get("provider") || "");

  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState<JobSortOption>((searchParams.get("sortBy") as JobSortOption) || "relevant");

  // Search Results & State Machine
  const [hasSearched, setHasSearched] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [verifiedJobs, setVerifiedJobs] = useState<JobItem[]>([]);
  const [sourceJobs, setSourceJobs] = useState<JobItem[]>([]);
  const [verifiedCount, setVerifiedCount] = useState<number>(0);
  const [sourceDiscoveryCount, setSourceDiscoveryCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [staleFallback, setStaleFallback] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [candidateProfile, setCandidateProfile] = useState<any | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);

  // Intelligence state: explainable match reasons & source notices
  const [matchReasonsMap, setMatchReasonsMap] = useState<Record<string, string[]>>({});
  const [partialFailureNotice, setPartialFailureNotice] = useState<string | null>(null);
  const [relaxationExplanation, setRelaxationExplanation] = useState<string | null>(null);

  // Return Visit Resume Banner
  const [previousSearch, setPreviousSearch] = useState<StoredCareerSearch | null>(null);

  // Auth Gate Modal State
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Modals
  const [reportingJob, setReportingJob] = useState<JobItem | null>(null);
  const [reportReason, setReportReason] = useState<JobReportReason>("MISLEADING_INFO");
  const [reportNotes, setReportNotes] = useState("");
  const [reportingSubmitting, setReportingSubmitting] = useState(false);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertFrequency, setAlertFrequency] = useState<"daily" | "weekly">("daily");

  const [selectedMatchJob, setSelectedMatchJob] = useState<{
    job: JobItem;
    match: ReturnType<typeof calculateJobMatch>;
  } | null>(null);

  // Feature Gate State
  const [featureGated, setFeatureGated] = useState<{
    status: "DISABLED" | "BETA" | "PRO_REQUIRED";
    reason: string;
    maintenanceMessage?: string;
  } | null>(null);

  // Guided Career Search & Training State
  const [careerModalOpen, setCareerModalOpen] = useState(false);
  const [careerPrefs, setCareerPrefs] = useState<CareerProfilePreferences | null>(null);
  const [trainingOpportunities, setTrainingOpportunities] = useState<TrainingOpportunity[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(false);

  // Stale request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef<number>(0);

  // 1. Resolve Active Adaptive Theme
  const activeTheme = useMemo(() => {
    return resolveAdaptiveTheme({
      opportunityType: selectedOpportunityType,
      domain: selectedDomain,
      role: selectedRole || customQuery,
      userPreference: themeMode,
    });
  }, [selectedOpportunityType, selectedDomain, selectedRole, customQuery, themeMode]);

  // 2. Evaluate Dependent Recommendations (guiding without restricting)
  const dependencies = useMemo(() => {
    return CareerFilterDependencyEngine.evaluateDependencies({
      branch: selectedBranch,
      role: selectedRole,
      domain: selectedDomain,
      opportunityType: selectedOpportunityType,
    });
  }, [selectedBranch, selectedRole, selectedDomain, selectedOpportunityType]);

  // Dynamic Intent-Driven Helpers
  const isOpportunityTypeSelected = Boolean(
    selectedOpportunityType && selectedOpportunityType !== "none"
  );

  const handleOpportunityTypeChange = (newType: string) => {
    setSelectedOpportunityType(newType);
    const label =
      newType === "job"
        ? "Job"
        : newType === "internship"
        ? "Internship"
        : newType === "training"
        ? "Training"
        : newType === "any"
        ? "Any opportunity"
        : "Unselected";
    setLiveAnnouncement(`Opportunity type changed to ${label}. Relevant filters updated.`);
  };

  const presentation = useMemo(() => {
    return CareerFilterDependencyEngine.getContextualHeadings(selectedOpportunityType);
  }, [selectedOpportunityType]);

  const roleLabel = useMemo(() => {
    return CareerFilterDependencyEngine.getRoleLabel(selectedOpportunityType);
  }, [selectedOpportunityType]);

  const domainLabel = useMemo(() => {
    return CareerFilterDependencyEngine.getDomainLabel(selectedOpportunityType);
  }, [selectedOpportunityType]);

  const activeFiltersConfig = useMemo(() => {
    const opp = (selectedOpportunityType || "any") as any;
    return CareerFilterDependencyEngine.getFiltersForOpportunity(opp);
  }, [selectedOpportunityType]);

  const searchButtonInfo = useMemo(() => {
    return CareerFilterDependencyEngine.getSearchButtonLabel({
      opportunityType: selectedOpportunityType,
      role: selectedRole,
      branch: selectedBranch,
      domain: selectedDomain,
      location: selectedLocation,
      q: customQuery,
      skills: selectedSkills,
      liveCount,
    });
  }, [selectedOpportunityType, selectedRole, selectedBranch, selectedDomain, selectedLocation, customQuery, selectedSkills, liveCount]);

  const resultsStreamHeading = useMemo(() => {
    const opp = (selectedOpportunityType || "").toLowerCase();
    const roleObj = CANONICAL_JOB_ROLES.find((r) => r.id === selectedRole);
    const roleName = roleObj ? roleObj.name : selectedRole;

    if (opp === "internship") {
      return roleName ? `Internship opportunities for ${roleName}` : "Internship Opportunities";
    }
    if (opp === "job") {
      return roleName ? `Job opportunities for ${roleName}` : "Job Opportunities";
    }
    if (opp === "training") {
      return selectedDomain ? `Training programs in ${selectedDomain}` : "Training Programs";
    }
    if (roleName) {
      return `Opportunities for ${roleName}`;
    }
    if (selectedLocation && selectedLocation !== "all" && selectedLocation !== "any-location") {
      return `Opportunities in ${selectedLocation}`;
    }
    return "Your Opportunities";
  }, [selectedOpportunityType, selectedRole, selectedDomain, selectedLocation]);

  // Fetch training opportunities
  const fetchTraining = useCallback(async () => {
    setTrainingLoading(true);
    try {
      const res = await fetch("/api/career/training");
      if (res.ok) {
        const data = await res.json();
        setTrainingOpportunities(data.items || []);
      }
    } catch {
    } finally {
      setTrainingLoading(false);
    }
  }, []);

  // Hydrate theme preference & previous search from localStorage
  useEffect(() => {
    setThemeMode(getStoredThemePreference());
    const prev = getStoredLastCareerSearch();
    if (prev && !searchParams.get("q") && !searchParams.get("role")) {
      setPreviousSearch(prev);
    }
  }, [searchParams]);

  // Hydrate Career Preferences from local storage & API
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("saarvi_career_prefs");
        if (saved) setCareerPrefs(JSON.parse(saved));
      } catch {}
    }
    fetch("/api/career/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) setCareerPrefs(data.preferences);
      })
      .catch(() => {});
  }, []);

  // Check initial Jobs feature control settings
  useEffect(() => {
    async function checkFeatureStatus() {
      try {
        const res = await fetch("/api/jobs/feature-control");
        if (res.ok) {
          const data = await res.json();
          if (data.mode === "DISABLED" || data.enabled === false) {
            setFeatureGated({
              status: "DISABLED",
              reason: "Jobs & Internships is currently unavailable.",
              maintenanceMessage: data.maintenance_message,
            });
          }
        }
      } catch {}
    }
    checkFeatureStatus();
  }, []);

  // Emit page view
  useEffect(() => {
    try {
      analytics.trackEvent({
        name: "jobs_page_view" as any,
        category: "public",
      });
    } catch {}
  }, []);

  // Load candidate profile locally for authenticated users
  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      try {
        const prof = await careerService.getOrCreateProfile();
        if (prof && prof.skills && prof.skills.length > 0) {
          setCandidateProfile(prof);
        }
      } catch {}
    }
    loadProfile();

    async function loadSaved() {
      try {
        const apps = await academicStorage.getAllJobApplications();
        const ids = new Set(apps.map((a) => a.id));
        setSavedJobIds(ids);
      } catch {}
    }
    loadSaved();
  }, [user]);

  // Execute Search Function
  const executeSearch = useCallback(
    async (overrides: Partial<{
      role: string;
      branch: string;
      domain: string;
      location: string;
      opportunityType: string;
      experience: string;
      workMode: string;
      q: string;
      skills: string[];
      sortBy: JobSortOption;
    }> = {}) => {
      if (!user) {
        saveSearchIntent({
          q: overrides.q !== undefined ? overrides.q : (overrides.role || selectedRole || customQuery),
          location: overrides.location !== undefined ? overrides.location : selectedLocation,
          experience: overrides.experience !== undefined ? overrides.experience : selectedExperience,
          remote: overrides.workMode !== undefined ? overrides.workMode : selectedWorkMode,
          employmentType: (overrides.opportunityType || selectedOpportunityType) === "internship" ? "internship" : "all",
          sortBy: overrides.sortBy !== undefined ? overrides.sortBy : sortBy,
          skills: overrides.skills !== undefined ? overrides.skills : selectedSkills,
        });
        setLoading(false);
        setSearchState("auth_required");
        setAuthGateOpen(true);
        return;
      }

      // Cancel stale request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentRequestId = ++searchRequestIdRef.current;

      setLoading(true);
      setSearchState("searching");
      setHasSearched(true);
      setError(null);

      const activeRole = overrides.role !== undefined ? overrides.role : selectedRole;
      const activeBranch = overrides.branch !== undefined ? overrides.branch : selectedBranch;
      const activeDomain = overrides.domain !== undefined ? overrides.domain : selectedDomain;
      const activeLoc = overrides.location !== undefined ? overrides.location : selectedLocation;
      const activeOpp = overrides.opportunityType !== undefined ? overrides.opportunityType : selectedOpportunityType;
      const activeExp = overrides.experience !== undefined ? overrides.experience : selectedExperience;
      const activeMode = overrides.workMode !== undefined ? overrides.workMode : selectedWorkMode;
      const activeQuery = overrides.q !== undefined ? overrides.q : customQuery;
      const activeSkills = overrides.skills !== undefined ? overrides.skills : selectedSkills;
      const activeSort = overrides.sortBy !== undefined ? overrides.sortBy : sortBy;

      // Construct normalized search query for API
      const queryParts: string[] = [];
      if (activeQuery.trim()) queryParts.push(activeQuery.trim());
      if (activeRole && !activeQuery.toLowerCase().includes(activeRole.toLowerCase())) {
        queryParts.push(activeRole);
      }
      if (activeDomain && queryParts.length === 0) {
        queryParts.push(activeDomain);
      }
      const combinedQ = queryParts.join(" ").trim();

      const params = new URLSearchParams();
      if (combinedQ) params.set("q", combinedQ);
      if (activeRole) params.set("role", activeRole);
      if (activeBranch) params.set("branch", activeBranch);
      if (activeDomain) params.set("domain", activeDomain);
      if (activeLoc && activeLoc !== "all" && activeLoc !== "any-location") {
        params.set("location", activeLoc);
      }
      if (activeOpp === "internship") {
        params.set("employmentType", "internship");
      } else if (activeOpp === "job") {
        params.set("employmentType", "full-time");
      }
      if (activeMode !== "all") params.set("remote", activeMode);
      if (activeExp !== "all") params.set("experience", activeExp);
      if (activeSort !== "relevant") params.set("sortBy", activeSort);
      if (activeSkills.length > 0) params.set("skills", activeSkills.join(","));

      // Update URL without full refresh for shareability and back/forward navigation
      const currentUrl = new URL(window.location.href);
      if (activeRole) currentUrl.searchParams.set("role", activeRole);
      else currentUrl.searchParams.delete("role");
      if (activeBranch) currentUrl.searchParams.set("branch", activeBranch);
      else currentUrl.searchParams.delete("branch");
      if (activeDomain) currentUrl.searchParams.set("domain", activeDomain);
      else currentUrl.searchParams.delete("domain");
      if (activeLoc) currentUrl.searchParams.set("location", activeLoc);
      else currentUrl.searchParams.delete("location");
      if (activeOpp !== "any") currentUrl.searchParams.set("type", activeOpp);
      else currentUrl.searchParams.delete("type");
      if (activeExp !== "all") currentUrl.searchParams.set("experience", activeExp);
      else currentUrl.searchParams.delete("experience");
      if (activeMode !== "all") currentUrl.searchParams.set("workMode", activeMode);
      else currentUrl.searchParams.delete("workMode");
      window.history.replaceState({}, "", currentUrl.toString());

      // Save harmless search criteria in localStorage for return visits
      saveStoredLastCareerSearch({
        role: activeRole,
        branch: activeBranch,
        domain: activeDomain,
        location: activeLoc,
        opportunityType: activeOpp,
        experience: activeExp,
        workMode: activeMode,
        skills: activeSkills,
      });

      // If training is chosen, fetch training endpoint
      if (activeOpp === "training") {
        await fetchTraining();
      }

      try {
        const res = await fetch(`/api/jobs/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (currentRequestId !== searchRequestIdRef.current) return;

        if (!res.ok) {
          if (res.status === 401) {
            setSearchState("auth_required");
            setAuthGateOpen(true);
            setJobs([]);
            return;
          }
          if (res.status === 403) {
            const errData = await res.json().catch(() => ({}));
            setFeatureGated({
              status:
                errData.status ||
                (errData.error?.includes("beta")
                  ? "BETA"
                  : errData.error?.includes("Pro")
                  ? "PRO_REQUIRED"
                  : "DISABLED"),
              reason: errData.error || "Jobs & Internships is currently unavailable.",
              maintenanceMessage: errData.maintenanceMessage,
            });
            setJobs([]);
            setSearchState("error");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const items: JobItem[] = data.items || [];
        setJobs(items);

        const verified = data.verifiedItems || items.filter((j: any) => j.verificationTier === "SAARVI_VERIFIED");
        const source = data.sourceItems || items.filter((j: any) => j.verificationTier === "SOURCE_DISCOVERY");
        setVerifiedJobs(verified);
        setSourceJobs(source);
        setVerifiedCount(typeof data.verifiedCount === "number" ? data.verifiedCount : verified.length);
        setSourceDiscoveryCount(
          typeof data.sourceDiscoveryCount === "number" ? data.sourceDiscoveryCount : source.length
        );

        setIsCached(Boolean(data.cached));
        setStaleFallback(Boolean(data.staleFallback));
        if (typeof data.liveCount === "number") setLiveCount(data.liveCount);
        else if (typeof data.filteredCount === "number") setLiveCount(data.filteredCount);

        if (data.matchReasonsMap) setMatchReasonsMap(data.matchReasonsMap);
        if (data.partialFailureMessage) setPartialFailureNotice(data.partialFailureMessage);
        else setPartialFailureNotice(null);
        if (data.relaxationExplanation) setRelaxationExplanation(data.relaxationExplanation);
        else setRelaxationExplanation(null);

        setSearchState(items.length > 0 ? "ready" : "empty");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError("Unable to load opportunities right now. Please retry.");
        setSearchState("error");
      } finally {
        if (currentRequestId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      user,
      selectedRole,
      selectedBranch,
      selectedDomain,
      selectedLocation,
      selectedOpportunityType,
      selectedExperience,
      selectedWorkMode,
      customQuery,
      selectedSkills,
      sortBy,
      fetchTraining,
    ]
  );

  // Restore search criteria on mount (e.g. from session storage, URL params, or return login)
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      setSearchState("idle");
      return;
    }

    const savedIntent = getSearchIntent();
    const hasUrlParams = Boolean(
      searchParams.get("role") ||
        searchParams.get("q") ||
        searchParams.get("location") ||
        searchParams.get("branch") ||
        searchParams.get("domain") ||
        searchParams.get("autoSearch") === "true"
    );

    if (savedIntent) {
      if (savedIntent.q) setCustomQuery(savedIntent.q);
      if (savedIntent.location) setSelectedLocation(savedIntent.location);
      if (savedIntent.experience) setSelectedExperience(savedIntent.experience);
      if (savedIntent.remote) setSelectedWorkMode(savedIntent.remote);
      if (savedIntent.sortBy) setSortBy(savedIntent.sortBy as JobSortOption);
      if (savedIntent.skills) setSelectedSkills(savedIntent.skills);

      clearSearchIntent();
      executeSearch({
        q: savedIntent.q,
        location: savedIntent.location,
        experience: savedIntent.experience,
        workMode: savedIntent.remote,
        skills: savedIntent.skills,
        sortBy: savedIntent.sortBy as JobSortOption,
      });
    } else if (hasUrlParams) {
      executeSearch();
    }
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Search Submission
  const handlePrimarySearch = async () => {
    const opp = (selectedOpportunityType || "").toLowerCase();
    const hasOpp = Boolean(opp && opp !== "none");
    const hasRole = Boolean(selectedRole && selectedRole !== "all");
    const hasBranch = Boolean(selectedBranch && selectedBranch !== "all");
    const hasDomain = Boolean(selectedDomain && selectedDomain !== "all");
    const hasLoc = Boolean(selectedLocation && selectedLocation !== "all" && selectedLocation !== "any-location");
    const hasExp = Boolean(selectedExperience && selectedExperience !== "all" && selectedExperience !== "any");
    const hasMode = Boolean(selectedWorkMode && selectedWorkMode !== "all" && selectedWorkMode !== "any");
    const hasQuery = Boolean(customQuery.trim());
    const hasSkills = selectedSkills.length > 0;

    const hasMeaningfulCondition =
      hasOpp || hasRole || hasBranch || hasDomain || hasLoc || hasExp || hasMode || hasQuery || hasSkills;

    if (!hasMeaningfulCondition) {
      setNotice("Choose an opportunity type or select your requirements to search.");
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    setPreviousSearch(null);
    await executeSearch();
    revealDestination({
      target: "#jobs-search-results",
      fallbackTarget: "[data-saarvi-target='search-results']",
      mode: "section",
      focus: true,
      reason: "jobs_search_submitted",
    });
  };

  // Clear all filters back to default
  const handleClearAllFilters = () => {
    setSelectedRole("");
    setSelectedBranch("");
    setSelectedDomain("");
    setSelectedLocation("");
    setSelectedOpportunityType("");
    setSelectedExperience("all");
    setSelectedWorkMode("all");
    setCustomQuery("");
    setSelectedSkills([]);
    setDuration("all");
    setStipend("all");
    setSalary("all");
    setEmploymentType("all");
    setDeliveryMode("all");
    setCompany("");
    setEligibility("all");
    setStartDate("all");
    setFeeType("all");
    setProvider("");
    setSortBy("relevant");

    // Clean URL
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = "";
    window.history.replaceState({}, "", cleanUrl.toString());

    setJobs([]);
    setHasSearched(false);
    setSearchState("idle");
  };

  // Compute matches
  const candidateContext = useMemo(() => {
    if (!candidateProfile) return null;
    return extractCandidateContext(candidateProfile);
  }, [candidateProfile]);

  const matchScoresMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateJobMatch>>();
    if (!candidateContext) return map;
    for (const job of jobs) {
      map.set(job.id, calculateJobMatch(candidateContext, job));
    }
    return map;
  }, [jobs, candidateContext]);

  // Save Job Toggle
  const handleSaveJob = async (job: JobItem) => {
    if (!user) {
      saveSearchIntent({
        q: selectedRole || customQuery,
        location: selectedLocation,
        experience: selectedExperience,
        remote: selectedWorkMode,
        sortBy,
      });
      setAuthGateOpen(true);
      return;
    }

    const isAlreadySaved = savedJobIds.has(job.id);
    const action = isAlreadySaved ? "UNSAVE" : "SAVE";

    try {
      fetch("/api/jobs/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action }),
      }).catch(() => {});

      if (isAlreadySaved) {
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
        setNotice(`Removed "${job.title}" from saved jobs.`);
      } else {
        await academicStorage.saveJobApplication({
          id: job.id,
          company: job.companyName,
          role: job.title,
          location: job.location,
          jobUrl: job.applyUrl,
          applicationDate: new Date().toISOString().split("T")[0],
          deadline: job.applicationDeadline !== "Deadline not provided" ? job.applicationDeadline : undefined,
          status: "SAVED",
          priority: "medium",
          notes: `Saved from ${job.sourceName}. Salary: ${job.salary}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          events: [
            {
              id: `evt_${Date.now()}`,
              status: "SAVED",
              date: new Date().toISOString(),
              notes: "Bookmarked in Career Tracker",
            },
          ],
        });
        setSavedJobIds((prev) => new Set([...prev, job.id]));
        setNotice(`Saved "${job.title}" to your Career Tracker.`);
      }
      setTimeout(() => setNotice(null), 3000);
    } catch {}
  };

  // Submit Safety Report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingJob) return;

    setReportingSubmitting(true);
    try {
      const res = await fetch("/api/jobs/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: reportingJob.id,
          reason: reportReason,
          notes: reportNotes,
        }),
      });

      if (res.ok) {
        setNotice("Thank you. Our Trust & Safety team has received your report.");
        setReportingJob(null);
        setReportNotes("");
      }
    } catch {
      setNotice("Unable to submit report. Please try again later.");
    } finally {
      setReportingSubmitting(false);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  // Create Job Alert
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/jobs/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: {
            role: selectedRole || customQuery || undefined,
            location: selectedLocation || undefined,
            experience: selectedExperience !== "all" ? selectedExperience : undefined,
            remote: selectedWorkMode !== "all" ? selectedWorkMode : undefined,
          },
          frequency: alertFrequency,
        }),
      });
      if (res.ok) {
        setNotice("Job alert created! You will receive updates matching your search.");
        setShowAlertModal(false);
      }
    } catch {
      setNotice("Failed to create alert. Please try again.");
    } finally {
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const returnUrl = useMemo(
    () =>
      buildReturnUrlWithSearch({
        q: selectedRole || customQuery,
        location: selectedLocation,
        experience: selectedExperience !== "all" ? selectedExperience : undefined,
        remote: selectedWorkMode !== "all" ? selectedWorkMode : undefined,
        employmentType: selectedOpportunityType === "internship" ? "internship" : undefined,
        sortBy,
      }),
    [selectedRole, customQuery, selectedLocation, selectedExperience, selectedWorkMode, selectedOpportunityType, sortBy]
  );

  // Active Applied Filters List (Only meaningful selections, never defaults like 'Any location')
  const appliedFilters = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];

    if (selectedOpportunityType && selectedOpportunityType !== "any" && selectedOpportunityType !== "none") {
      const oppLabel =
        selectedOpportunityType === "job"
          ? "Job"
          : selectedOpportunityType === "internship"
          ? "Internship"
          : selectedOpportunityType === "training"
          ? "Training"
          : selectedOpportunityType.charAt(0).toUpperCase() + selectedOpportunityType.slice(1);
      list.push({
        key: "type",
        label: oppLabel,
        onRemove: () => {
          setSelectedOpportunityType("");
          executeSearch({ opportunityType: "any" });
        },
      });
    }

    if (selectedRole && selectedRole !== "all") {
      const roleObj = CANONICAL_JOB_ROLES.find((r) => r.id === selectedRole);
      list.push({
        key: "role",
        label: roleObj ? roleObj.name : selectedRole,
        onRemove: () => {
          setSelectedRole("");
          executeSearch({ role: "" });
        },
      });
    }

    if (selectedBranch && selectedBranch !== "all") {
      const branchObj = CANONICAL_BRANCHES.find((b) => b.id === selectedBranch);
      list.push({
        key: "branch",
        label: branchObj ? branchObj.name : selectedBranch,
        onRemove: () => {
          setSelectedBranch("");
          executeSearch({ branch: "" });
        },
      });
    }

    if (selectedDomain && selectedDomain !== "all") {
      const domainObj = CANONICAL_DOMAINS.find((d) => d.id === selectedDomain);
      list.push({
        key: "domain",
        label: domainObj ? domainObj.name : selectedDomain,
        onRemove: () => {
          setSelectedDomain("");
          executeSearch({ domain: "" });
        },
      });
    }

    if (selectedLocation && selectedLocation !== "all" && selectedLocation !== "any-location") {
      list.push({
        key: "location",
        label: selectedLocation,
        onRemove: () => {
          setSelectedLocation("");
          executeSearch({ location: "" });
        },
      });
    }

    if (selectedExperience && selectedExperience !== "all" && selectedExperience !== "any") {
      list.push({
        key: "experience",
        label: selectedExperience === "fresher" ? "Fresher" : selectedExperience === "entry-level" ? "Entry-Level" : selectedExperience,
        onRemove: () => {
          setSelectedExperience("all");
          executeSearch({ experience: "all" });
        },
      });
    }

    if (selectedWorkMode && selectedWorkMode !== "all" && selectedWorkMode !== "any") {
      list.push({
        key: "workMode",
        label: selectedWorkMode.charAt(0).toUpperCase() + selectedWorkMode.slice(1),
        onRemove: () => {
          setSelectedWorkMode("all");
          executeSearch({ workMode: "all" });
        },
      });
    }

    if (customQuery.trim()) {
      list.push({
        key: "query",
        label: `"${customQuery}"`,
        onRemove: () => {
          setCustomQuery("");
          executeSearch({ q: "" });
        },
      });
    }

    for (const sk of selectedSkills) {
      list.push({
        key: `skill-${sk}`,
        label: sk,
        onRemove: () => {
          const next = selectedSkills.filter((s) => s !== sk);
          setSelectedSkills(next);
          executeSearch({ skills: next });
        },
      });
    }

    if (duration !== "all") {
      list.push({
        key: "duration",
        label: duration === "1-2-months" ? "1–2 Months" : duration === "3-6-months" ? "3–6 Months" : duration,
        onRemove: () => {
          setDuration("all");
          executeSearch();
        },
      });
    }

    if (stipend !== "all") {
      list.push({
        key: "stipend",
        label: stipend === "paid" ? "Paid Only" : stipend === "10k_plus" ? "₹10,000+/mo" : stipend === "20k_plus" ? "₹20,000+/mo" : stipend,
        onRemove: () => {
          setStipend("all");
          executeSearch();
        },
      });
    }

    if (salary !== "all") {
      list.push({
        key: "salary",
        label: salary,
        onRemove: () => {
          setSalary("all");
          executeSearch();
        },
      });
    }

    if (employmentType !== "all") {
      list.push({
        key: "employmentType",
        label: employmentType,
        onRemove: () => {
          setEmploymentType("all");
          executeSearch();
        },
      });
    }

    if (company.trim()) {
      list.push({
        key: "company",
        label: company,
        onRemove: () => {
          setCompany("");
          executeSearch();
        },
      });
    }

    return list;
  }, [
    selectedOpportunityType,
    selectedRole,
    selectedBranch,
    selectedDomain,
    selectedLocation,
    selectedExperience,
    selectedWorkMode,
    customQuery,
    selectedSkills,
    duration,
    stipend,
    salary,
    employmentType,
    company,
    executeSearch,
  ]);

  // Options for Role Select with recommendations
  const roleSelectOptions = useMemo(() => {
    return CANONICAL_JOB_ROLES.map((r) => ({
      id: r.id,
      label: r.name,
      category: r.category,
      popular: r.popular,
      recommended: dependencies.recommendedRoleIds.includes(r.id),
      aliases: r.aliases,
    }));
  }, [dependencies.recommendedRoleIds]);

  // Options for Branch Select
  const branchSelectOptions = useMemo(() => {
    return CANONICAL_BRANCHES.map((b) => ({
      id: b.id,
      label: b.name,
      category: b.category,
      popular: b.popular,
    }));
  }, []);

  // Options for Domain Select with recommendations
  const domainSelectOptions = useMemo(() => {
    return CANONICAL_DOMAINS.map((d) => ({
      id: d.id,
      label: d.name,
      category: d.category,
      popular: d.popular,
      recommended: dependencies.recommendedDomainIds.includes(d.id),
    }));
  }, [dependencies.recommendedDomainIds]);

  // Options for Location Select
  const locationSelectOptions = useMemo(() => {
    return CANONICAL_LOCATIONS.map((l) => ({
      id: l.id,
      label: l.name,
      category: l.category,
      popular: l.popular,
      aliases: l.aliases,
    }));
  }, []);

  // Count extra active filters inside "More filters"
  const extraFiltersCount =
    (selectedSkills.length > 0 ? selectedSkills.length : 0) +
    (duration !== "all" ? 1 : 0) +
    (stipend !== "all" ? 1 : 0) +
    (salary !== "all" ? 1 : 0) +
    (deliveryMode !== "all" ? 1 : 0);

  // Feature Gated Intercept
  if (featureGated && featureGated.status === "DISABLED") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">This feature is currently unavailable.</h1>
          <p className="text-sm text-slate-600 max-w-md">
            {featureGated.maintenanceMessage ||
              "Jobs & Internships is undergoing scheduled platform maintenance. Please check back later."}
          </p>
          <p className="text-xs text-slate-400">Please check back later.</p>
          <Link
            href="/tools"
            className="mt-4 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
          >
            Explore Other Tools
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Render Canonical Opportunity Card with Adaptive Accents
  const renderJobCard = (job: JobItem) => {
    const match = matchScoresMap.get(job.id);
    const isSaved = savedJobIds.has(job.id);
    const isVerified = job.verificationTier === "SAARVI_VERIFIED" || job.verifiedStatus === 'verified';

    return (
      <div
        key={job.id}
        className="group bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative"
      >
        <div className="space-y-3">
          {/* Header Row: Company Logo/Initials, Role, Badges, Save Button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {/* Company Logo or Initials Fallback */}
              <div className="shrink-0 mt-0.5">
                {job.companyLogoUrl ? (
                  <img
                    src={job.companyLogoUrl}
                    alt={job.companyName}
                    className="w-10 h-10 rounded-xl object-contain border border-slate-100 bg-white p-1"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                    {job.companyName ? job.companyName.slice(0, 2).toUpperCase() : "JB"}
                  </div>
                )}
              </div>

              <div>
                {/* Badges: Type & Trust Tier */}
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      job.isInternship
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : "bg-blue-50 text-blue-800 border border-blue-200"
                    }`}
                  >
                    {job.isInternship ? "Internship" : "Job"}
                  </span>

                  {isVerified ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                      title="Reviewed and approved for publication by Saarvi."
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Saarvi Verified</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                      title="Imported from an external job source. Verify details on the employer's official page."
                    >
                      <span>Source Listing</span>
                    </span>
                  )}

                  {job.experienceLevel === "fresher" && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Fresher
                    </span>
                  )}
                </div>

                {/* Role Title */}
                <Link
                  href={`/jobs/${job.id}`}
                  className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1"
                >
                  {job.title}
                </Link>

                {/* Company Name */}
                <div className="text-xs text-slate-500 font-medium">{job.companyName}</div>
              </div>
            </div>

            {/* Match Score & Bookmark Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {match && (
                <button
                  type="button"
                  onClick={() => setSelectedMatchJob({ job, match })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                  title="Click to view explainable ATS score breakdown"
                >
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>{match.matchScore}%</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSaveJob(job)}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isSaved ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title={isSaved ? "Saved in Tracker" : "Save Job"}
                aria-label={isSaved ? "Saved" : "Save Job"}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>

          {/* Metadata Row: Location · Work Mode · Experience · Salary */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-2.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{job.location}</span>
            </span>
            <span>·</span>
            <span className="capitalize">{job.remoteType}</span>
            {job.experienceLevel && (
              <>
                <span>·</span>
                <span className="capitalize">{job.experienceLevel}</span>
              </>
            )}
            {job.salary && job.salary !== "Salary not disclosed" && (
              <>
                <span>·</span>
                <span className="font-semibold text-slate-700">{job.salary}</span>
              </>
            )}
          </div>

          {/* Description Excerpt */}
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {job.description}
          </p>

          {/* Skills Badges */}
          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {job.skills.slice(0, 4).map((sk) => (
                <span
                  key={sk}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200/70"
                >
                  {sk}
                </span>
              ))}
              {job.skills.length > 4 && (
                <span className="text-[10px] text-slate-400 font-medium self-center">
                  +{job.skills.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Explainable Match Reasons (Requirement 38) */}
          {matchReasonsMap[job.id] && matchReasonsMap[job.id].length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="font-semibold text-slate-400">Match signals:</span>
              {matchReasonsMap[job.id].map((reason, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                >
                  ✓ {reason}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Source / Deadline & View/Apply Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            {job.applicationDeadline && job.applicationDeadline !== "Deadline not provided" ? (
              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Deadline: {job.applicationDeadline}</span>
              </span>
            ) : (
              <span>Source: {job.sourceName || "Direct"}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReportingJob(job)}
              className="p-1 text-slate-300 hover:text-rose-600 rounded transition"
              title="Report listing"
              aria-label="Report listing"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>

            <Link
              href={`/jobs/${job.id}`}
              className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              View
            </Link>

            <a
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1 shadow-2xs ${activeTheme.primary.btnClass}`}
            >
              <span>Apply</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col font-sans">
      <Navbar />

      {notice && (
        <div className="bg-blue-600 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-semibold shadow-md transition-all sticky top-16 z-40">
          {notice}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: GUIDED CAREER SEARCH HEADER WITH PRE-SEARCH SELECTORS          */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-slate-200/90 pt-8 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header Title, Supporting Text, and Theme Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                Career Search
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Find opportunities that fit you
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Choose what you&apos;re looking for and Saarvi will find relevant opportunities.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme Preference Toggle */}
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setThemeMode("adaptive");
                    setStoredThemePreference("adaptive");
                  }}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    themeMode === "adaptive"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Theme adapts intelligently to Job, Internship, or Training context"
                >
                  <Palette className="w-3 h-3 text-teal-600" />
                  <span>Adaptive</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setThemeMode("saarvi-blue");
                    setStoredThemePreference("saarvi-blue");
                  }}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    themeMode === "saarvi-blue"
                      ? "bg-white text-blue-700 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Locks visual accent to standard Saarvi Blue"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Saarvi Blue</span>
                </button>
              </div>

              <Link
                href={user ? "/student/applications" : `/login?next=${encodeURIComponent("/student/applications")}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <span>Tracker</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* RETURN VISIT CONTINUATION BANNER (Harmless Memory) */}
          {previousSearch && !hasSearched && (
            <div className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-blue-900">
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Continue previous search:</strong>{" "}
                  {previousSearch.role || "Opportunities"} {previousSearch.location ? `in ${previousSearch.location}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (previousSearch.role) setSelectedRole(previousSearch.role);
                    if (previousSearch.branch) setSelectedBranch(previousSearch.branch);
                    if (previousSearch.domain) setSelectedDomain(previousSearch.domain);
                    if (previousSearch.location) setSelectedLocation(previousSearch.location);
                    if (previousSearch.opportunityType) setSelectedOpportunityType(previousSearch.opportunityType);
                    if (previousSearch.experience) setSelectedExperience(previousSearch.experience);
                    if (previousSearch.workMode) setSelectedWorkMode(previousSearch.workMode);
                    if (previousSearch.skills) setSelectedSkills(previousSearch.skills);
                    setPreviousSearch(null);
                    executeSearch(previousSearch);
                  }}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  Use previous search
                </button>
                <button
                  type="button"
                  onClick={() => setPreviousSearch(null)}
                  className="text-slate-400 hover:text-slate-600 px-2 py-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Screen Reader Live Region for filter and context changes */}
          <div aria-live="polite" className="sr-only">
            {liveAnnouncement}
          </div>

          {/* ========================================================================= */}
          {/* GUIDED REQUIREMENTS SELECTOR PANEL                                        */}
          {/* ========================================================================= */}
          <div className="p-4 sm:p-6 bg-slate-50/90 border border-slate-200 rounded-2xl shadow-xs space-y-4">

            {/* --------------------------------------------------------------------- */}
            {/* STAGE 1: INITIAL STATE (When user hasn't selected opportunity type)   */}
            {/* --------------------------------------------------------------------- */}
            {!isOpportunityTypeSelected ? (
              <div className="space-y-4">
                {/* Initial Calm Prompt */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      What are you looking for?
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose an opportunity type to reveal context-aware refinements.
                    </p>
                  </div>

                  {/* Primary Opportunity Type Dropdown Selector */}
                  <div className="w-full sm:w-64">
                    <label htmlFor="career-scope-select" className="sr-only">
                      Opportunity Type
                    </label>
                    <select
                      id="career-scope-select"
                      value={selectedOpportunityType || "none"}
                      onChange={(e) => {
                        const val = e.target.value === "none" ? "" : e.target.value;
                        handleOpportunityTypeChange(val);
                      }}
                      className="w-full min-h-[42px] text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 cursor-pointer shadow-2xs hover:border-blue-400 focus:outline-hidden"
                      aria-label="Opportunity type"
                    >
                      <option value="none">Choose an opportunity type</option>
                      <option value="job">Job</option>
                      <option value="internship">Internship</option>
                      <option value="training">Training</option>
                      <option value="any">Any opportunity</option>
                    </select>
                  </div>
                </div>

                {/* 4 Interactive Visual Intent Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpportunityTypeChange("job")}
                    className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-blue-400 hover:shadow-xs transition text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                      Job
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Full-time &amp; entry-level roles
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpportunityTypeChange("internship")}
                    className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-teal-400 hover:shadow-xs transition text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-teal-600 transition-colors">
                      Internship
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Summer &amp; semester internships
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpportunityTypeChange("training")}
                    className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-purple-400 hover:shadow-xs transition text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <Award className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-purple-600 transition-colors">
                      Training
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Upskilling, courses &amp; certificates
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpportunityTypeChange("any")}
                    className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-400 hover:shadow-xs transition text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-slate-700 transition-colors">
                      Any opportunity
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Explore all campus opportunities
                    </div>
                  </button>
                </div>

                {/* Optional Search Query Input */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePrimarySearch()}
                    placeholder="Search jobs, internships, and training (or select requirements below)..."
                    className="w-full bg-transparent text-xs sm:text-sm text-slate-900 focus:outline-hidden"
                  />
                  {customQuery && (
                    <button
                      type="button"
                      onClick={() => setCustomQuery("")}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="Clear query"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Initial Action Row */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80">
                  <div className="text-xs text-slate-500">
                    <span>Select an opportunity type above to begin refining your search</span>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrimarySearch}
                    disabled={!searchButtonInfo.enabled}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                      searchButtonInfo.enabled
                        ? `${activeTheme.primary.btnClass} cursor-pointer shadow-sm`
                        : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    <span>{searchButtonInfo.label}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* --------------------------------------------------------------------- */
              /* STAGE 2 & 3: CONTEXT-REVEALED FILTERS (Job, Internship, Training, Any)*/
              /* --------------------------------------------------------------------- */
              <div className="space-y-4">
                
                {/* Search Text Input adapted to context */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePrimarySearch()}
                    placeholder="Search by role, skill, company, or keyword..."
                    className="w-full bg-transparent text-xs sm:text-sm text-slate-900 focus:outline-hidden"
                  />
                  {customQuery && (
                    <button
                      type="button"
                      onClick={() => setCustomQuery("")}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="Clear query"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* STAGE 2: PRIMARY REFINEMENTS ROW 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Role / Title Selector (Shared: Job, Internship, Any) */}
                  {selectedOpportunityType === "internship" ? (
                    <SearchableSelect
                      id="career-role-select"
                      label="Internship Role"
                      placeholder="All Internship Roles"
                      value={selectedRole}
                      onChange={(val) => {
                        const clean = val === "all" ? "" : val;
                        setSelectedRole(clean);
                      }}
                      options={roleSelectOptions}
                      anyLabel="All Internship Roles"
                    />
                  ) : selectedOpportunityType !== "training" ? (
                    <SearchableSelect
                      id="career-role-select"
                      label="Job Role"
                      placeholder="All Job Roles"
                      value={selectedRole}
                      onChange={(val) => {
                        const clean = val === "all" ? "" : val;
                        setSelectedRole(clean);
                      }}
                      options={roleSelectOptions}
                      anyLabel="All Job Roles"
                    />
                  ) : null}

                  {/* Academic Branch / Discipline (Shared: Job, Internship, Any) */}
                  {selectedOpportunityType !== "training" && (
                    <SearchableSelect
                      id="career-branch-select"
                      label="Branch / Discipline"
                      placeholder="All Branches"
                      value={selectedBranch}
                      onChange={(val) => {
                        const clean = val === "all" ? "" : val;
                        setSelectedBranch(clean);
                      }}
                      options={branchSelectOptions}
                      anyLabel="All Branches"
                    />
                  )}

                  {/* Domain / Industry (Shared across all including Training) */}
                  {selectedOpportunityType === "training" ? (
                    <SearchableSelect
                      id="career-domain-select"
                      label="Training Domain"
                      placeholder="All Domains"
                      value={selectedDomain}
                      onChange={(val) => {
                        const clean = val === "all" ? "" : val;
                        setSelectedDomain(clean);
                      }}
                      options={domainSelectOptions}
                      anyLabel="All Domains"
                    />
                  ) : (
                    <SearchableSelect
                      id="career-domain-select"
                      label="Domain / Industry"
                      placeholder="All Domains"
                      value={selectedDomain}
                      onChange={(val) => {
                        const clean = val === "all" ? "" : val;
                        setSelectedDomain(clean);
                      }}
                      options={domainSelectOptions}
                      anyLabel="All Domains"
                    />
                  )}

                  {/* Area / Location (Shared across all) */}
                  <SearchableSelect
                    id="career-location-select"
                    label="Area / Location"
                    placeholder="Any location"
                    value={selectedLocation}
                    onChange={(val) => {
                      const clean = val === "all" || val === "any-location" ? "" : val;
                      setSelectedLocation(clean);
                    }}
                    options={locationSelectOptions}
                    anyLabel="Any location"
                  />

                  {/* Training Delivery Mode (Primary for Training) */}
                  {selectedOpportunityType === "training" && (
                    <div>
                      <label htmlFor="training-mode-select" className="block text-[11px] font-bold text-slate-600 mb-1">
                        Delivery Mode
                      </label>
                      <select
                        id="training-mode-select"
                        value={deliveryMode}
                        onChange={(e) => setDeliveryMode(e.target.value)}
                        className="w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="all">All Modes</option>
                        <option value="online">Online Live / Self-Paced</option>
                        <option value="offline">Classroom / Offline</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                  )}

                  {/* Training Duration (Primary for Training) */}
                  {selectedOpportunityType === "training" && (
                    <div>
                      <label htmlFor="training-dur-select" className="block text-[11px] font-bold text-slate-600 mb-1">
                        Duration
                      </label>
                      <select
                        id="training-dur-select"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="all">Any Duration</option>
                        <option value="1-2-months">1 – 2 Months</option>
                        <option value="3-6-months">3 – 6 Months</option>
                        <option value="6-plus-months">6+ Months</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* STAGE 2: PRIMARY REFINEMENTS ROW 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {/* Opportunity Type Switcher */}
                  <div>
                    <label htmlFor="career-scope-select" className="block text-[11px] font-bold text-slate-600 mb-1">
                      Opportunity Type
                    </label>
                    <select
                      id="career-scope-select"
                      value={selectedOpportunityType}
                      onChange={(e) => handleOpportunityTypeChange(e.target.value)}
                      className={`w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border bg-white cursor-pointer shadow-2xs ${
                        selectedOpportunityType !== "any" && selectedOpportunityType !== ""
                          ? `${activeTheme.primary.borderClass} font-bold`
                          : "border-slate-200 text-slate-700"
                      }`}
                      aria-label="Opportunity type"
                    >
                      <option value="job">Job</option>
                      <option value="internship">Internship</option>
                      <option value="training">Training</option>
                      <option value="any">Any opportunity</option>
                    </select>
                  </div>

                  {/* Experience Level (Shown for Job and Any) */}
                  {(selectedOpportunityType === "job" || selectedOpportunityType === "any") && (
                    <div>
                      <label htmlFor="career-exp-select" className="block text-[11px] font-bold text-slate-600 mb-1">
                        Experience Level
                      </label>
                      <select
                        id="career-exp-select"
                        value={selectedExperience}
                        onChange={(e) => setSelectedExperience(e.target.value)}
                        className={`w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border bg-white cursor-pointer shadow-2xs ${
                          selectedExperience !== "all"
                            ? `${activeTheme.primary.borderClass} font-bold`
                            : "border-slate-200 text-slate-700"
                        }`}
                        aria-label="Experience level"
                      >
                        {CANONICAL_EXPERIENCE_LEVELS.map((exp) => (
                          <option key={exp.id} value={exp.id}>
                            {exp.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Internship Duration (Primary for Internship) */}
                  {selectedOpportunityType === "internship" && (
                    <div>
                      <label htmlFor="internship-duration-select" className="block text-[11px] font-bold text-slate-600 mb-1">
                        Duration
                      </label>
                      <select
                        id="internship-duration-select"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className={`w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border bg-white cursor-pointer shadow-2xs ${
                          duration !== "all"
                            ? `${activeTheme.primary.borderClass} font-bold`
                            : "border-slate-200 text-slate-700"
                        }`}
                        aria-label="Internship duration"
                      >
                        <option value="all">Any Duration</option>
                        <option value="1-2-months">1 – 2 Months</option>
                        <option value="3-6-months">3 – 6 Months</option>
                        <option value="6-plus-months">6+ Months</option>
                      </select>
                    </div>
                  )}

                  {/* Work Mode (Shared: Job, Internship, Any) */}
                  {selectedOpportunityType !== "training" && (
                    <div>
                      <label htmlFor="career-mode-select" className="block text-[11px] font-bold text-slate-600 mb-1">
                        Work Mode
                      </label>
                      <select
                        id="career-mode-select"
                        value={selectedWorkMode}
                        onChange={(e) => setSelectedWorkMode(e.target.value)}
                        className={`w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border bg-white cursor-pointer shadow-2xs ${
                          selectedWorkMode !== "all"
                            ? `${activeTheme.primary.borderClass} font-bold`
                            : "border-slate-200 text-slate-700"
                        }`}
                        aria-label="Work mode"
                      >
                        {CANONICAL_WORK_MODES.map((mode) => (
                          <option key={mode.id} value={mode.id}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* "More Filters" Progressive Disclosure Button */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Additional Details
                    </label>
                    <button
                      type="button"
                      onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
                      className={`w-full min-h-[42px] text-xs font-semibold px-3 py-2 rounded-xl border transition flex items-center justify-between cursor-pointer shadow-2xs ${
                        extraFiltersCount > 0 || moreFiltersOpen
                          ? "bg-blue-50/40 border-blue-300 text-blue-800 font-bold"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>More filters</span>
                        {extraFiltersCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-bold">
                            {extraFiltersCount}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${moreFiltersOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {/* ----------------------------------------------------------------- */}
                {/* STAGE 3: MORE FILTERS (Contextual to Selected Opportunity Type)    */}
                {/* ----------------------------------------------------------------- */}
                {moreFiltersOpen && (
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-150">
                    {/* JOB CONTEXTUAL: Salary Band */}
                    {selectedOpportunityType === "job" && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Salary Range</label>
                        <select
                          value={salary}
                          onChange={(e) => setSalary(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="all">Any Salary</option>
                          <option value="3-6-lpa">₹3 – 6 LPA</option>
                          <option value="6-10-lpa">₹6 – 10 LPA</option>
                          <option value="10-18-lpa">₹10 – 18 LPA</option>
                          <option value="18-plus-lpa">₹18+ LPA</option>
                        </select>
                      </div>
                    )}

                    {/* JOB CONTEXTUAL: Employment Type */}
                    {selectedOpportunityType === "job" && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Employment Type</label>
                        <select
                          value={employmentType}
                          onChange={(e) => setEmploymentType(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="all">All Employment Types</option>
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                          <option value="contract">Contract</option>
                        </select>
                      </div>
                    )}

                    {/* JOB CONTEXTUAL: Company */}
                    {selectedOpportunityType === "job" && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Company</label>
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="e.g. Google, Infosys"
                          className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden"
                        />
                      </div>
                    )}

                    {/* INTERNSHIP CONTEXTUAL: Stipend Minimum */}
                    {selectedOpportunityType === "internship" && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Stipend Minimum</label>
                        <select
                          value={stipend}
                          onChange={(e) => setStipend(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="all">Any Stipend</option>
                          <option value="paid">Paid Only</option>
                          <option value="10k_plus">₹10,000+ / mo</option>
                          <option value="20k_plus">₹20,000+ / mo</option>
                          <option value="30k_plus">₹30,000+ / mo</option>
                        </select>
                      </div>
                    )}

                    {/* INTERNSHIP CONTEXTUAL: Eligibility */}
                    {selectedOpportunityType === "internship" && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Eligibility</label>
                        <select
                          value={eligibility}
                          onChange={(e) => setEligibility(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="all">All Students &amp; Graduates</option>
                          <option value="students">Current Students Only</option>
                          <option value="batch_2025_2026">2025 / 2026 Batch</option>
                          <option value="graduates">Graduates</option>
                        </select>
                      </div>
                    )}

                    {/* INTERNSHIP CONTEXTUAL: Start Date */}
                    {selectedOpportunityType === "internship" && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Start Date</label>
                        <select
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="all">Flexible</option>
                          <option value="immediate">Immediately</option>
                          <option value="2weeks">Within 2 Weeks</option>
                          <option value="1month">Within 1 Month</option>
                        </select>
                      </div>
                    )}

                    {/* TRAINING CONTEXTUAL: Provider & Fee */}
                    {selectedOpportunityType === "training" && (
                      <>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Fee &amp; Certificate</label>
                          <select
                            value={feeType}
                            onChange={(e) => setFeeType(e.target.value)}
                            className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                          >
                            <option value="all">All Training</option>
                            <option value="free">Free / Sponsored</option>
                            <option value="certificate">With Certificate</option>
                            <option value="placement_assisted">Placement Assisted</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Provider</label>
                          <input
                            type="text"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            placeholder="e.g. Coursera, NPTEL"
                            className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden"
                          />
                        </div>
                      </>
                    )}

                    {/* SHARED SKILLS MULTI-SELECT (Relevant across all opportunities) */}
                    <div className="sm:col-span-3 space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          Skills &amp; Technologies
                        </label>
                        {selectedSkills.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedSkills([])}
                            className="text-[10px] text-blue-600 hover:underline font-semibold"
                          >
                            Reset skills
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                        {CANONICAL_SKILLS.map((sk) => {
                          const active = selectedSkills.includes(sk);
                          const isRecommended = dependencies.recommendedSkills.includes(sk);
                          return (
                            <button
                              key={sk}
                              type="button"
                              onClick={() => {
                                const next = active
                                  ? selectedSkills.filter((s) => s !== sk)
                                  : [...selectedSkills, sk];
                                setSelectedSkills(next);
                              }}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                                active
                                  ? `${activeTheme.primary.btnClass} font-bold`
                                  : isRecommended
                                  ? "bg-amber-50/70 text-slate-800 border-amber-300 font-semibold"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <span>{sk}</span>
                              {isRecommended && !active && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* PRIMARY ACTION ROW */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80">
                  <div className="text-xs text-slate-500">
                    {appliedFilters.length > 0 ? (
                      <span>
                        <strong>{appliedFilters.length}</strong> requirements configured
                      </span>
                    ) : (
                      <span>Search with current context or refine further above</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {appliedFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handlePrimarySearch}
                      disabled={loading || !searchButtonInfo.enabled}
                      className={`flex-1 sm:flex-initial px-8 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-2 min-h-[44px] shadow-sm ${
                        searchButtonInfo.enabled
                          ? `${activeTheme.primary.btnClass} cursor-pointer`
                          : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      }`}
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Searching...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span>{searchButtonInfo.label}</span>
                          <ArrowRight className="w-4 h-4 ml-0.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* VISIBLE APPLIED FILTER CHIPS */}
          {appliedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-slate-400 font-medium">Searching for:</span>
              {appliedFilters.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer border ${activeTheme.primary.badgeClass}`}
                >
                  <span>{chip.label}</span>
                  <X className="w-3 h-3 text-slate-500 hover:text-slate-800" />
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs text-blue-600 hover:underline font-semibold ml-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* QUICK SUGGESTIONS */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 pt-1">
            <span className="font-medium text-slate-500">Popular suggestions:</span>
            {SUGGESTED_SEARCHES.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => {
                  setCustomQuery(sug);
                  executeSearch({ q: sug });
                }}
                className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] transition cursor-pointer"
              >
                {sug}
              </button>
            ))}
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* SECTION 2: MAIN OPPORTUNITY STREAM OR PRE-SEARCH GUIDANCE                 */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* PRE-SEARCH STATE (When user hasn't clicked search and no query in URL) */}
        {!hasSearched && jobs.length === 0 && !loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Tell us what you&apos;re looking for</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Configure your job role, branch, domain, or location above and click Search Opportunities to view live positions.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOpportunityType("internship");
                  setSelectedLocation("Bengaluru");
                  executeSearch({ opportunityType: "internship", location: "Bengaluru" });
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                Internships in Bengaluru
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRole("Software Developer");
                  setSelectedExperience("fresher");
                  executeSearch({ role: "Software Developer", experience: "fresher" });
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                Software Developer (Fresher)
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedOpportunityType("internship");
                  setSelectedWorkMode("remote");
                  executeSearch({ opportunityType: "internship", workMode: "remote" });
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                Remote Internships
              </button>
            </div>
          </div>
        )}

        {/* POST-SEARCH STREAM */}
        {(hasSearched || jobs.length > 0 || loading) && (
          <div
            id="jobs-search-results"
            data-saarvi-target="search-results"
            tabIndex={-1}
            className="space-y-6 outline-hidden"
          >
            {/* Partial Failure Notice (Requirement 44, 88) */}
            {partialFailureNotice && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 text-amber-900 rounded-2xl text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{partialFailureNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPartialFailureNotice(null)}
                  className="text-amber-800 font-bold hover:underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Controlled Relaxation Notice (Requirement 43) */}
            {relaxationExplanation && (
              <div className="p-3.5 bg-blue-50/90 border border-blue-200/90 text-blue-900 rounded-2xl text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{relaxationExplanation}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRelaxationExplanation(null)}
                  className="text-blue-800 font-bold hover:underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Stream Header & Sorting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {resultsStreamHeading}
                </h2>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {selectedOpportunityType === "training" ? trainingOpportunities.length : jobs.length}
                </span>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const val = e.target.value as JobSortOption;
                    setSortBy(val);
                    executeSearch({ sortBy: val });
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden cursor-pointer"
                  aria-label="Sort opportunities"
                >
                  <option value="relevant">Most Relevant</option>
                  <option value="newest">Newest</option>
                  <option value="deadline_soon">Deadline Soon</option>
                  {candidateProfile && <option value="match_score">Best Profile Match</option>}
                </select>
              </div>
            </div>

            {/* Optional Personalization Guidance Banner */}
            {!candidateProfile && (
              <div className="p-4 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <strong>Want personalized match scores?</strong> Add your career profile to calculate ATS alignment for every opportunity.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCareerModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shrink-0 text-center cursor-pointer shadow-2xs"
                >
                  Personalize Results
                </button>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 animate-pulse">
                    <div className="h-5 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                    <div className="h-10 w-full bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : selectedOpportunityType === "training" ? (
              trainingOpportunities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trainingOpportunities.map((training) => (
                    <TrainingOpportunityCard key={training.id} training={training} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
                  <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-800">No training programs match your criteria</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try adjusting your filters or search keywords.
                  </p>
                </div>
              )
            ) : jobs.length === 0 ? (
              /* Differentiated Empty State */
              <div className="text-center py-14 bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
                <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />

                {appliedFilters.length > 0 ? (
                  /* Case B: Filter Mismatch */
                  <div className="space-y-3 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-slate-900">
                      No opportunities match your current filters
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {liveCount && liveCount > 0
                        ? `There are ${liveCount} live opportunities in the platform. Try broadening your criteria or removing one of your filters.`
                        : "Try removing a filter or adjusting your search query to see all available opportunities."}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {appliedFilters.map((chip) => (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={chip.onRemove}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Remove {chip.label} ×
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="px-4 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Case A: Truly No Live Opportunities */
                  <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-slate-900">
                      No live opportunities are currently available
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Our team actively discovers, verifies, and publishes campus and fresher opportunities continuously. Check back soon!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* ONE UNIFIED RESULT STREAM */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => renderJobCard(job))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MOBILE FILTER DRAWER                                                      */}
      {/* ========================================================================= */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-sm h-full p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">Filter Opportunities</h3>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Opportunity Scope */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Opportunity Type</label>
                <select
                  value={selectedOpportunityType}
                  onChange={(e) => setSelectedOpportunityType(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                >
                  <option value="any">Any opportunity</option>
                  <option value="job">Job</option>
                  <option value="internship">Internship</option>
                  <option value="training">Training</option>
                </select>
              </div>

              {/* Work Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Work Mode</label>
                <select
                  value={selectedWorkMode}
                  onChange={(e) => setSelectedWorkMode(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                >
                  <option value="all">All Work Modes</option>
                  <option value="remote">Remote Only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>

              {/* Experience */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Experience Level</label>
                <select
                  value={selectedExperience}
                  onChange={(e) => setSelectedExperience(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                >
                  <option value="all">All Experience Levels</option>
                  <option value="fresher">Fresher Roles</option>
                  <option value="entry-level">Entry-Level (0-2 yrs)</option>
                  <option value="mid-level">Mid-Level (2-5 yrs)</option>
                  <option value="senior">Senior (5+ yrs)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleClearAllFilters();
                  setMobileDrawerOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  executeSearch();
                  setMobileDrawerOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUTHENTICATION GATE MODAL                                                 */}
      {/* ========================================================================= */}
      <JobsAuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        returnUrl={returnUrl}
        searchSummary={{
          role: selectedRole || customQuery,
          location: selectedLocation,
          experience: selectedExperience !== "all" ? selectedExperience : undefined,
        }}
      />

      {/* ========================================================================= */}
      {/* GUIDED CAREER SEARCH MODAL (OPTIONAL)                                     */}
      {/* ========================================================================= */}
      <GuidedCareerSearchModal
        isOpen={careerModalOpen}
        onClose={() => setCareerModalOpen(false)}
        initialPreferences={careerPrefs || undefined}
        onApplyPreferences={(prefs: CareerProfilePreferences) => {
          setCareerPrefs(prefs);
          if (prefs.roles && prefs.roles.length > 0) {
            setSelectedRole(prefs.roles[0]);
          }
          if (prefs.location) {
            setSelectedLocation(prefs.location);
          }
          if (prefs.workMode) {
            setSelectedWorkMode(prefs.workMode);
          }
          executeSearch({
            role: prefs.roles?.[0] || selectedRole,
            location: prefs.location || selectedLocation,
            workMode: prefs.workMode || selectedWorkMode,
          });
        }}
      />

      {/* ========================================================================= */}
      {/* MATCH EXPLAINABILITY MODAL                                                */}
      {/* ========================================================================= */}
      {selectedMatchJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900">Explainable Match Breakdown</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatchJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-slate-800">{selectedMatchJob.job.title}</p>
                <p className="text-slate-500">{selectedMatchJob.job.companyName}</p>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
                <span className="font-bold text-blue-900">Overall ATS Match Score</span>
                <span className="text-base font-extrabold text-blue-600">
                  {selectedMatchJob.match.matchScore}%
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Matched Skills:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedMatchJob.match.matchedSkills.length > 0 ? (
                    selectedMatchJob.match.matchedSkills.map((sk) => (
                      <span key={sk} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        ✓ {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">No direct keyword overlap</span>
                  )}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Missing Skills to Add:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedMatchJob.match.missingSkills.length > 0 ? (
                    selectedMatchJob.match.missingSkills.map((sk) => (
                      <span key={sk} className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                        + {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Great match! No missing skills identified.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMatchJob(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT LISTING MODAL                                                      */}
      {/* ========================================================================= */}
      {reportingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Report Listing</h3>
              <button
                type="button"
                onClick={() => setReportingJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Report</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as JobReportReason)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="MISLEADING_INFO">Misleading Information</option>
                  <option value="SUSPECTED_SCAM">Suspected Scam / Demanding Money</option>
                  <option value="EXPIRED_LINK">Expired Link / Position Filled</option>
                  <option value="OFFENSIVE_CONTENT">Offensive Content</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Additional Details (Optional)</label>
                <textarea
                  rows={3}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Provide context to help our Trust & Safety review..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingJob(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportingSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
                >
                  {reportingSubmitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* JOB ALERT MODAL                                                           */}
      {/* ========================================================================= */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Create Job Alert</h3>
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAlert} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Receive notifications when new opportunities matching &ldquo;{selectedRole || customQuery || "all roles"}&rdquo; {selectedLocation ? `in ${selectedLocation}` : ""} are published.
              </p>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Notification Frequency</label>
                <select
                  value={alertFrequency}
                  onChange={(e) => setAlertFrequency(e.target.value as "daily" | "weekly")}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Summary</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAlertModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                >
                  Create Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <JobsContent />
    </Suspense>
  );
}
