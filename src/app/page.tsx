import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import CommandSearch from "@/components/tools/CommandSearch";
import PlatformInteractiveShowcase from "@/components/home/PlatformInteractiveShowcase";
import FaqAccordion, { GLOBAL_FAQS } from "@/components/common/FaqAccordion";
import { TOOLS_CONFIG } from "@/config/tools";
import { CANONICAL_TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import { createMetadata } from "@/lib/seo/metadata";
import { generateWebSiteSchema, generateFaqSchema, generateOrganizationSchema } from "@/lib/seo/structured-data";
import {
  ArrowRight,
  ShieldCheck,
  Shield,
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
  Cpu,
  Clock,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Laptop
} from "lucide-react";

export const metadata: Metadata = createMetadata({
  title: "Saarvi — Study. Work. Grow.",
  description: "Privacy-focused productivity, document, student, and career platform. Convert documents, calculate SGPA, and build resumes with fast local-first tools.",
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

  // Popular / Curated tools required by Section 2 & 3
  const POPULAR_TOOL_KEYS = [
    { key: "pdf-to-jpg", name: "PDF to JPG", desc: "Convert PDF pages into high-resolution JPG images.", route: "/tools/pdf-to-jpg", icon: FileImage, badge: "Local" },
    { key: "merge-pdf", name: "Merge PDF", desc: "Combine multiple PDF files into one clean document.", route: "/tools/merge-pdf", icon: FileText, badge: "Local" },
    { key: "compress-pdf", name: "Compress PDF", desc: "Reduce PDF file size without sacrificing readability.", route: "/tools/compress-pdf", icon: FileText, badge: "Local" },
    { key: "jpg-to-pdf", name: "Image to PDF", desc: "Turn photos and image files into a single formatted PDF.", route: "/tools/jpg-to-pdf", icon: FileImage, badge: "Local" },
    { key: "pdf-to-excel", name: "PDF to Excel", desc: "Extract structured tables from PDF into an Excel spreadsheet.", route: "/tools/pdf-to-excel", icon: FileSpreadsheet, badge: "Document" },
    { key: "excel-to-pdf", name: "Excel to PDF", desc: "Convert Excel worksheets into a formatted PDF document.", route: "/tools/excel-to-pdf", icon: FileSpreadsheet, badge: "Document" },
    { key: "resume-builder", name: "Resume Builder", desc: "Build ATS-compliant resumes with instant live A4 paper preview.", route: "/student/resume", icon: Briefcase, badge: "Career" },
    { key: "sgpa-calculator", name: "SGPA Calculator", desc: "Deterministic semester SGPA with verified university credits.", route: "/student/sgpa-calculator", icon: GraduationCap, badge: "Student" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 text-slate-900 transition-colors">
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

      <Navbar />

      <main className="flex-1 space-y-20 sm:space-y-28">
        
        {/* ============================================================== */}
        {/* SECTION 1 — HERO SECTION                                      */}
        {/* ============================================================== */}
        <HeroSection />

        {/* Global Command Search Box */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-16 relative z-20">
          <CommandSearch />
        </section>

        {/* Immediate Tool Discovery: "Start with a tool" with Live Access Badges */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Instant Launch
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                Start with a tool
              </h2>
            </div>
            <Link
              href="/tools"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>Explore all {CANONICAL_TOOL_REGISTRY.length} tools</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              {
                name: "PDF to JPG",
                key: "pdf-to-jpg",
                route: "/tools/pdf-to-jpg",
                badge: "Guest Allowed",
                icon: FileImage,
                color: "text-blue-600 bg-blue-50 border-blue-200",
              },
              {
                name: "Merge PDF",
                key: "merge-pdf",
                route: "/tools/merge-pdf",
                badge: "Guest Allowed",
                icon: FileText,
                color: "text-emerald-600 bg-emerald-50 border-emerald-200",
              },
              {
                name: "Compress PDF",
                key: "compress-pdf",
                route: "/tools/compress-pdf",
                badge: "Guest Allowed",
                icon: FileText,
                color: "text-teal-600 bg-teal-50 border-teal-200",
              },
              {
                name: "VTU SGPA",
                key: "sgpa-calculator",
                route: "/student/sgpa-calculator",
                badge: "Student Free",
                icon: GraduationCap,
                color: "text-indigo-600 bg-indigo-50 border-indigo-200",
              },
              {
                name: "Resume Builder",
                key: "resume-builder",
                route: "/student/resume",
                badge: "Sample Ready",
                icon: Briefcase,
                color: "text-purple-600 bg-purple-50 border-purple-200",
              },
              {
                name: "PDF to Excel",
                key: "pdf-to-excel",
                route: "/tools/pdf-to-excel",
                badge: "OpenXML",
                icon: FileSpreadsheet,
                color: "text-amber-600 bg-amber-50 border-amber-200",
              },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.key}
                  href={tool.route}
                  className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3 cursor-pointer shadow-2xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs ${tool.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tool.badge}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {tool.name}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-blue-600">
                    <span>Launch</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Interactive Platform Showcase: Study. Work. Grow. */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PlatformInteractiveShowcase />
        </section>

        {/* ============================================================== */}
        {/* SECTION 2 — "WHAT CAN I DO WITH SAARVI?" (Category Outcomes)   */}
        {/* ============================================================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Platform Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              What can you do with Saarvi?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Every tool is engineered for a clear purpose. Zero unnecessary steps, zero confusion.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: PDF & Documents */}
            <Link
              href="/tools?category=pdf"
              className="group p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  PDF &amp; Documents
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Merge, split, compress, protect, unlock, and convert documents between PDF, Word, and Excel without sending files to untrusted cloud queues.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">
                <span>Explore PDF tools</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Card 2: Images */}
            <Link
              href="/tools?category=image"
              className="group p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <FileImage className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Image Tools
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Convert image formats (JPG, PNG, WebP, SVG, HEIC), resize dimensions, crop bounds, and compress file size in your browser with private client execution.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                <span>Explore image tools</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Card 3: Student Tools */}
            <Link
              href="/student"
              className="group p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                  Student Tools
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Calculate semester SGPA and multi-semester CGPA using verified university credit tables. Plan attendance safety margins and organize assignments.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-purple-600 group-hover:translate-x-1 transition-transform">
                <span>Explore student tools</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Card 4: Career & Placement */}
            <Link
              href="/student/resume"
              className="group p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Career &amp; Resume
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Build structured, ATS-compliant resumes with instant live paper preview. Switch templates without re-entering data, and search genuine job listings.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
                <span>Build your resume</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Card 5: Productivity */}
            <Link
              href="/student/attendance"
              className="group p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                  Academic Productivity
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Track course attendance with 75% safety thresholds, forecast bunkable classes, and track assignments with private local browser storage.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">
                <span>View productivity tools</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Card 6: AI / Intelligence */}
            <Link
              href="/tools/ocr-pdf"
              className="group p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-cyan-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200/80 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-cyan-600 transition-colors">
                  Document Intelligence &amp; OCR
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Extract text from scanned PDFs and photos using optical character recognition, generate concise study summaries, and answer document questions.
                </p>
              </div>
              <div className="pt-2 flex items-center text-xs font-semibold text-cyan-600 group-hover:translate-x-1 transition-transform">
                <span>View document intelligence</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 3 — POPULAR / MOST USED TOOLS (Verified Directory)    */}
        {/* ============================================================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Essential Tools
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                Popular &amp; Frequently Used
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Fast browser-based tools used every day by students, developers, and working professionals.
              </p>
            </div>
            <Link
              href="/tools"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>Explore all {CANONICAL_TOOL_REGISTRY.length} tools</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {POPULAR_TOOL_KEYS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.key}
                  href={tool.route}
                  className="group p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3 cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center shadow-2xs">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {tool.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                    <span>Open tool</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 4 — "HOW SAARVI WORKS" (3–4 Simple Direct Steps)      */}
        {/* ============================================================== */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Simple by Design
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                How Saarvi works
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                No complicated tutorials, no manual installations. Complete your task in seconds.
              </p>
            </div>

            {/* Document Workflow: 4 Steps */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
                For Document &amp; File Conversions
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Step 1 */}
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 relative">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                    1
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Choose a tool</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pick a PDF, image, or document utility from the directory or search bar.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 relative">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                    2
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Add your file</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Drag and drop your file into the runner. Processing runs right in your browser.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 relative">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                    3
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Process the task</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Watch genuine live progress with zero fake timers or server upload queues.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 relative">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                    4
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Download result</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Save your converted file directly to your device with one click.
                  </p>
                </div>

              </div>
            </div>

            {/* Student Tools Workflow: 3 Steps */}
            <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
                For Student &amp; Academic Calculators
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-200/80 space-y-2">
                  <span className="text-xs font-bold text-purple-700">Step 1</span>
                  <h4 className="text-sm font-bold text-slate-900">Select your university &amp; scheme</h4>
                  <p className="text-xs text-slate-600">Syllabus credits, subjects, and grade scales load automatically.</p>
                </div>

                <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-200/80 space-y-2">
                  <span className="text-xs font-bold text-purple-700">Step 2</span>
                  <h4 className="text-sm font-bold text-slate-900">Enter CIE / SEE or total marks</h4>
                  <p className="text-xs text-slate-600">Flexible input adapts to your mark card format with passing rules enforced.</p>
                </div>

                <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-200/80 space-y-2">
                  <span className="text-xs font-bold text-purple-700">Step 3</span>
                  <h4 className="text-sm font-bold text-slate-900">Get deterministic SGPA / CGPA</h4>
                  <p className="text-xs text-slate-600">View exact credit points, percentage equivalence, and save locally.</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 5 — ACCESS EXPLANATION (Guest vs Free vs Pro)          */}
        {/* ============================================================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Clear &amp; Honest Access
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Access levels that make sense
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We never promise universal access or hide barriers. Tool availability is configured clearly by administration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Tier 1: Guest */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/90 space-y-5 shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Guest Visitor
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Zero Signup Required</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    For quick, everyday conversions and calculations.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All admin-enabled guest tools (PDF, Image, SGPA)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>In-browser local processing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Immediate download without an email</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/tools"
                className="w-full py-2.5 rounded-xl border border-slate-300 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
              >
                Try Guest Tools
              </Link>
            </div>

            {/* Tier 2: Free Account */}
            <div className="p-7 rounded-3xl bg-white border-2 border-blue-600/80 space-y-5 shadow-md relative flex flex-col justify-between">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                Recommended for Students
              </div>
              <div className="space-y-4 pt-1">
                <div className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Free Account
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Save Your Progress</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Free account configured by admin for personal workflow.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Resume Builder with multi-version storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Job tracker &amp; resume matching</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Conversion history across your devices</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/signup"
                className="w-full py-2.5 rounded-xl bg-blue-600 text-center text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
              >
                Create Free Account
              </Link>
            </div>

            {/* Tier 3: Pro Plan */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/90 space-y-5 shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Saarvi Pro
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Pro Power &amp; Limits</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    For power users requiring high batch volume and AI features.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Bypass Beta tool usage trial limits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Large batch conversions &amp; higher file limits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Advanced AI career copilot tokens</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/pricing"
                className="w-full py-2.5 rounded-xl border border-slate-300 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
              >
                View Pro Plans
              </Link>
            </div>

          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 6 — HONEST PRIVACY ARCHITECTURE                        */}
        {/* ============================================================== */}
        <section className="py-16 sm:py-20 bg-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Designed with Privacy in Mind
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Our honest privacy architecture
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                We believe in total transparency about where your data lives. We never claim &ldquo;nothing is ever uploaded&rdquo; unless technically true for the specific tool.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="p-6 rounded-3xl bg-slate-800/60 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Local-First Tools</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  PDF mergers, page splitters, image format converters, and GPA calculators run entirely inside your browser memory using WebAssembly. Your files never touch a server.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-800/60 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">No Cloud Storage of Files</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  For tools that genuinely require server processing (such as AI summarization or OCR), files are processed in ephemeral memory and discarded immediately after generation.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-800/60 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Account vs Document Data</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If you create an account, we store only your profile identity and settings. We never index your document content, resume bullet points, or marks in analytics.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 7 — STUDY • WORK • GROW VALUE FRAMEWORK               */}
        {/* ============================================================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              The Saarvi Framework
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              More than a PDF converter
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Saarvi is built around three pillars that support your learning, daily workflows, and long-term career.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Pillar 1: STUDY */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200/90 space-y-5 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-600 flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Pillar 1</span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">Study</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Master your academic life. Calculate accurate semester SGPA with verified syllabus credits, track 75% attendance limits, and organize course deliverables.
              </p>
              <ul className="space-y-2 text-xs font-medium text-slate-500 pt-2 border-t border-slate-100">
                <li>• Multi-University SGPA &amp; CGPA</li>
                <li>• Attendance Safety Margins</li>
                <li>• Syllabus Credit Tables</li>
              </ul>
            </div>

            {/* Pillar 2: WORK */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200/90 space-y-5 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Pillar 2</span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">Work</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Streamline document tasks. Compress, merge, split, and convert files between PDF, Word, Excel, and image formats with high fidelity and zero cloud friction.
              </p>
              <ul className="space-y-2 text-xs font-medium text-slate-500 pt-2 border-t border-slate-100">
                <li>• PDF ↔ Excel Table Extraction</li>
                <li>• Client-Side Compression &amp; Merging</li>
                <li>• Image Resizing &amp; Format Conversion</li>
              </ul>
            </div>

            {/* Pillar 3: GROW */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200/90 space-y-5 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Pillar 3</span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">Grow</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Advance your professional journey. Create ATS-friendly resumes, match your skills against job descriptions, and discover genuine internships without hidden fees.
              </p>
              <ul className="space-y-2 text-xs font-medium text-slate-500 pt-2 border-t border-slate-100">
                <li>• Instant Live Resume Builder</li>
                <li>• Job Match &amp; Skill Gap Analysis</li>
                <li>• Verified Jobs &amp; Internships</li>
              </ul>
            </div>

          </div>
        </section>

        {/* ============================================================== */}
        {/* FREQUENTLY ASKED QUESTIONS                                     */}
        {/* ============================================================== */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Clear answers about privacy, guest access, and file conversions.
            </p>
          </div>
          <FaqAccordion items={GLOBAL_FAQS} />
        </section>

        {/* ============================================================== */}
        {/* SECTION 8 — FINAL CALL TO ACTION (Zero-Friction Explore)      */}
        {/* ============================================================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-8 sm:p-14 text-white shadow-xl text-center space-y-6">
            <div className="max-w-2xl mx-auto space-y-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Start with a tool. No complicated setup.
              </h2>
              <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
                Open any tool, add your file, and get your work done. Free, private, and built for everyone.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                href="/tools"
                className="px-8 py-3.5 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition shadow-md hover:shadow-lg text-sm flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <span>Explore Saarvi</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/student/resume"
                className="px-8 py-3.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/40 text-white font-semibold transition border border-white/20 text-sm cursor-pointer min-h-[44px] flex items-center gap-2"
              >
                <span>Try Resume Builder</span>
              </Link>
            </div>

            <p className="text-[11px] text-blue-200">
              No credit card required • Instant access to guest tools • Private local processing
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
