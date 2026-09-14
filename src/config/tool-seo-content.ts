/**
 * Saarvi Tool SEO & Educational Content Registry
 *
 * Provides genuine, high-utility, educational information for individual tool pages.
 * Maps genuine user search intents to unique technical explanations, use cases,
 * format specifications, and practical guides.
 *
 * Strictly adheres to truthfulness: no fake statistics, no keyword stuffing,
 * and clear local-first privacy transparency.
 */

export interface EducationalSection {
  title: string;
  content: string;
}

export interface ToolSeoContent {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  valueProposition: string;
  supportedInputs: string[];
  supportedOutputs: string[];
  overview: string;
  whenToUse: string[];
  technicalHighlights: string[];
  privacyDetails: string;
  educationalSections?: EducationalSection[];
}

export const TOOL_SEO_REGISTRY: Record<string, ToolSeoContent> = {
  "pdf-to-jpg": {
    metaTitle: "PDF to JPG Converter — Free Online PDF to JPG | Saarvi",
    metaDescription: "Convert PDF pages to high-resolution JPG images directly in your browser. Fast, private, and simple — your files stay on your device with zero server uploads.",
    h1: "PDF to JPG Converter",
    valueProposition: "Convert PDF pages to clean, high-resolution JPG images with local in-browser rendering.",
    supportedInputs: ["PDF (.pdf)"],
    supportedOutputs: ["JPG (.jpg)", "ZIP archive (for multi-page documents)"],
    overview: "PDF to JPG conversion extracts each page of a portable document file and renders it into a standard JPEG graphic file. Saarvi uses an in-browser WebAssembly rendering pipeline via Mozilla's PDF.js to convert document vectors and typography directly into high-fidelity raster pixels without uploading your documents to external cloud servers.",
    whenToUse: [
      "Sharing document previews or excerpts on social media, messaging apps, or presentation slides.",
      "Uploading certificates, receipts, or marksheets to portals that only accept image uploads (.jpg or .jpeg).",
      "Embedding specific pages of an e-book or report into graphic design tools like Figma or Photoshop.",
      "Viewing documents on devices or legacy hardware without a native PDF reader application."
    ],
    technicalHighlights: [
      "2.0x Display Ratio: Pages are rasterized at double resolution (144 DPI) for sharp text clarity.",
      "Multi-Page Batch Packaging: Multi-page PDFs automatically compile into a single organized ZIP archive.",
      "Color Accuracy: Standard sRGB color profiles ensure consistent rendering across phone and desktop screens.",
      "Client-Side Sandboxing: Processing executes in your browser's WebAssembly sandbox with no external API calls."
    ],
    privacyDetails: "Your document is processed 100% within your local browser runtime memory. The PDF bytes never leave your device, ensuring total confidentiality for bank statements, personal identification, and academic records.",
    educationalSections: [
      {
        title: "JPG vs. JPEG: What is the difference?",
        content: "JPG and JPEG are identical image formats. The 3-letter extension .jpg was originally required by MS-DOS 8.3 filename constraints, while UNIX systems used .jpeg. Both represent the same Joint Photographic Experts Group raster standard with lossy photographic compression."
      },
      {
        title: "How Multi-Page PDF Conversion Works in Saarvi",
        content: "When you upload a multi-page PDF, each page is individually rendered sequentially on an off-screen HTML5 canvas element. Single-page PDFs download instantly as a standalone .jpg file, while multi-page conversions automatically bundle each numbered image (e.g., page_1.jpg, page_2.jpg) into a lightweight ZIP file."
      }
    ]
  },

  "jpg-to-pdf": {
    metaTitle: "JPG to PDF Converter — Turn JPG Images into PDF | Saarvi",
    metaDescription: "Convert JPG and JPEG photos into standard, properly scaled PDF documents with custom paper sizes (A4, Letter, Fit) and margins. 100% private browser processing.",
    h1: "JPG to PDF Converter",
    valueProposition: "Turn JPG photos and scans into clean, standardized PDF documents with configurable paper dimensions.",
    supportedInputs: ["JPG (.jpg)", "JPEG (.jpeg)"],
    supportedOutputs: ["PDF (.pdf)"],
    overview: "JPG to PDF conversion wraps raster photograph files into the standardized ISO 32000 PDF container format. This enables predictable printing, consistent page boundaries, and universal readability across all operating systems without image scaling distortions.",
    whenToUse: [
      "Submitting photographed homework assignments, university project reports, or handwritten notes.",
      "Standardizing invoice scans, receipts, or government ID cards into a formal PDF document.",
      "Printing photographic documents with standardized A4 or US Letter page margins.",
      "Archiving personal photos in a durable, single-file document format."
    ],
    technicalHighlights: [
      "Custom Page Sizing: Choose between international A4 (210 × 297 mm), US Letter, or Fit-to-Image.",
      "Margin Adjustments: Apply zero margins, compact margins, or formal document padding.",
      "Vector Encasement: Images are wrapped directly inside the PDF stream without re-compression degradation.",
      "Orientation Intelligence: Automatically detects portrait versus landscape orientation based on image dimensions."
    ],
    privacyDetails: "The PDF document is synthesized directly using client-side pdf-lib JavaScript library. Your original images and the resulting PDF file are never uploaded to any remote server.",
    educationalSections: [
      {
        title: "Why convert JPG photos to PDF?",
        content: "While JPG is optimal for storing photographic pixel data, it lacks standard print boundaries and layout consistency across viewers. Converting to PDF preserves exact physical dimensions, ensures print-ready margins, and allows multiple images to be bound into a single document."
      },
      {
        title: "Page Scaling: A4 vs. Fit to Image",
        content: "When selecting A4 or Letter, Saarvi centers and scales your image proportionally to fit standard paper sheets with safe print margins. When selecting 'Fit', the PDF page dimensions precisely match your image's native pixel aspect ratio."
      }
    ]
  },

  "compress-pdf": {
    metaTitle: "Compress PDF — Reduce PDF File Size Online Free | Saarvi",
    metaDescription: "Reduce PDF document file size with Saarvi. Fast, private, and simple in-browser PDF compressor. Meet email and university portal upload limits easily.",
    h1: "Compress PDF",
    valueProposition: "Reduce large PDF document sizes while preserving visual readability and text clarity.",
    supportedInputs: ["PDF (.pdf)"],
    supportedOutputs: ["PDF (.pdf)"],
    overview: "PDF compression minimizes document byte size by optimizing embedded stream dictionaries, removing duplicate object references, discarding redundant metadata, and intelligently downscaling high-density bitmap illustrations. Saarvi's compressor allows you to meet strict upload thresholds on university, banking, and government portals.",
    whenToUse: [
      "Meeting upload limits (e.g. 2MB or 500KB) on job portals, government exam sites, or university submission forms.",
      "Attaching large slide presentations or scanned reports to email messages.",
      "Saving device storage space on mobile phones, tablets, or e-readers.",
      "Speeding up web loading times for hosted PDF documents and whitepapers."
    ],
    technicalHighlights: [
      "Structure Optimization: De-duplicates cross-reference tables and strips unneeded form state.",
      "Font Subset Preservation: Preserves embedded vector typography for razor-sharp text reproduction.",
      "Three Compression Profiles: Extreme (highest reduction), Recommended (balanced), and Light (maximum fidelity).",
      "Instant Size Verification: Live calculation displays original size, final size, and percentage saved."
    ],
    privacyDetails: "The entire compression pipeline runs on your machine using client-side JavaScript. Sensitive contract terms, tax forms, or student marks sheets remain completely within your device's memory.",
    educationalSections: [
      {
        title: "How does PDF compression work without losing text quality?",
        content: "PDF documents contain both vector data (fonts, lines, text) and raster data (photographs, scans). Saarvi preserves vector typography mathematically so characters remain sharp at any zoom level, while applying efficient stream compression to raster images and removing redundant structural metadata."
      }
    ]
  },

  "merge-pdf": {
    metaTitle: "Merge PDF — Combine Multiple PDF Files Online | Saarvi",
    metaDescription: "Combine multiple PDF documents into a single organized file in seconds. Drag-and-drop page ordering with private local browser processing.",
    h1: "Merge PDF Files",
    valueProposition: "Combine multiple PDF documents into one continuous, structured file with intuitive ordering.",
    supportedInputs: ["PDF (.pdf)"],
    supportedOutputs: ["PDF (.pdf)"],
    overview: "Merge PDF takes two or more distinct PDF documents and consolidates their internal page trees, cross-reference tables, and font streams into a single unified file. Users can easily adjust file order before generating the final combined document.",
    whenToUse: [
      "Combining multiple scanned assignment pages, lab manuals, and cover sheets into a single submission file.",
      "Assembling multi-part contract agreements, addendums, and signed exhibits into one legal binder.",
      "Consolidating monthly bank statements or expense receipts for tax and accounting preparation.",
      "Merging presentation slide decks with supplementary notes or appendix documents."
    ],
    technicalHighlights: [
      "Visual Re-ordering: Drag and reorder uploaded documents before finalizing the merge operation.",
      "Metadata Preservation: Preserves page orientation, annotations, and bookmarks from source documents.",
      "Batch Efficiency: Merges dozens of pages in seconds without memory leaks or server queues.",
      "Zero Byte Leakage: Source files stay local; final document is compiled into an in-memory Uint8Array."
    ],
    privacyDetails: "Because merging is performed client-side with pdf-lib, confidential business plans, resumes, and medical records are never transmitted across the network.",
    educationalSections: [
      {
        title: "Tips for clean PDF merging",
        content: "Before merging, ensure your documents are oriented correctly. Combining files with mismatched portrait and landscape pages is supported, but organizing them in logical reading sequence produces the best reading experience."
      }
    ]
  },

  "split-pdf": {
    metaTitle: "Split PDF — Extract PDF Pages Online Free | Saarvi",
    metaDescription: "Split PDF files into individual pages or extract specific page ranges instantly. Fast, private in-browser document splitting without server uploads.",
    h1: "Split PDF",
    valueProposition: "Extract specific page ranges or break large PDF files into distinct individual documents.",
    supportedInputs: ["PDF (.pdf)"],
    supportedOutputs: ["PDF (.pdf)", "ZIP archive (for multi-document extractions)"],
    overview: "Split PDF allows you to extract selected pages (e.g. pages 1-3, or page 5) from a larger document, or divide a multi-page file into individual single-page documents. Extracted pages retain full vector quality and formatting.",
    whenToUse: [
      "Extracting just your certificate or marksheet from a large college brochure or result gazette.",
      "Removing unnecessary preface or appendix pages from an academic textbook or whitepaper.",
      "Separating individual invoices or receipts from a monthly billing statement bundle.",
      "Sharing a specific section of a large confidential document without revealing other pages."
    ],
    technicalHighlights: [
      "Flexible Range Syntax: Support for single pages (3), ranges (1-5), and comma-separated lists (1, 3, 5-8).",
      "True Extraction: Deep-copies targeted page trees while omitting non-referenced pages to keep output compact.",
      "Batch Archive Packaging: Multiple split files are automatically packaged into a convenient ZIP download.",
      "Instant Preview: Validates page bounds against total document length before extraction."
    ],
    privacyDetails: "All page extraction logic executes on your computer. Your document contents are never transmitted to any external server.",
    educationalSections: [
      {
        title: "How to specify page ranges",
        content: "You can specify individual pages or ranges easily. For example, entering '1-4, 7, 10-12' extracts pages 1 through 4, page 7, and pages 10 through 12, compiling them into a new document."
      }
    ]
  },

  "image-to-pdf": {
    metaTitle: "Image to PDF Converter — Convert JPG, PNG & WebP to PDF | Saarvi",
    metaDescription: "Convert JPG, PNG, and WebP images into a single standardized PDF document. Fast, simple, and private in-browser image conversion with custom margins.",
    h1: "Image to PDF Converter",
    valueProposition: "Convert photos, graphics, and screenshots into clean, shareable PDF documents.",
    supportedInputs: ["JPG (.jpg)", "PNG (.png)", "WebP (.webp)", "GIF (.gif)"],
    supportedOutputs: ["PDF (.pdf)"],
    overview: "Image to PDF takes raster graphic files across multiple formats (JPG, PNG, WebP) and binds them into a universal PDF document. It ensures consistent print dimensions, preserves image fidelity, and allows multi-image compilation.",
    whenToUse: [
      "Compiling multiple receipts or photo evidence into a single clean PDF for claims or reports.",
      "Converting design screenshots or mockups into client-ready presentation documents.",
      "Assembling photographed notes into a multi-page study guide.",
      "Standardizing image submissions for academic or job applications."
    ],
    technicalHighlights: [
      "Multi-Format Ingestion: Mix and match JPG, PNG, and WebP in a single conversion flow.",
      "Lossless Header Parsing: Extracts image dimensions natively for exact canvas scaling.",
      "Smart Margin Padding: Configurable borders ensure images do not clip during physical printing.",
      "Vector Enclosure: Embeds images directly inside PDF binary streams without lossy re-encoding."
    ],
    privacyDetails: "Images are read directly via HTML5 FileReader and converted using client-side JavaScript. No file data is sent to external cloud infrastructure.",
    educationalSections: [
      {
        title: "Combining different image formats into one PDF",
        content: "Saarvi allows you to upload different image formats (such as a JPG photo alongside a transparent PNG diagram) and seamlessly compiles them into consecutive pages of a single PDF document."
      }
    ]
  },

  "pdf-to-png": {
    metaTitle: "PDF to PNG Converter — Free High-Resolution PDF to PNG | Saarvi",
    metaDescription: "Convert PDF pages to lossless PNG images directly in your browser. Clean transparent backgrounds, high DPI, and private local processing.",
    h1: "PDF to PNG Converter",
    valueProposition: "Convert PDF pages into crisp, lossless PNG graphics with full color fidelity.",
    supportedInputs: ["PDF (.pdf)"],
    supportedOutputs: ["PNG (.png)", "ZIP archive (for multi-page documents)"],
    overview: "PDF to PNG renders vector PDF pages into lossless Portable Network Graphics (PNG) format. Unlike JPEG which introduces lossy compression artifacts around text edges, PNG preserves sharp pixel boundaries, making it ideal for diagrams, technical schematics, and text-heavy presentations.",
    whenToUse: [
      "Extracting diagrams, architectural schematics, or mathematical charts from research papers.",
      "Creating crisp slide presentation graphics without compression blur or JPEG artifacts.",
      "Extracting logos, icons, or visual assets embedded in brand guideline documents.",
      "Publishing sharp digital previews of certificates and documents online."
    ],
    technicalHighlights: [
      "Lossless Compression: 24-bit RGB pixel rendering with zero compression blur around sharp edges.",
      "Double Resolution (144 DPI): Ensures small typography remains legible when zoomed.",
      "Sequential Multi-Page Output: Automatically packages multiple pages into a neatly labeled ZIP file.",
      "Pure In-Browser Canvas: Uses HTML5 Canvas toDataURL without server latency."
    ],
    privacyDetails: "Rendering executes completely inside your browser's memory using WebAssembly. No files or images are sent to any remote server.",
    educationalSections: [
      {
        title: "PNG vs. JPG for PDF conversions",
        content: "Choose PNG when your PDF contains fine typography, diagrams, or line drawings where crisp edges are essential. Choose JPG when your document consists primarily of photographic imagery and smaller file size is desired."
      }
    ]
  },

  "png-to-jpg": {
    metaTitle: "PNG to JPG Converter — Convert Transparent PNG to JPG | Saarvi",
    metaDescription: "Convert PNG images into lightweight JPG format with clean white background fill. Configurable quality levels and 100% private in-browser conversion.",
    h1: "PNG to JPG Converter",
    valueProposition: "Transform transparent or heavy PNG graphics into lightweight, widely compatible JPG images.",
    supportedInputs: ["PNG (.png)"],
    supportedOutputs: ["JPG (.jpg)"],
    overview: "PNG to JPG converts lossless PNG images into compressed JPEG format. Because JPG does not support alpha transparency, Saarvi automatically fills transparent background areas with clean, solid white, preventing black background glitches common in naive converters.",
    whenToUse: [
      "Reducing file sizes of high-resolution graphic assets or screenshots for email attachments.",
      "Preparing photos for online portal submissions that do not accept PNG format.",
      "Flattening transparent icons or logos onto solid white backgrounds for digital display.",
      "Optimizing web page assets for faster mobile loading times."
    ],
    technicalHighlights: [
      "Alpha Channel Flattening: Transparent pixels are composited onto a solid white canvas background.",
      "Configurable JPEG Quality: Adjustable compression ratio balances visual fidelity and file size.",
      "Instant Browser Export: Converts in milliseconds using the browser's hardware-accelerated 2D canvas.",
      "Zero Data Transmission: Your graphics are processed exclusively on your local device."
    ],
    privacyDetails: "Conversion is performed entirely in your browser using the HTML5 Canvas API. No image data is transmitted over the internet.",
    educationalSections: [
      {
        title: "Why do transparent PNGs sometimes look black when converted to JPG?",
        content: "JPEG format does not support transparency channels. Many basic converters drop the alpha channel without filling the background, causing transparent areas to render as black. Saarvi composites all transparency onto a clean white background before JPEG encoding to guarantee a professional result."
      }
    ]
  },

  "jpg-to-png": {
    metaTitle: "JPG to PNG Converter — Lossless JPG to PNG Online | Saarvi",
    metaDescription: "Convert JPG and JPEG images to lossless PNG format directly in your browser. Fast, private, and simple image format conversion with zero quality loss.",
    h1: "JPG to PNG Converter",
    valueProposition: "Convert JPG photos into lossless PNG format to prevent further compression degradation.",
    supportedInputs: ["JPG (.jpg)", "JPEG (.jpeg)"],
    supportedOutputs: ["PNG (.png)"],
    overview: "JPG to PNG converts compressed JPEG image files into the lossless Portable Network Graphics (PNG) format. While it cannot restore detail lost during original JPEG compression, converting to PNG prevents any further generation loss during future edits, re-saves, or digital compositing.",
    whenToUse: [
      "Preparing image assets for editing in graphic design applications without recurring compression loss.",
      "Meeting upload requirements on platforms that specifically mandate PNG format.",
      "Preparing photo assets for layering, masking, or annotation in presentation slides.",
      "Standardizing mixed format photo collections into a uniform PNG library."
    ],
    technicalHighlights: [
      "Lossless Encodement: Direct pixel transfer to PNG with DEFLATE stream compression.",
      "Dimension Preservation: Maintains exact original pixel width and height without resampling.",
      "Immediate Canvas Download: Hardware-accelerated local export with zero network latency.",
      "Privacy Invariant: 100% client-side memory execution without cloud uploads."
    ],
    privacyDetails: "The image is decoded and re-encoded purely inside your local browser tab. No server upload occurs.",
    educationalSections: [
      {
        title: "Does converting JPG to PNG improve quality?",
        content: "Converting JPG to PNG freezes the image in its current state, preserving exact pixel values and preventing any further quality degradation when you edit, crop, or save the image in the future."
      }
    ]
  },

  "compress-image": {
    metaTitle: "Compress Image — Reduce JPG, PNG & WebP File Size | Saarvi",
    metaDescription: "Compress JPG, PNG, and WebP images online without losing visual clarity. Fast, private in-browser image optimization with custom quality controls.",
    h1: "Compress Image",
    valueProposition: "Reduce image file sizes significantly while maintaining sharp visual clarity.",
    supportedInputs: ["JPG (.jpg)", "PNG (.png)", "WebP (.webp)"],
    supportedOutputs: ["JPG (.jpg)", "PNG (.png)", "WebP (.webp)"],
    overview: "Image compression optimizes photographic and graphic files by discarding imperceptible high-frequency visual noise and optimizing entropy coding tables. Saarvi provides fine-grained quality controls to help you achieve the exact target file size required for portal uploads or website optimization.",
    whenToUse: [
      "Meeting strict upload limits (e.g., under 100KB or 200KB) on passport, exam, or job application forms.",
      "Speeding up website page load performance by shrinking large hero and banner images.",
      "Freeing up local phone or computer disk space across photo collections.",
      "Sending photo attachments through messaging platforms or low-bandwidth email connections."
    ],
    technicalHighlights: [
      "Dynamic Quality Slider: Adjust compression percentage from 10% to 100% in real time.",
      "Format-Aware Algorithms: Uses progressive JPEG quantization and PNG palette reduction.",
      "Side-by-Side Size Comparison: Displays original bytes, compressed bytes, and percentage saved.",
      "Hardware Acceleration: Utilizes your computer's GPU canvas acceleration for instant rendering."
    ],
    privacyDetails: "All image compression runs strictly within your browser's memory. Private photos and sensitive ID cards are never uploaded to any remote server.",
    educationalSections: [
      {
        title: "Lossy vs. Lossless Image Compression",
        content: "Lossy compression (used by JPEG and WebP) intelligently discards subtle color variations imperceptible to the human eye, resulting in dramatic 70-90% file size reductions. Lossless compression (used by PNG) preserves every pixel exactly while optimizing file encoding."
      }
    ]
  }
};

