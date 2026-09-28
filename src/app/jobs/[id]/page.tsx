import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import JobDetailAuthCard from "@/components/career/JobDetailAuthCard";
import {
  Briefcase,
  MapPin,
  Calendar,
  Clock,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  Share2,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface JobPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  const opp = opportunityStore.getOpportunityById(id);

  if (!opp || (opp.status !== "APPROVED" && opp.status !== "PUBLISHED" && opp.status !== "ACTIVE")) {
    return {
      title: "Opportunity No Longer Available | Saarvi",
    };
  }

  return {
    title: `${opp.title} at ${opp.companyName} | Saarvi Career Intelligence`,
    description: `Discover ${opp.title} opportunity at ${opp.companyName} on Saarvi.`,
    alternates: {
      canonical: `https://saarvi.app/jobs/${opp.id}`,
    },
  };
}

export default async function SingleJobPage({ params }: JobPageProps) {
  const { id } = await params;
  const opp = opportunityStore.getOpportunityById(id);

  if (!opp) {
    notFound();
  }

  const isAvailable = opp.status === "APPROVED" || opp.status === "PUBLISHED" || opp.status === "ACTIVE";

  if (!isAvailable) {
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
            The listing for <span className="font-semibold text-slate-800">{opp.title}</span> at <span className="font-semibold text-slate-800">{opp.companyName}</span> has expired or been closed by administrators.
          </p>
          <div className="pt-2">
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

  // Guest Direct URL Handling: Do not leak protected record
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

  // Google JobPosting Structured Data (strictly for authenticated verified access per Google guidelines)
  const jobPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: opp.title,
    description: opp.description,
    datePosted: opp.postedAt,
    ...(opp.applicationDeadline ? { validThrough: opp.applicationDeadline } : {}),
    employmentType: opp.isInternship ? "INTERN" : "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: opp.companyName,
      ...(opp.companyLogo ? { logo: opp.companyLogo } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: opp.location,
        addressCountry: "IN",
      },
    },
    directApply: true,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Inject Google JobPosting Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
      />

      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Back Link */}
        <Link
          href="/career/opportunities"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Verified Opportunities
        </Link>

        {/* Opportunity Header Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                  {opp.companyName}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified by Saarvi
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

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {opp.location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {opp.employmentType}
                </span>
                {opp.applicationDeadline && (
                  <span className="flex items-center gap-1 text-amber-700 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Deadline: {opp.applicationDeadline}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              <a
                href={opp.applyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="px-6 py-3 font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-sm transition flex items-center gap-2"
              >
                <span>Apply on Official Site</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Core Skills */}
          {opp.skills.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Required Technical Skills
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
              Role Description & Details
            </h2>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {opp.description}
            </div>
          </div>

          {/* Trust and Safety Banner */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Direct official application route. Saarvi does not proxy applications.</span>
            </div>
            <span>Discovered via {opp.source.replace(/_/g, " ")}</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
