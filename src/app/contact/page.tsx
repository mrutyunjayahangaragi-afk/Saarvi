import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Mail, MessageSquare, ExternalLink } from "lucide-react";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Contact & Support",
  description: "Get in touch with the Saarvi team for support, feature suggestions, technical questions, and platform feedback.",
  path: "/contact",
  keywords: ["contact saarvi", "customer support", "feedback", "help desk"],
});

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">

        {/* Hero */}
        <section className="text-center max-w-2xl mx-auto space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/70 text-blue-600 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Contact Us
          </h1>

          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            Have a question, feedback, or a suggestion for a new tool?
            We would love to hear from you.
          </p>
        </section>

        {/* Contact Channels */}
        <section className="mt-12 max-w-2xl mx-auto space-y-4">
          <div className="p-7 sm:p-9 bg-white border border-slate-200/80 rounded-3xl shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 shrink-0 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>

              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">
                  Direct Support Channels
                </h2>
                <p className="text-xs text-slate-500">
                  Our team provides direct support for student utilities, authentication, and billing.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  User & Technical Support
                </span>
                <a
                  href="mailto:support@saarvi.app"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors break-all"
                >
                  support@saarvi.app
                </a>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  General & Administrative
                </span>
                <a
                  href="mailto:contact@saarvi.app"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors break-all"
                >
                  contact@saarvi.app
                </a>
              </div>
            </div>

            <p className="mt-5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              When reporting technical issues, please include the tool name, browser version, and any error message displayed. Please do <strong>not</strong> attach private or sensitive personal documents in emails.
            </p>
          </div>
        </section>

        {/* Support & Troubleshooting Hub */}
        <section className="mt-12 max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-slate-900">
              Support & Troubleshooting Guide
            </h2>
            <p className="text-xs text-slate-500">
              Frequently encountered questions and self-service resolutions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Auth */}
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Authentication & Google Login
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                If Google sign-in closes unexpectedly, ensure pop-up blockers allow <code>saarvi.app</code>. Saarvi utilizes Google's account chooser prompt (<code>select_account</code>) so you can easily choose your preferred student or personal Google account.
              </p>
            </div>

            {/* Password */}
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Password Reset & Verification
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Password recovery links are dispatched from <code>support@saarvi.app</code> via Supabase Auth. If you do not see the email within two minutes, check your spam folder or trigger a new link from the <a href="/forgot-password" className="text-blue-600 font-semibold hover:underline">Forgot Password</a> page.
              </p>
            </div>

            {/* Payments */}
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Billing & Pro Subscriptions
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pro subscriptions (₹99/mo or ₹899/yr) activate instantly upon Razorpay payment confirmation. You can manage or cancel your subscription at any time directly in your Billing Dashboard. We never store credit cards or banking credentials.
              </p>
            </div>

            {/* Local Privacy */}
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Local Storage & Workspace Backup
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Saarvi stores your notes, course marks, and timetable locally in your browser's IndexedDB. To preserve your data across devices or before clearing browser history, use the Export Workspace button in your Settings page.
              </p>
            </div>
          </div>
        </section>

        {/* Developer */}
        <section className="mt-14 pt-8 border-t border-slate-200/80 text-center">
          <p className="text-xs text-slate-500">
            Saarvi is an independent project created by{" "}
            <span className="font-semibold text-slate-700">
              Mrutyunjaya Hangaragi
            </span>
            .
          </p>

          <a
            href="https://mrutyunjaya-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Visit Developer Portfolio
            <ExternalLink className="w-3 h-3" />
          </a>
        </section>

      </main>

      <Footer />
    </div>
  );
}