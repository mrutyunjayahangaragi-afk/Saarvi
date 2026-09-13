import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Terms of Service",
  description: "Terms and conditions governing the use of Saarvi document, PDF, and image processing utilities.",
  path: "/terms",
  keywords: ["terms of service", "user agreement", "acceptable use", "document processing terms"],
});

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Terms of Service
          </h1>

          <p className="text-sm text-slate-500">
            Last updated: September 11, 2026
          </p>

          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
            These Terms of Service explain the rules and conditions for using
            Saarvi. By accessing or using Saarvi, you agree to these terms.
          </p>
        </div>

        <section className="mt-10 space-y-8 text-sm text-slate-600 leading-relaxed">

          {/* 1 */}
          <div className="space-y-3 border-t border-slate-200/80 pt-6">
            <h2 className="text-lg font-bold text-slate-900">
              1. Acceptance of Terms
            </h2>

            <p>
              By accessing or using the Saarvi website and its available
              document utilities, you agree to comply with these Terms of
              Service. If you do not agree with these terms, please do not use
              the service.
            </p>
          </div>

          {/* 2 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              2. Description of the Service
            </h2>

            <p>
              Saarvi provides web-based utilities for common document and
              image-related tasks. Available tools may include file conversion,
              PDF processing, image conversion, compression, and other
              document-related functionality.
            </p>

            <p>
              Features and available tools may change over time as Saarvi is
              improved and new utilities are introduced.
            </p>
          </div>

          {/* 3 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              3. Permitted Use
            </h2>

            <p>
              You may use Saarvi for lawful personal, educational,
              professional, and everyday purposes.
            </p>

            <p>You agree not to use Saarvi to:</p>

            <ul className="list-disc pl-5 space-y-2">
              <li>Upload or process unlawful content.</li>
              <li>Infringe another person's intellectual property rights.</li>
              <li>Distribute malicious software or harmful content.</li>
              <li>Attempt to interfere with or disrupt the service.</li>
              <li>Attempt to gain unauthorized access to systems or data.</li>
              <li>Abuse automated requests or intentionally overload the service.</li>
            </ul>
          </div>

          {/* 4 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              4. Your Files and Content
            </h2>

            <p>
              You are responsible for the files and content that you choose to
              process using Saarvi. You must have the necessary rights and
              permissions to use and process those files.
            </p>

            <p>
              You should keep your own backup of important documents. Saarvi
              does not guarantee that a processed file can always be recovered
              if a browser session, device, network connection, or service
              fails.
            </p>
          </div>

          {/* 5 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              5. Privacy and File Processing
            </h2>

            <p>
              Saarvi is designed with privacy in mind. Where technically
              practical, certain operations may be performed locally within
              your browser.
            </p>

            <p>
              File processing behavior can vary depending on the specific tool
              and implementation. Please review our{" "}
              <a
                href="/privacy"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Privacy Policy
              </a>{" "}
              for more information about data handling.
            </p>
          </div>

          {/* 6 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              6. Intellectual Property
            </h2>

            <p>
              The Saarvi website, branding, design, software, text, graphics,
              and other original materials provided by Saarvi are protected by
              applicable intellectual property laws.
            </p>

            <p>
              You retain ownership of the files and content you provide to
              Saarvi, subject to any rights held by their respective owners.
            </p>
          </div>

          {/* 7 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              7. Third-Party Services
            </h2>

            <p>
              Certain features may rely on third-party libraries, APIs,
              hosting providers, or other external services. Such services may
              have their own terms and privacy policies.
            </p>

            <p>
              Saarvi is not responsible for the availability or operation of
              third-party services that are outside its control.
            </p>
          </div>

          {/* 8 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              8. Availability and Changes
            </h2>

            <p>
              We aim to keep Saarvi useful and available, but we do not
              guarantee that the website or any particular tool will always be
              available, uninterrupted, secure, or error-free.
            </p>

            <p>
              We may modify, suspend, replace, or discontinue features or
              services when necessary.
            </p>
          </div>

          {/* 9 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              9. Disclaimer of Warranties
            </h2>

            <p>
              Saarvi is provided on an &quot;as is&quot; and &quot;as
              available&quot; basis to the extent permitted by applicable law.
              We make no warranties, express or implied, regarding the
              availability, accuracy, reliability, or suitability of the
              service for a particular purpose.
            </p>
          </div>

          {/* 10 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              10. Pro Subscriptions & Billing
            </h2>

            <p>
              Saarvi offers optional paid Pro subscriptions available on monthly (₹99/month) or yearly (₹899/year) billing cycles. Pricing is server-authoritative and charged in Indian Rupees (INR). By subscribing, you authorize recurring billing according to your chosen interval until cancelled.
            </p>
            <p>
              Payments are securely processed by Razorpay Software Private Limited. Saarvi does not collect, process, or store credit/debit card numbers, CVVs, UPI PINs, or banking passwords. Subscribing to Pro enhances browser quotas and local batch limits without altering our client-side privacy architecture.
            </p>
          </div>

          {/* 11 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              11. Cancellation & Refund Policy
            </h2>

            <p>
              You may cancel your subscription at any time via the Billing Dashboard. Upon cancellation, your Pro benefits remain active until the conclusion of your current billing period (current_period_end), after which your account reverts to the Free tier without further charges.
            </p>
            <p>
              Because Pro grants immediate access to elevated digital capacity, fees are generally non-refundable except where required by law or in the case of verified duplicate billing or technical payment discrepancies. Refund inquiries may be submitted to{" "}
              <a
                href="mailto:support@saarvi.in"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                support@saarvi.in
              </a>{" "}
              with your Razorpay payment identifier within 7 days of the charge.
            </p>
          </div>

          {/* 12 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              12. Limitation of Liability
            </h2>

            <p>
              To the fullest extent permitted by applicable law, Saarvi and
              its operators shall not be liable for indirect, incidental,
              special, consequential, or other damages arising from your use
              of, or inability to use, the service.
            </p>
          </div>

          {/* 13 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              13. Changes to These Terms
            </h2>

            <p>
              These Terms of Service may be updated from time to time to
              reflect changes to Saarvi, its features, or applicable
              requirements. The updated version will be posted on this page
              with a revised update date.
            </p>
          </div>

          {/* 14 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">
              14. Contact
            </h2>

            <p>
              If you have questions about these Terms of Service or billing inquiries, contact
              Saarvi at{" "}
              <a
                href="mailto:support@saarvi.in"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                support@saarvi.in
              </a>
              .
            </p>
          </div>

          {/* Final Note */}
          <div className="border-t border-slate-200/80 pt-6">
            <p className="text-xs text-slate-500 leading-relaxed">
              These terms are provided for general informational purposes and
              should be reviewed by a qualified legal professional if you need
              terms tailored to a specific business, jurisdiction, or legal
              structure.
            </p>
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
}