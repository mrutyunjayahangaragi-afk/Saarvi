import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CategoryWorkspaceView from "@/components/tools/CategoryWorkspaceView";
import { createMetadata } from "@/lib/seo/metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = createMetadata({
  title: "PDF Tools — Convert, Organize, Compress & Edit PDF Files | Saarvi",
  description: "Comprehensive suite of fast, private browser-based PDF utilities. Merge PDF, split pages, compress file size, convert PDF to Excel, Word, and JPG with 100% local processing.",
  path: "/pdf",
  keywords: [
    "pdf tools",
    "merge pdf",
    "split pdf",
    "compress pdf",
    "pdf to excel",
    "pdf to jpg",
    "excel to pdf",
    "online pdf editor",
    "private pdf converter"
  ],
});

export default function PdfCategoryPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "PDF Tools", url: "/pdf" },
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-[#0b1329] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <CategoryWorkspaceView
          category="pdf"
          title="PDF Tools"
          tagline="Document Productivity"
          description="Everything you need to convert, organize, compress, and edit PDF files. Fast, deterministic processing that stays directly inside your browser sandbox."
          iconName="FileText"
          popularKeys={["pdf-to-excel", "merge-pdf", "compress-pdf", "pdf-to-jpg"]}
          faqItems={[
            {
              q: "Are my PDF files uploaded to external servers?",
              a: "No. Saarvi processes your documents locally inside your browser using client-side WebAssembly. Your files never touch external cloud servers for supported conversions."
            },
            {
              q: "Can I use these tools as a guest without creating an account?",
              a: "Yes! Guest-enabled PDF tools can be used immediately with no signup or credit card required."
            },
            {
              q: "What is the maximum file size supported?",
              a: "Standard browser processing handles typical documents up to 50MB smoothly depending on your device's memory."
            },
            {
              q: "Can I convert scanned PDFs into editable spreadsheets?",
              a: "Yes, our PDF to Excel converter extracts text, structures table rows, and produces clean .xlsx files."
            }
          ]}
        />
      </main>

      <Footer />
    </div>
  );
}
