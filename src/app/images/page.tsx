import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CategoryWorkspaceView from "@/components/tools/CategoryWorkspaceView";
import { createMetadata } from "@/lib/seo/metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = createMetadata({
  title: "Image Tools — Compress, Convert, Resize & Crop Images | Saarvi",
  description: "Fast, in-browser image optimization and conversion suite. Convert JPG to PNG, PNG to JPG, compress photo size without quality loss, and create multi-image PDFs.",
  path: "/images",
  keywords: [
    "image tools",
    "jpg to pdf",
    "png to jpg",
    "compress image",
    "resize image",
    "image format converter",
    "photo optimizer",
    "local image tools"
  ],
});

export default function ImagesCategoryPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Image Tools", url: "/images" },
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
          category="image"
          title="Image Tools"
          tagline="Visual Media & Optimization"
          description="Resize, convert, compress, and format your images in seconds. High-performance canvas-based processing with zero server queues."
          iconName="FileImage"
          popularKeys={["jpg-to-pdf", "png-to-jpg", "compress-image", "resize-image"]}
          faqItems={[
            {
              q: "How does image compression work without losing quality?",
              a: "Saarvi utilizes smart chroma subsampling and adaptive quantization to reduce file size while preserving crisp edges and vibrant color fidelity."
            },
            {
              q: "Are my photos kept private?",
              a: "Absolutely. All image conversions and scaling execute purely in your local browser sandbox without storing or transferring photos across networks."
            },
            {
              q: "Can I convert multiple JPGs into a single combined PDF?",
              a: "Yes! Use our Image to PDF tool to drag and drop multiple images, reorder pages, and export a clean consolidated PDF document."
            }
          ]}
        />
      </main>

      <Footer />
    </div>
  );
}
