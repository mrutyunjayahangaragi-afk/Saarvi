import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Lock, ShieldCheck, Database, EyeOff } from "lucide-react";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Privacy Policy",
  description: "Learn how Saarvi handles files, local browser memory, zero-cloud synchronization, and privacy-first local analytics.",
  path: "/privacy",
  keywords: ["privacy policy", "data privacy", "local file processing", "zero storage policy"],
});

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b1329] text-slate-900 dark:text-white">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">

        {/* Header */}
        <section className="space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Privacy Policy
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Last updated: September 11, 2026
            </p>
          </div>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            Saarvi is designed with privacy in mind. We aim to process your
            files as efficiently and privately as possible, using local
            browser processing whenever practical and secure server-side
            processing when a particular tool requires it.
          </p>
        </section>

        {/* Privacy Principles */}
        <section className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="p-5 bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mb-3" />

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Privacy-Conscious
            </h3>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              We prioritize privacy when designing and operating Saarvi.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <Database className="w-5 h-5 text-blue-600 mb-3" />

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Minimal Data
            </h3>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Basic tools are designed to work without requiring an account.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-[#111c38] border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <EyeOff className="w-5 h-5 text-slate-600 mb-3" />

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Data Selling
            </h3>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              We do not sell personal information to third parties.
            </p>
          </div>

        </section>

        {/* Policy Content */}
        <section className="mt-12 space-y-8 text-sm text-slate-600 leading-relaxed">

          {/* 1 */}
          <div className="space-y-3 border-t border-slate-200/80 dark:border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              1. Information Architecture & Local-First Philosophy
            </h2>

            <p>
              Saarvi is built around a <strong>local-first privacy architecture</strong>. There is a fundamental technical distinction between your private workspace data and limited server-side account data:
            </p>

            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <li>
                <strong>Local Private Workspace Data (Stored Locally in Browser):</strong> Your academic study notes, course marks, VTU SGPA/CGPA calculations, attendance records, study planners, class timetable, resumes, and processed document files are stored exclusively on your device using client-side <code>IndexedDB</code>. This data is never automatically synchronized to our servers and cannot be viewed or accessed by Saarvi administrators.
              </li>
              <li>
                <strong>Account & Operational Data (Server-Side):</strong> If you choose to register an account, limited identity data (email address, user identifier, and account tier) is managed securely via Supabase Auth.
              </li>
              <li>
                <strong>Local Preferences:</strong> Non-sensitive user interface preferences (such as auto-download toggles, active profile selection, and theme settings) are stored in client-side <code>localStorage</code>.
              </li>
            </ul>
          </div>

          {/* 2 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              2. How We Handle Your Files
            </h2>

            <p>
              Where technically practical, Saarvi processes files locally within your browser using WebAssembly and client-side JavaScript (including PDF-Lib, PDF.js, and client canvas utilities). In these cases, your documents are processed in your browser memory and never leave your computer.
            </p>

            <p>
              Certain advanced tools (such as optional AI document summaries or OCR text extraction) require external API processing. When you explicitly choose to use these tools, only the specific content required to fulfill the request is transmitted over encrypted TLS connections. We do not use your documents to train artificial intelligence models.
            </p>
          </div>

          {/* 3 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              3. File Retention & Zero Cloud Storage Policy
            </h2>

            <p>
              Saarvi does not maintain cloud storage buckets for your private documents, study notes, or marks sheets. When server-side processing is invoked for temporary operations, payloads are processed in volatile memory and immediately discarded.
            </p>

            <p>
              Because your workspace is local-first, you are encouraged to export your workspace backups regularly from your Settings page. Saarvi cannot recover lost documents if your browser storage or device is cleared.
            </p>
          </div>

          {/* 4 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              4. Authentication & Google OAuth User Data Policy
            </h2>

            <p>
              You can explore basic document tools without creating an account. When you choose to sign up or log in using Google OAuth, authentication is securely handled using Supabase Auth (using standard PKCE flow and <code>prompt: select_account</code>).
            </p>

            <p>
              <strong>Google User Data Collected:</strong> We access only non-sensitive basic profile information explicitly granted during sign-in: your primary Google email address, your display name, and your avatar URL. We never access, store, or receive your Google account password, Google Drive files, contacts, or Gmail messages.
            </p>

            <p>
              <strong>Purpose & Use of Google Data:</strong> Google user data is used exclusively to authenticate your identity, create your unique user profile, and deliver transactional account notifications.
            </p>

            <p>
              <strong>Google API Services User Data Policy Compliance:</strong> Saarvi&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 hover:text-blue-700 underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>

            <p>
              <strong>No Sharing or AI Training:</strong> We do not sell, lease, or transfer Google user data to data brokers, advertisers, or third-party marketing services. Google user data is never used to develop, improve, or train generalized machine learning or artificial intelligence models.
            </p>
          </div>

          {/* 5 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              5. Transactional Messaging (Email Reminders)
            </h2>

            <p>
              Registered students may opt into transactional email reminders for study tasks and assignment deadlines. These messages are dispatched via our server-side Gmail SMTP provider.
            </p>

            <p>
              Notification payloads contain only minimum operational data (task title, scheduled reminder timestamp). We never include private document text or sensitive personal records in notification dispatches. Email addresses are never sold or used for unsolicited commercial marketing.
            </p>
          </div>

          {/* 6 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              6. Payments & Billing Data
            </h2>

            <p>
              Paid Saarvi Pro subscriptions (₹99 monthly or ₹899 yearly) are processed securely by <strong>Razorpay Software Private Limited</strong>.
            </p>

            <p>
              Saarvi servers never collect, process, or store credit card numbers, debit card details, CVVs, UPI PINs, or net banking passwords. Payment transactions occur directly within Razorpay's PCI-DSS Level 1 certified checkout environment. Saarvi retains only server-authoritative subscription status identifiers and transaction receipt IDs for billing entitlement verification.
            </p>
          </div>

          {/* 7 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              7. Optional AI & OCR Processing Disclosures
            </h2>

            <p>
              Saarvi offers optional AI assistance powered by Google Gemini and OpenRouter. Use of AI features is strictly voluntary and requires user initiation.
            </p>

            <p>
              AI is strictly forbidden from overriding or substituting deterministic academic algorithms: all VTU SGPA, CGPA, marks cutoffs, passing rules, and timetable collision detections are executed via transparent, verifiable mathematical code, never by generative language models.
            </p>
          </div>

          {/* 8 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              8. Cookies & Storage Technologies
            </h2>

            <p>
              Saarvi uses cookies strictly necessary for authentication session persistence (SameSite, Secure, HttpOnly where applicable) and route security. We do not deploy intrusive third-party cross-site advertising trackers.
            </p>
          </div>

          {/* 9 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              9. Privacy-Safe Telemetry & Observability
            </h2>

            <p>
              Our internal monitoring records aggregate operational metrics (endpoint latencies, provider status, anonymized error codes) to maintain platform stability. Telemetry strictly redacts authorization tokens, passwords, document contents, and search queries. Users can opt out of client analytics at any time.
            </p>
          </div>

          {/* 10 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              10. Admin Operational Boundaries
            </h2>

            <p>
              Platform administrators have access only to high-level operational health metrics (e.g., aggregate notification delivery rates, system error counts, tool availability flags). Administrators have zero visibility into any student's private study notes, academic grades, marks, or personal documents.
            </p>
          </div>

          {/* 11 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              11. Account Deletion & Data Subject Rights
            </h2>

            <p>
              You have the right to delete your account at any time via your Profile Settings. Account deletion immediately removes your identity and subscription records from our authentication database, and provides a one-click purge of all local IndexedDB workspace data stored on your device.
            </p>
          </div>

          {/* 12 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              12. Contact Information
            </h2>

            <p>
              If you have questions or concerns about this Privacy Policy or your data, contact our privacy and support team at{" "}
              <a
                href="mailto:saarvinotifications@gmail.com"
                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                saarvinotifications@gmail.com
              </a>
              .
            </p>
          </div>

          {/* Disclaimer */}
          <div className="border-t border-slate-200/80 dark:border-slate-800 pt-6">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This Privacy Policy is provided for general informational
              purposes and should be reviewed and adapted by a qualified legal
              professional to reflect Saarvi's actual data practices,
              services, business structure, and applicable laws.
            </p>
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
}
