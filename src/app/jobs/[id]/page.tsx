import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { jobSearchService } from "@/lib/jobs/search";
import { isSafeUrl } from "@/lib/opportunities/opportunity-store";
import { JobsFeatureControl } from "@/lib/jobs/feature-control";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import JobDetailAuthCard from "@/components/career/JobDetailAuthCard";
import {
  Briefcase,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ArrowRight,
  Info,
  AlertTriangle,
  Building2,
  DollarSign,
  Calendar,
  CheckCircle2,
  HelpCircle,
  Flag,
  Bookmark,
} from "lucide-react";

interface JobPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  const opp = await jobSearchService.getJobById(id);

  if (!opp) {
    return {
      title: "Opportunity No Longer Available | Saarvi",
    };
  }

  const badgeText = opp.verificationTier === "SAARVI_VERIFIED" ? "Saarvi Verified" : "Source Listing";

  return {
    title: `${opp.title} at ${opp.companyName} (${badgeText}) | Saarvi Careers`,
    description: `Discover ${opp.title} at ${opp.companyName}. Location: ${opp.location}. Application type: ${opp.employmentType}.`,
    alternates: {
      canonical: `https://saarvi.app/jobs/${opp.id}`,
    },
  };
}

export default async function SingleJobPage({ params }: JobPageProps) {
  const { id } = await params;

  // 1. Verify Jobs feature state
  const featureSettings = JobsFeatureControl.getSettings();
  if (!featureSettings.enabled || featureSettings.mode === "DISABLED" || !featureSettings.visible) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-16 flex flex-col justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Jobs &amp; Internships Unavailable
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            {featureSettings.maintenance_message || "The Jobs & Internships service is currently undergoing scheduled maintenance. Please check back soon."}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors shadow-xs"
            >
              <span>Return to Home</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Fetch canonical job by ID from authoritative database
  const opp = await jobSearchService.getJobById(id);

  if (!opp) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-16 flex flex-col justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            This opportunity is no longer available
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            This opportunity listing has expired, been archived, or is no longer accepting applications.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 transition-colors shadow-xs"
            >
              <span>Browse Active Opportunities</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Server-Side Authentication Verification
  let isAuthenticated = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  } else {
    try {
      const cookieStore = await cookies();
      const localCookie = cookieStore.get("saarvi_local_session") || cookieStore.get("docease_local_session");
      if (localCookie?.value) isAuthenticated = true;
    } catch {}
  }

  const returnUrl = `/jobs/${id}`;

  // Guest Direct URL Handling: Show auth gate card
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16 flex flex-col justify-center">
          <JobDetailAuthCard
            returnUrl={returnUrl}
            companyName={opp.companyName}
            title={opp.title}
            location={opp.location}
            employmentType={opp.employmentType}
            isInternship={opp.isInternship}
          />
        </main>
        <Footer />
      </div>
    );
  }

  const isVerified = opp.verificationTier === "SAARVI_VERIFIED";
  const safeApplyUrl = isSafeUrl(opp.applyUrl) ? opp.applyUrl : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Opportunities</span>
          </Link>

          <span className="text-[11px] font-mono text-slate-400">
            ID: {opp.id}
          </span>
        </div>

        {/* TRUST BANNER: Prominently Differentiates Tier A vs Tier B */}
        {isVerified ? (
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
                  Saarvi Verified Opportunity
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Tier A Guaranteed
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                This opportunity has been individually reviewed, validated, and explicitly published by the Saarvi Admin team.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                  External Source Listing
                </span>
                <span className="text-[10px] bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                  Tier B Discovered
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Discovered from external job source ({opp.sourceName || "Configured Provider"}). This opportunity has NOT been individually verified by Saarvi Administrators. Please verify details before applying.
              </p>
            </div>
          </div>
        )}

        {/* Main Job Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                  {opp.companyName}
                </span>

                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ✓ Saarvi Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    Source Listing
                  </span>
                )}

                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {opp.isInternship ? "Internship" : "Job"}
                </span>

                {opp.remoteType === "remote" && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Remote
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {opp.title}
              </h1>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600 pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {opp.location}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {opp.employmentType}
                </span>
                {opp.salary && opp.salary !== "Salary not disclosed" && (
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    {opp.salary}
                  </span>
                )}
                {opp.applicationDeadline && (
                  <span className="flex items-center gap-1.5 font-medium text-amber-700">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Deadline: {opp.applicationDeadline}
                  </span>
                )}
              </div>
            </div>

            {/* Direct Apply Action Button */}
            <div className="flex items-center gap-3 sm:flex-shrink-0">
              {safeApplyUrl ? (
                <a
                  href={safeApplyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="px-6 py-3 font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Apply on Official Site</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
                  Application Link Restricted
                </div>
              )}
            </div>
          </div>

          {/* Core Technical Skills */}
          {opp.skills && opp.skills.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Technical Skills &amp; Stack
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {opp.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium border border-slate-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Overview &amp; Job Description
            </h2>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {opp.description}
            </div>
          </div>

          {/* Responsibilities if available */}
          {opp.responsibilities && opp.responsibilities.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Key Responsibilities
              </h2>
              <ul className="list-disc list-inside text-xs sm:text-sm text-slate-700 space-y-1.5 leading-relaxed">
                {opp.responsibilities.map((resp, i) => (
                  <li key={i}>{resp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Qualifications / Requirements if available */}
          {opp.qualifications && opp.qualifications.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Requirements &amp; Qualifications
              </h2>
              <ul className="list-disc list-inside text-xs sm:text-sm text-slate-700 space-y-1.5 leading-relaxed">
                {opp.qualifications.map((qual, i) => (
                  <li key={i}>{qual}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SECTION 34: ABOUT THIS LISTING PANEL */}
          <div className="pt-6 border-t border-slate-100">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                About this listing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Primary Source</span>
                  <span className="font-semibold text-slate-700">{opp.sourceName || "Official Carrier Site"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Discovered On</span>
                  <span className="font-semibold text-slate-700">
                    {opp.discoveredAt ? new Date(opp.discoveredAt).toLocaleDateString() : "Recent"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Last Checked</span>
                  <span className="font-semibold text-slate-700">
                    {opp.lastVerifiedAt ? new Date(opp.lastVerifiedAt).toLocaleDateString() : "Today"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Saarvi Verification</span>
                  <span className={`font-semibold ${isVerified ? "text-emerald-700" : "text-amber-700"}`}>
                    {isVerified ? "✓ Verified by Admin" : "Not individually verified"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 30: JOB SAFETY NOTICE */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                Apply through the official employer/source whenever possible. Saarvi never charges applicants for access to job listings.
              </span>
            </div>

            <Link
              href={`/jobs?reportJob=${encodeURIComponent(opp.id)}`}
              className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-700 transition"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report this listing</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