/**
 * Retrieve SEO content for a given tool slug, falling back to dynamic generation.
 */
export function getToolSeoContent(slug: string, toolName: string, description: string): ToolSeoContent {
  const existing = TOOL_SEO_REGISTRY[slug];
  if (existing) return existing;

  // Fallback generation for other tools
  return {
    metaTitle: `${toolName} — Free Online Utility | Saarvi`,
    metaDescription: `${description} Fast, private, and simple — your files process locally in your browser with Saarvi.`,
    h1: toolName,
    valueProposition: description,
    supportedInputs: ["Supported document or image formats"],
    supportedOutputs: ["Standard processed output"],
    overview: `${toolName} is a fast, privacy-first utility that processes your files directly in your web browser. Designed for students, professionals, and everyday users who value speed and simplicity.`,
    whenToUse: [
      "Everyday document management and formatting tasks.",
      "Academic coursework, assignment submissions, and project preparation.",
      "Professional document workflows requiring strict data privacy.",
      "Quick conversions without installing third-party desktop software."
    ],
    technicalHighlights: [
      "In-Browser Processing: Executes using modern browser WebAssembly and JavaScript APIs.",
      "Zero Server Uploads: Document bytes remain within your device memory.",
      "Automatic Download: Clean 3-second completion countdown with manual override.",
      "Responsive Interface: Optimized for mobile phones, tablets, and desktop displays."
    ],
    privacyDetails: "Supported core tools process your files directly on your device. Your file contents are never transmitted across the internet or stored on external cloud infrastructure."
  };
}
