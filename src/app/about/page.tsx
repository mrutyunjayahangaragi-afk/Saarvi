import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SITE_CONFIG } from "@/config/site";
import {
  CheckCircle2,
  Shield,
  HeartHandshake,
  Zap,
  ExternalLink,
  FileText,
} from "lucide-react";

import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "About Us",
  description: "Learn about Saarvi, our privacy-first philosophy, local browser execution architecture, and commitment to student and everyday productivity.",
  path: "/about",
  keywords: ["about saarvi", "privacy-first pdf tools", "client-side processing", "student utilities mission"],
});

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">

        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/70 text-blue-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            About {SITE_CONFIG.name}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {SITE_CONFIG.tagline}
          </p>

          <p className="text-sm text-slate-500 leading-relaxed max-w-2xl mx-auto">
            Simple, fast, and accessible document utilities designed for
            students, job seekers, developers, and everyday users.
          </p>
        </section>

        {/* Mission */}
        <section className="mt-16 max-w-4xl mx-auto space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Our Mission
            </p>

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Document tasks should be simple.
            </h2>
          </div>

          <div className="space-y-4 text-sm sm:text-base text-slate-600 leading-relaxed">
            <p>
              Every day, students, job seekers, and everyday internet users
              need to perform basic document tasks — convert an image to PDF,
              extract pages, compress a file for an application, or prepare
              documents for academic and professional use.
            </p>

            <p>
              These tasks should not require complicated software, unnecessary
              account creation, or expensive subscriptions.{" "}
              {SITE_CONFIG.name} is designed to provide focused web utilities
              that help users complete everyday document tasks quickly and
              easily.
            </p>

            <p>
              Our goal is simple:{" "}
              <span className="font-semibold text-slate-800">
                give you the tool you need, let you complete your task, and get
                out of your way.
              </span>
            </p>
          </div>
        </section>

        {/* Core Values */}
        <section className="mt-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

            {/* Privacy */}
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl space-y-4 shadow-sm hover-3d-lift">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Privacy-Conscious
                </h3>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Whenever practical, files are processed locally in your
                  browser to help keep personal documents private.
                </p>
              </div>
            </div>

            {/* Guest Friendly */}
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl space-y-4 shadow-sm hover-3d-lift">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Guest Friendly
                </h3>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Basic document tools are designed to work without forcing
                  users through unnecessary login or registration steps.
                </p>
              </div>
            </div>

            {/* Student Focused */}
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl space-y-4 shadow-sm hover-3d-lift">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center">
                <HeartHandshake className="w-5 h-5" />
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Student-Focused
                </h3>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Built around practical document needs such as assignments,
                  certificates, resumes, applications, and academic work.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* What You Can Do */}
        <section className="mt-16">
          <div className="space-y-2 mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              What You Can Do
            </p>

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Practical tools for everyday files.
            </h2>

            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Saarvi focuses on useful document operations without adding
              unnecessary complexity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              "Image to PDF",
              "PDF to Image",
              "Image Format Conversion",
              "PDF Page Extraction",
              "Document Compression",
              "Resume & Application Utilities",
            ].map((tool) => (
              <div
                key={tool}
                className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-slate-700">
                  {tool}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Explore all tools
              <Zap className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Built By */}
        <section className="mt-16 p-7 sm:p-9 bg-white border border-slate-200/80 rounded-3xl shadow-sm">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Built by a Developer
            </p>

            <h2 className="text-2xl font-bold text-slate-900">
              Created by Mrutyunjaya Hangaragi
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
              Saarvi is an independent project created by Mrutyunjaya
              Hangaragi, a Computer Science Engineering student and developer
              interested in building practical web applications and solving
              real-world problems through technology.
            </p>

            <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
              The project is built around a simple principle: create useful
              software that people can understand and use immediately.
            </p>

            <a
              href="https://mrutyunjaya-portfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Visit Portfolio
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className="mt-16 pt-8 border-t border-slate-200/80"
        >
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Contact
            </p>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Have a question or suggestion?
            </h2>

            <p className="text-sm text-slate-500 leading-relaxed">
              We&apos;d love to hear your feedback. Contact us at{" "}
              <a
                href="mailto:saarvinotifications@gmail.com"
                className="font-semibold text-slate-700 hover:text-blue-600 transition-colors"
              >
                saarvinotifications@gmail.com
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
