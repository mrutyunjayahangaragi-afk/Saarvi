import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getToolBySlug, TOOLS_CONFIG } from "@/config/tools";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ToolCard from "@/components/tools/ToolCard";
import FaqAccordion from "@/components/common/FaqAccordion";
import ToolRunner from "@/components/tools/ToolRunner";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import { createMetadata } from "@/lib/seo/metadata";
import { featureServerStore } from "@/lib/features/feature-store";
import {
  generateToolSchema,
  generateBreadcrumbSchema,
  generateFaqSchema,
} from "@/lib/seo/structured-data";
import {
  ChevronRight,
  Cpu,
  Lock,
  UserCheck,
  Tag,
  Layers,
  FileImage,
  FileType,
  FileText,
  FileOutput,
  FileInput,
  RefreshCw,
  Repeat,
  Image as ImageIcon,
  Combine,
  Scissors,
  FileDown,
  Maximize2,
  Camera,
  GraduationCap,
  Sparkles,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Table,
  Unlock,
  Stamp,
  ListOrdered,
  Heading,
  Tags,
  Info,
  Scan,
  FileCheck
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  FileImage,
  FileType,
  FileText,
  FileOutput,
  FileInput,
  RefreshCw,
  Repeat,
  Image: ImageIcon,
  Layers,
  Combine,
  Scissors,
  FileDown,
  Maximize2,
  Camera,
  GraduationCap,
  Sparkles,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Table,
  Lock,
  Unlock,
  Stamp,
  ListOrdered,
  Heading,
  Tags,
  Info,
  Scan,
  FileCheck
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return TOOLS_CONFIG.map((tool) => ({
    slug: tool.slug
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return createMetadata({
      title: "Tool Not Found",
      description: "Requested document utility was not found.",
      path: `/tools/${slug}`,
      noIndex: true,
    });
  }

  return createMetadata({
    title: tool.name,
    description: tool.detailedDescription || tool.description,
    path: tool.route || `/tools/${slug}`,
    keywords: tool.keywords || [],
  });
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const feature = featureServerStore.getFeature(tool.id) || featureServerStore.getFeature(slug);
  const isDisabled = feature?.status === "DISABLED";
  const isMaintenance = feature?.status === "MAINTENANCE";

  const IconComponent = ICON_MAP[tool.icon] || FileImage;

  // Find related tools by slug
  const relatedTools = (tool.relatedSlugs || [])
    .map((s) => getToolBySlug(s))
    .filter((t): t is typeof tool => Boolean(t));

  const toolSchema = generateToolSchema(tool);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Tools", url: "/tools" },
    { name: tool.name, url: tool.route || `/tools/${slug}` },
  ]);
  const faqSchema = tool.faq && tool.faq.length > 0 ? generateFaqSchema(tool.faq) : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      {/* Search Engine Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-10">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/tools" className="hover:text-blue-600 transition-colors">
            Tools
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">{tool.name}</span>
        </nav>

        {/* TOOL PAGE HERO: Do not waste top of page - immediately present tool, purpose, and privacy badge */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-xs hover-3d-lift">
            <IconComponent className="w-7 h-7" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {tool.name}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            {tool.detailedDescription || tool.description}
          </p>

          <div className="flex justify-center pt-1">
            <PrivacyBadge mode={tool.privacyLevel === "external" ? "EXTERNAL" : "LOCAL"} />
          </div>
        </div>

        {/* Upload Area / File Selection Component (Visual Center) */}
        <section className="pt-2">
          {isDisabled ? (
            <div className="p-8 rounded-3xl border border-red-200 bg-red-50/60 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-800">
                  {tool.name} is Temporarily Unavailable
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This tool has been temporarily disabled by platform administrators. Please check back soon or explore our other available tools.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs hover-3d-lift"
                >
                  <span>Explore Other Tools</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : isMaintenance ? (
            <div className="p-8 rounded-3xl border border-amber-200 bg-amber-50/60 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-800">
                  {tool.name} Under Maintenance
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We are currently performing scheduled maintenance on this tool. It will be back online shortly.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs hover-3d-lift"
                >
                  <span>Browse Available Tools</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : tool.status !== "coming_soon" ? (
            <ToolRunner tool={tool} />
          ) : (
            <div className="p-8 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/50 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-800">
                  {tool.name} is Scheduled for Phase 3
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We are developing this specialized utility for the next platform release. Phase 2 prioritizes real, working core document & image transformations without simulated placeholders.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs hover-3d-lift"
                >
                  Explore available tools
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Tool Information & Specifications with Subtle 3D Card Surface */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-200/80">
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1 hover-3d-lift">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              Processing
            </div>
            <p className="text-xs font-bold text-slate-900">In your browser</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1 hover-3d-lift">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Privacy
            </div>
            <p className="text-xs font-bold text-slate-900">No server upload</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1 hover-3d-lift">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <UserCheck className="w-3.5 h-3.5 text-purple-600" />
              Account
            </div>
            <p className="text-xs font-bold text-slate-900">Not required</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1 hover-3d-lift">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Tag className="w-3.5 h-3.5 text-amber-600" />
              Cost
            </div>
            <p className="text-xs font-bold text-slate-900">Free</p>
          </div>
        </section>

        {/* How It Works Section */}
        {tool.howItWorks && tool.howItWorks.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-slate-200/80">
            <h2 className="text-lg font-bold text-slate-900">How to use {tool.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {tool.howItWorks.map((step, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-2.5 shadow-xs hover-3d-lift"
                >
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs border border-blue-200/60">
                    {idx + 1}
                  </div>
                  <p className="text-slate-600 leading-relaxed font-medium">{step}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Tools Section (Section 30: "You may also need") */}
        {relatedTools.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-slate-200/80">
            <h2 className="text-xl font-bold text-slate-900">You may also need</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedTools.slice(0, 3).map((rt) => (
                <ToolCard key={rt.id} tool={rt} />
              ))}
            </div>
          </section>
        )}

        {/* FAQ Section */}
        {tool.faq && tool.faq.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-slate-200/80">
            <FaqAccordion
              items={tool.faq}
              title={`Frequently Asked Questions: ${tool.name}`}
              description="Common questions about this specific utility."
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
