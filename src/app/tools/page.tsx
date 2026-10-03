import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ToolsCatalogClient from "@/components/tools/ToolsCatalogClient";
import { TOOLS_CONFIG } from "@/config/tools";
import { createMetadata } from "@/lib/seo/metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/structured-data";
import { ChevronRight } from "lucide-react";

export const metadata: Metadata = createMetadata({
  title: "Saarvi Tools — Free Online Document, Academic & Career Utilities",
  description: "Find the tool you need and get the task done. Fast, browser-based PDF converters, image tools, compressors, and student calculators with private local processing.",
  path: "/tools",
  keywords: [
    "saarvi tools",
    "all tools",
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-[#0b1329] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">Tools</span>
        </nav>

        {/* Page Heading (Requirements Part 6 & Part 28) */}
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Saarvi Tools
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Find the tool you need and get the task done.
          </p>
        </div>

        {/* Simplified Tools UX & Searchable Tool Collection */}
        <section aria-label="Tool directory">
          <ToolsCatalogClient initialTools={TOOLS_CONFIG} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
