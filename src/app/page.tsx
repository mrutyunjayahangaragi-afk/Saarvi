import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import PlatformInteractiveShowcase from "@/components/home/PlatformInteractiveShowcase";
import FaqAccordion, { GLOBAL_FAQS } from "@/components/common/FaqAccordion";
import { CANONICAL_TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import { createMetadata } from "@/lib/seo/metadata";
import { generateWebSiteSchema, generateFaqSchema, generateOrganizationSchema } from "@/lib/seo/structured-data";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Zap,
  UserCheck,
  FileText,
  FileImage,
  GraduationCap,
  Briefcase,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  HelpCircle,
  MapPin,
} from "lucide-react";

export const metadata: Metadata = createMetadata({
  title: "Saarvi — Study. Work. Grow.",
  description:
    "Saarvi brings everyday academic tools, document utilities, and career workflows into one focused workspace.",
  path: "/",
  keywords: [
    "saarvi",
    "pdf to jpg",
    "merge pdf",
    "compress pdf",
    "pdf to excel",
    "excel to pdf",
    "vtu sgpa calculator",
    "resume builder",
    "private document converter",
  ],
});

export default function HomePage() {
  const organizationSchema = generateOrganizationSchema();
  const websiteSchema = generateWebSiteSchema();
  const faqSchema = generateFaqSchema(GLOBAL_FAQS);

  // 6 Representative tools from canonical tool registry
  const REPRESENTATIVE_TOOLS = [
    {
      name: "PDF to JPG",
      key: "pdf-to-jpg",
      desc: "Convert PDF pages into high-resolution JPG images client-side.",
      route: "/tools/pdf-to-jpg",
      badge: "Local",
      icon: FileImage,
    },
    {
      name: "Merge PDF",
      key: "merge-pdf",
      desc: "Combine multiple PDF documents into one ordered file.",
      route: "/tools/merge-pdf",
      badge: "Local",
      icon: FileText,
    },
    {
      name: "Compress PDF",
      key: "compress-pdf",
      desc: "Reduce file size without sacrificing document readability.",
      route: "/tools/compress-pdf",
      badge: "Local",
      icon: FileText,
    },
    {
      name: "VTU SGPA Calculator",
      key: "sgpa-calculator",
      desc: "Deterministic semester SGPA with verified university credits.",
      route: "/student/sgpa-calculator",
      badge: "Student",
      icon: GraduationCap,
    },
    {
      name: "Resume Builder",
      key: "resume-builder",
      desc: "ATS-compliant resumes with instant live A4 paper preview.",
      route: "/student/resume",
      badge: "Career",
      icon: Briefcase,
    },
    {
      name: "PDF to Excel",
      key: "pdf-to-excel",
      desc: "Extract structured tables from PDF into an Excel spreadsheet.",
      route: "/tools/pdf-to-excel",
      badge: "Document",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-[#0b1329] text-slate-900 dark:text-white font-sans">
      {/* Search Engine Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      {/* 1. NAVBAR */}
      <Navbar />

      <main className="flex-1 space-y-20 sm:space-y-24">
        
        {/* 2. HERO SECTION */}
        <HeroSection />

        {/* 3. TRUST & PRODUCT PRINCIPLES */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 sm:p-8 bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Local-First Processing</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Supported document tools and academic calculators run directly in your browser. Your files stay on your device.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Verified &amp; Transparent</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Zero fake metrics, zero artificial delays. Every formula, credit scale, and career opportunity is vetted by real criteria.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Zero Signup Friction</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Open any guest-enabled tool, convert your document or compute your marks, and download the result immediately.
              </p>
            </div>
          </div>
        </section>

        {/* 4. CORE PRODUCT PILLARS: STUDY • WORK • GROW */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              The Saarvi Framework
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              One workspace. Three focused pillars.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Designed around everyday student, professional, and career workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* STUDY */}
            <div className="group p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md hover:-translate-y-1 transition-all duration-200 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800 group-hover:scale-105 transition-transform duration-200">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Pillar 1</span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">Study</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Academic utilities designed around everyday student workflows. Calculate exact semester SGPA, verify university syllabus credits, and monitor attendance safety margins.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/student"
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1.5"
                >
                  <span>Explore student utilities</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* WORK */}
            <div className="group p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-1 transition-all duration-200 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800 group-hover:scale-105 transition-transform duration-200">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Pillar 2</span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">Work</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Practical document and productivity tools without unnecessary friction. Merge, split, compress, and extract tabular data between PDF, Word, and Excel formats.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/tools"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5"
                >
                  <span>Explore document utilities</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* GROW */}
            <div className="group p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md hover:-translate-y-1 transition-all duration-200 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800 group-hover:scale-105 transition-transform duration-200">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Pillar 3</span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">Grow</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Career tools for discovering opportunities and building your professional profile. Build ATS-friendly resumes, view transparent skill matches, and track job applications.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/jobs"
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1.5"
                >
                  <span>Explore career search</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 5. INTERACTIVE PRODUCT PREVIEW */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <PlatformInteractiveShowcase />
        </section>

        {/* 6. HOW SAARVI WORKS (3 Simple Steps) */}
        <section id="how-it-works" className="py-14 bg-white dark:bg-[#111c38] border-y border-slate-200/80 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Simple Workflow
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                How Saarvi works
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Direct, focused workflows without tutorials or complex setup.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-3">
                <span className="text-xs font-mono font-bold text-blue-600 block">01</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Choose what you need</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Select a document tool, academic calculator, or career search workspace from the directory or search bar.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-3">
                <span className="text-xs font-mono font-bold text-blue-600 block">02</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Use the tool or workflow</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Add your file for client-side processing, enter your semester marks, or enter your career search criteria.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-600 block">03</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Save, download, or apply</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Download converted files directly to your device, export your verified marksheet, or apply directly to employers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. FEATURED CAPABILITIES ("Start with a tool") */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Instant Launch
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                Start with a tool
              </h2>
            </div>
            <Link
              href="/tools"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>Explore all {CANONICAL_TOOL_REGISTRY.length} tools</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPRESENTATIVE_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.key}
                  href={tool.route}
                  className="group p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-2xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between space-y-4 cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white group-hover:border-transparent group-hover:-translate-y-0.5 transition-all duration-200 shadow-2xs">
                        <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
                        {tool.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {tool.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    <span>Open utility</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 8. HONEST PRIVACY ARCHITECTURE */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-10 bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-6">
            <div className="max-w-xl space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-block">
                Privacy Architecture
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                Transparent data boundaries
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Many Saarvi tools process files locally in your browser. Tools that require server-side functionality clearly indicate when data is sent to our servers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Local-First Operations</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  PDF mergers, page splitters, image format converters, and GPA calculators execute entirely in client WebAssembly memory. Files never leave your browser.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ephemeral Server Tasks</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  For tools requiring server execution (like OCR or heavy extraction), data is processed in ephemeral memory and discarded immediately upon completion.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account Preferences Only</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  When you sign in, we store only your profile identity and saved tracker preferences. We never index or analyze your document contents.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. CAREER INTELLIGENCE & ECOSYSTEM (Requirements 72 & 73) */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Career Intelligence
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Your next opportunity starts with one search.
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Find opportunities that fit across connected career sources from one focused workspace.
              </p>
            </div>
            <Link
              href="/jobs"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>Explore Career Search</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Multi-Source Deduplication & Unified Discovery Visual */}
          <div className="bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Search intent:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                  Frontend internship
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                  Bengaluru
                </span>
              </div>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Canonical database stream</span>
            </div>

            {/* Deduplication Flow Representation */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Left Column: 3 Source Listings */}
              <div className="lg:col-span-5 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Identical Opportunity Across 3 Sources
                </span>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Google Jobs</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Frontend Developer Intern</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Company Careers</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Frontend Developer Intern</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Greenhouse ATS</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Frontend Developer Intern</span>
                </div>
              </div>

              {/* Center Column: Saarvi Intelligence Engine */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-2 lg:py-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 mt-1 uppercase tracking-tight">
                  Deduplicated
                </span>
              </div>

              {/* Right Column: ONE Clean Canonical Opportunity */}
              <div className="lg:col-span-5 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Internship
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Saarvi Verified</span>
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Frontend Developer Intern</h4>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>Bengaluru</span>
                  <span>·</span>
                  <span>Hybrid</span>
                  <span>·</span>
                  <span>0–1 yrs</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
                  <span>Sources: Company Careers, Greenhouse, Google Jobs</span>
                  <Link
                    href="/jobs"
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 10. FREQUENTLY ASKED QUESTIONS */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <FaqAccordion
            items={GLOBAL_FAQS}
            eyebrow="Frequently asked questions"
            title="Clear answers about privacy, guest access, and file conversions."
          />
        </section>

        {/* 11. FINAL CALL TO ACTION (Requirement 77) */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="rounded-2xl bg-slate-900 dark:bg-[#111c38] border border-slate-800 p-8 sm:p-12 text-white text-center space-y-5 shadow-md">
            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                One workspace. Less friction.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 dark:text-slate-400 leading-relaxed">
                Study smarter. Get work done. Find what comes next.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/tools"
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition text-xs sm:text-sm shadow-xs"
              >
                Start with Saarvi
              </Link>
              <Link
                href="/jobs"
                className="px-5 py-3 rounded-xl bg-slate-800 dark:bg-slate-800/80 text-slate-200 font-semibold hover:bg-slate-700 dark:hover:bg-slate-700/80 transition border border-slate-700 text-xs sm:text-sm"
              >
                Explore Career Search
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* 12. FOOTER */}
      <Footer />
    </div>
  );
}
