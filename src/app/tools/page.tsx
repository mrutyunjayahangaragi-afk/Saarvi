import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ToolsCatalogClient from "@/components/tools/ToolsCatalogClient";
import { TOOLS_CONFIG } from "@/config/tools";
import { CANONICAL_TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import { createMetadata } from "@/lib/seo/metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/structured-data";
import {
  FileText,
  FileImage,
  GraduationCap,
  Briefcase,
  Cpu,
  ChevronRight,
  ArrowRight
} from "lucide-react";

export const metadata: Metadata = createMetadata({
  title: "All Tools — Free Online PDF, Image & Document Utilities | Saarvi",
  description: "Explore the complete directory of browser-based PDF converters, image tools, compressors, and student calculators. Fast, simple, and private local processing.",
  path: "/tools",
  keywords: [
    "pdf tools",
    "image converter",
    "online pdf compressor",
    "merge pdf",
    "split pdf",
    "jpg to pdf",
    "pdf to jpg",
    "sgpa calculator",
    "free document tools"
  ],
});

export default function ToolsPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Tools", url: "/tools" },
  ]);

  const pdfTools = CANONICAL_TOOL_REGISTRY.filter((t) => t.category === "pdf");
  const imageTools = CANONICAL_TOOL_REGISTRY.filter((t) => t.category === "image");
  const studentTools = CANONICAL_TOOL_REGISTRY.filter((t) => t.category === "academic" || t.category === "student");
  const careerTools = CANONICAL_TOOL_REGISTRY.filter((t) => t.category === "career");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-[#0b1329] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">All Tools</span>
        </nav>

        {/* Page Heading */}
        <div className="space-y-3 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tools for study, work and everyday tasks
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            Fast, private utilities for document conversions, academic calculations, image formatting, and career growth. In-browser local processing with no account required for guest tools.
          </p>
        </div>

        {/* Interactive Search & Live Filter Section */}
        <section aria-label="Tool search and filtering">
          <ToolsCatalogClient initialTools={TOOLS_CONFIG} />
        </section>

        {/* Structured Category Hubs & Dedicated Workspaces */}
        <section className="space-y-12 pt-8 border-t border-slate-200/80 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Explore by Category
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                Dedicated category workspaces and quick links to every specialized converter, compressor, and student calculator.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <Link href="/pdf" className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                PDF Workspace
              </Link>
              <Link href="/images" className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors">
                Image Workspace
              </Link>
              <Link href="/student-tools" className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors">
                Student Workspace
              </Link>
            </div>
          </div>

          {/* 1. PDF Tools */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3>PDF Tools</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {pdfTools.length} utilities
                </span>
              </div>
              <Link href="/pdf" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1">
                <span>View all PDF tools</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
              {pdfTools.map((t) => (
                <Link
                  key={t.key}
                  href={t.route}
                  className="p-3.5 bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xs transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                      {t.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {t.description}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          </div>

          {/* 2. Image Tools */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <FileImage className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3>Image Tools</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {imageTools.length} utilities
                </span>
              </div>
              <Link href="/images" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1">
                <span>View all Image tools</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
              {imageTools.map((t) => (
                <Link
                  key={t.key}
                  href={t.route}
                  className="p-3.5 bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xs transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block">
                      {t.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {t.description}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          </div>

          {/* 3. Student & Academic Tools */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3>Academic & Student Tools</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {studentTools.length} utilities
                </span>
              </div>
              <Link href="/student-tools" className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline flex items-center gap-1">
                <span>View all Student tools</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
              {studentTools.map((t) => (
                <Link
                  key={t.key}
                  href={t.route}
                  className="p-3.5 bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-xs transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors block">
                      {t.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {t.description}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          </div>

          {/* 4. Career Tools */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3>Career & Resume Tools</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {careerTools.length} utilities
                </span>
              </div>
              <Link href="/jobs" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline flex items-center gap-1">
                <span>Explore Jobs & Internships</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
              {careerTools.map((t) => (
                <Link
                  key={t.key}
                  href={t.route}
                  className="p-3.5 bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-xs transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors block">
                      {t.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {t.description}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
