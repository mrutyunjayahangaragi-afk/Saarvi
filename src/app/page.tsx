import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import CommandSearch from "@/components/tools/CommandSearch";
import CategoryExplorer from "@/components/home/CategoryExplorer";
import ToolCard from "@/components/tools/ToolCard";
import FaqAccordion, { GLOBAL_FAQS } from "@/components/common/FaqAccordion";
import { TOOLS_CONFIG } from "@/config/tools";
import { createMetadata } from "@/lib/seo/metadata";
import { generateWebSiteSchema, generateFaqSchema } from "@/lib/seo/structured-data";
import {
  ArrowRight,
  Lock,
  Zap,
  UserCheck,
  FileText,
  Layers,
  GraduationCap,
  Camera,
  Sparkles
} from "lucide-react";

export const metadata: Metadata = createMetadata({
  title: "Saarvi — Study. Work. Grow.",
  description: "Convert, compress and manage documents with fast, private browser-based tools designed for students and everyday users.",
  path: "/",
  keywords: [
    "free pdf tools",
    "jpg to pdf",
    "compress pdf",
    "merge pdf",
    "vtu sgpa calculator",
    "private document converter",
  ],
});

export default function HomePage() {
  const websiteSchema = generateWebSiteSchema();
  const faqSchema = generateFaqSchema(GLOBAL_FAQS);
  // Exact 5 popular tools required by Section 13
  const popularSlugs = [
    "jpg-to-pdf",
    "pdf-to-jpg",
    "compress-pdf",
    "merge-pdf",
    "image-resize"
  ];
  const popularTools = popularSlugs
    .map((slug) => TOOLS_CONFIG.find((t) => t.slug === slug))
    .filter((t): t is (typeof TOOLS_CONFIG)[0] => Boolean(t));

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      {/* Search Engine Structured Data */}
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

      <main className="flex-1 space-y-16 sm:space-y-24">
        {/* 1. HERO SECTION (Exact Left Copy + Right 3D Floating Document Stack) */}
        <HeroSection />

        {/* 2. COMMAND-STYLE SEARCH EXPERIENCE (Cmd+K / Real Results) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 relative z-20">
          <CommandSearch />
        </section>

        {/* 3. POPULAR TOOLS SECTION (Exact 5 tools with subtle 3D hover depth) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Popular tools
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Fast, browser-based utilities used every day by students and professionals.
              </p>
            </div>
            <Link
              href="/tools"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 group self-start sm:self-auto cursor-pointer"
            >
              <span>View all {TOOLS_CONFIG.length} tools</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {popularTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} featured={true} />
            ))}
          </div>
        </section>

        {/* 4. CATEGORY SECTION (Visually distinct tabs: All, PDF, Images, Student) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Browse by category
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Filter tools by document format or academic workflow.
            </p>
          </div>

          <CategoryExplorer tools={TOOLS_CONFIG} />
        </section>

        {/* 5. STUDENT SECTION ("Built for student life") */}
        <section className="py-16 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Academic Utilities</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Built for student life
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tailored utilities designed to eliminate paperwork friction for assignments, applications, and study notes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* 1. Resume Builder */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 space-y-5 hover-3d-lift shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Resume Builder
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ATS-friendly student resume generator with structured education modules and direct vector PDF export.
                  </p>
                </div>

                {/* Subtle Visual Concept: Miniature Resume Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 shadow-2xs">
                  <div className="h-2 w-1/3 bg-blue-600 rounded-full" />
                  <div className="h-1.5 w-full bg-slate-200 rounded-full" />
                  <div className="h-1.5 w-4/5 bg-slate-200 rounded-full" />
                </div>
              </div>

              {/* 2. ID Photo Utility */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 space-y-5 hover-3d-lift shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      ID Photo Utility
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Standard passport and college exam photo cropping with biometric alignment guides and printable grid layouts.
                  </p>
                </div>

                {/* Subtle Visual Concept: ID Frame */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-300 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                      35x45
                    </div>
                    <span className="text-[11px] font-medium text-slate-600">
                      Biometric passport spec
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Notes to PDF */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 space-y-5 hover-3d-lift shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Notes to PDF
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Clean up photos of handwritten notebooks and whiteboards into high-contrast, compact study PDFs.
                  </p>
                </div>

                {/* Subtle Visual Concept: Lined Paper */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 shadow-2xs">
                  <div className="h-1.5 w-2/3 bg-amber-200/80 rounded-full" />
                  <div className="h-1.5 w-full bg-amber-200/60 rounded-full" />
                  <div className="h-1.5 w-1/2 bg-amber-200/50 rounded-full" />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 6. HOW IT WORKS (3-step flow connected with subtle line) */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              How Saarvi Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Three clean steps from source file to processed download.
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Connecting Visual Line (hidden on mobile) */}
            <div
              className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-[2px] bg-slate-200 -translate-y-6 z-0"
              aria-hidden="true"
            />

            {/* Step 1 */}
            <div className="relative z-10 p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 space-y-4 text-center hover-3d-lift shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center mx-auto shadow-md">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Choose a tool
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Select from our suite of PDF converters, image resizers, and document utilities.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 space-y-4 text-center hover-3d-lift shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center mx-auto shadow-md">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Upload your file
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Drag and drop your file into the browser. Documents stay in your local memory.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 space-y-4 text-center hover-3d-lift shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center mx-auto shadow-md">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Download your result
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Receive your converted document with instant 3-second automatic download.
              </p>
            </div>
          </div>
        </section>

        {/* 7. PRIVACY & BENEFIT CARDS (3D Shield + 4 Benefit Cards: Private, Fast, Simple, Free) */}
        <section className="py-16 bg-white border-y border-slate-200/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 text-center">
            
            {/* 3D Shield / Document Visual */}
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/15 blur-xl animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-md">
                <Lock className="w-7 h-7" />
              </div>
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Your documents stay yours
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                For supported browser-based tools, Saarvi processes files directly on your device, reducing unnecessary uploads.
              </p>
            </div>

            {/* BENEFIT CARDS: Private, Fast, Simple, Free (Section 35) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
              
              {/* Private */}
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover-3d-lift shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Private</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supported tools process files locally in your browser memory without transmitting bytes across remote servers.
                </p>
              </div>

              {/* Fast */}
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover-3d-lift shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Fast</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No unnecessary upload/download round trip for local tools. Processing executes at your hardware&apos;s full speed.
                </p>
              </div>

              {/* Simple */}
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover-3d-lift shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Simple</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No account is required for basic tools. Open any utility, process your file, and get your result immediately.
                </p>
              </div>

              {/* Free */}
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover-3d-lift shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Free</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Core tools are currently free to use with no hidden fees or payment systems required.
                </p>
              </div>

            </div>

            {/* Clear differentiation between local and future server services */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 max-w-2xl mx-auto">
              Future advanced capabilities that require cloud compute (e.g. AI summaries or deep OCR) will always be explicitly labeled as server-side before you upload.
            </div>
          </div>
        </section>

        {/* 8. FAQ SECTION (5 Exact Questions) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FaqAccordion />
        </section>
      </main>

      <Footer />
    </div>
  );
}
