import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FaqAccordion from "@/components/common/FaqAccordion";
import { getBlogPostBySlug, BLOG_POSTS } from "@/config/blog-data";
import { createMetadata } from "@/lib/seo/metadata";
import {
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFaqSchema,
} from "@/lib/seo/structured-data";
import {
  ChevronRight,
  Clock,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Lock,
  Wrench,
  ExternalLink
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return createMetadata({
      title: "Tutorial Not Found",
      description: "Requested tutorial was not found.",
      path: `/blog/${slug}`,
      noIndex: true,
    });
  }

  return createMetadata({
    title: post.metaTitle,
    description: post.metaDescription,
    path: `/blog/${slug}`,
    keywords: [
      post.title.toLowerCase(),
      post.category.toLowerCase(),
      "document tutorial",
      "free online tool",
    ],
    ogType: "article",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const articleSchema = generateArticleSchema({
    title: post.title,
    description: post.metaDescription,
    slug: post.slug,
    datePublished: post.datePublished,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Guides & Tutorials", url: "/blog" },
    { name: post.title, url: `/blog/${post.slug}` },
  ]);

  const faqSchema = post.faq && post.faq.length > 0 ? generateFaqSchema(post.faq) : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 text-slate-900">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
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

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 space-y-10">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/blog" className="hover:text-blue-600 transition-colors">
            Guides
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800 line-clamp-1">{post.title}</span>
        </nav>

        {/* Article Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {post.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Published: {post.datePublished}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {post.readTime}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {post.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            {post.introduction}
          </p>
        </header>

        {/* PROMINENT DIRECT TOOL CTA CARD */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Recommended Free Tool
            </span>
            <h3 className="text-base font-bold text-slate-900">{post.toolName}</h3>
            <p className="text-xs text-slate-600">
              Fast, in-browser execution with zero cloud uploads.
            </p>
          </div>

          <Link
            href={post.toolRoute}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-2 group whitespace-nowrap self-start sm:self-auto min-h-[44px]"
          >
            <span>{post.ctaText}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Why this matters */}
        {post.whyItMatters && (
          <section className="space-y-3 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">Why this matters</h2>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
              {post.whyItMatters.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Step by step procedure */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Step-by-Step Instructions</h2>
          <div className="space-y-4">
            {post.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-2 shadow-xs"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Highlight */}
        <section className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
          <Lock className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-emerald-800 text-sm">Privacy Guarantee</h4>
            <p className="leading-relaxed text-emerald-800/90 font-normal">
              Saarvi processes supported files strictly inside your web browser. Documents are never uploaded to our servers, keeping personal identification, financial statements, and coursework secure.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        {post.faq && post.faq.length > 0 && (
          <section className="pt-4 border-t border-slate-200/80">
            <FaqAccordion
              items={post.faq}
              title="Frequently Asked Questions"
              description="Common questions about this document workflow."
            />
          </section>
        )}

        {/* Back Link */}
        <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs">
          <Link
            href="/blog"
            className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
          >
            ← Back to all guides
          </Link>

          <Link
            href={post.toolRoute}
            className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
          >
            Open {post.toolName} →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
