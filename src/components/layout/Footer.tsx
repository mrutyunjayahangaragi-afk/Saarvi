"use client";

import Link from "next/link";
import { Shield, ExternalLink, Mail } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";
import { SaarviMark } from "@/components/brand/SaarviLogo";
import { usePlatform } from "@/context/PlatformContext";
import { useFeedback } from "@/context/FeedbackContext";

export default function Footer() {
  const { appName, tagline, supportEmail } = usePlatform();
  const { openFeedback } = useFeedback();

  return (
    <footer className="w-full bg-slate-100/70 text-slate-600 text-xs border-t border-slate-200/90 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">

        {/* Main Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-slate-200">

          {/* Brand */}
          <div className="space-y-3 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-slate-900 group w-fit"
              aria-label="Saarvi Home"
            >
              <SaarviMark size={32} className="group-hover:scale-105 transition-transform" />

              <span className="text-base font-extrabold tracking-tight">
                {appName || SITE_CONFIG.name}
              </span>
            </Link>

            <p className="text-slate-700 text-xs font-semibold leading-relaxed max-w-xs">
              {tagline || "Saarvi — Study. Work. Grow."}
            </p>

            <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs">
              Private by design. Fast by design. Simple by design.
            </p>
          </div>

          {/* Product & Tools */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Tools & Directory
            </h4>

            <ul className="space-y-2">
              <li>
                <Link
                  href="/tools"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  All Tools
                </Link>
              </li>

              <li>
                <Link
                  href="/tools/pdf-to-jpg"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  PDF to JPG
                </Link>
              </li>

              <li>
                <Link
                  href="/tools/compress-pdf"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Compress PDF
                </Link>
              </li>

              <li>
                <Link
                  href="/student"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Student Tools
                </Link>
              </li>

              <li>
                <Link
                  href="/student/resume"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Career & Resume
                </Link>
              </li>

              <li>
                <Link
                  href="/jobs"
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors flex items-center gap-1"
                >
                  <span>Jobs &amp; Internships</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">New</span>
                </Link>
              </li>

              <li>
                <Link
                  href="/blog"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Guides & Tutorials
                </Link>
              </li>

              <li>
                <Link
                  href="/pricing"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Plans & Features
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Company
            </h4>

            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  About
                </Link>
              </li>

              <li>
                <Link
                  href="/contact"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Contact Us
                </Link>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => openFeedback()}
                  className="text-slate-600 hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Share Your Feedback
                </button>
              </li>

              <li>
                <a
                  href="mailto:saarvinotifications@gmail.com"
                  className="text-slate-500 hover:text-blue-600 transition-colors text-[11px] block break-all"
                  title="Official Contact Email"
                >
                  saarvinotifications@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Legal
            </h4>

            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Privacy
                </Link>
              </li>

              <li>
                <Link
                  href="/terms"
                  className="text-slate-600 hover:text-blue-600 transition-colors"
                >
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-7 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">

          {/* Copyright + Portfolio */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1">
            <span>{SITE_CONFIG.copyright}</span>

            <span className="text-slate-300">•</span>

            <a
              href="https://mrutyunjaya-portfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-semibold transition-colors"
            >
              Built by Mrutyunjaya Hangaragi
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Privacy / Trust */}
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Private browser processing • No login required</span>
          </div>

        </div>
      </div>
    </footer>
  );
}