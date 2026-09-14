import type { ToolDefinition } from "@/types/tool";
import { getMaxFileSizeMB } from "./limits";

export const TOOLS_CONFIG: ToolDefinition[] = [
  // --- IMAGE TOOLS (WORKING BROWSER ENGINES) ---
  {
    id: "jpg-to-pdf",
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    category: "image",
    description: "Convert JPG images into standard PDF documents.",
    detailedDescription: "Turn JPG photos into clean, properly scaled PDF documents with custom paper sizes (A4, Letter, Fit) and margin options.",
    icon: "FileImage",
    route: "/tools/jpg-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "JPEG"],
    maxSizeMB: getMaxFileSizeMB("jpg-to-pdf"),
    keywords: ["jpg to pdf", "jpeg to pdf", "image to pdf", "photo to pdf", "convert jpg", "pictures"],
    howItWorks: [
      "Select or drag your JPG image into the dropzone.",
      "Configure page size (A4, Letter, Fit) and margins.",
      "Click Convert to generate your local PDF and download instantly."
    ],
    faq: [
      {
        question: "Can I convert multiple JPG photos at once?",
        answer: "Yes, use our Multiple Images to PDF tool to merge multiple photos into a multi-page document."
      },
      {
        question: "Are my photos uploaded to any server?",
        answer: "No. All PDF generation executes 100% inside your browser using client-side WebAssembly and JavaScript."
      }
    ],
    relatedSlugs: ["multiple-images-to-pdf", "png-to-jpg", "pdf-to-jpg", "image-to-pdf"]
  },
  {
    id: "png-to-jpg",
    slug: "png-to-jpg",
    name: "PNG to JPG",
    category: "image",
    description: "Convert PNG images into JPG format with solid background.",
    detailedDescription: "Transform transparent or high-res PNG graphics into lightweight JPG files with clean solid white background fill.",
    icon: "RefreshCw",
    route: "/tools/png-to-jpg",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PNG"],
    maxSizeMB: getMaxFileSizeMB("png-to-jpg"),
    keywords: ["png to jpg", "png to jpeg", "convert png", "transparent png", "white background"],
    howItWorks: [
      "Upload your PNG file to the converter.",
      "Select your preferred JPEG quality level (default 92%).",
      "Download the converted JPG image with white background fill."
    ],
    faq: [
      {
        question: "What happens to transparent areas in the PNG?",
        answer: "Since JPG does not support alpha transparency, transparent pixels automatically fill with solid white."
      },
      {
        question: "Will I lose image quality?",
        answer: "You can configure JPEG quality between 50% and 100% to balance size and clarity."
      }
    ],
    relatedSlugs: ["jpg-to-png", "jpg-to-pdf", "image-resize"]
  },
  {
    id: "jpg-to-png",
    slug: "jpg-to-png",
    name: "JPG to PNG",
    category: "image",
    description: "Convert JPG images into lossless PNG format.",
    detailedDescription: "Convert compressed JPG photographs to lossless PNG format without further quality degradation.",
    icon: "Repeat",
    route: "/tools/jpg-to-png",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "JPEG"],
    maxSizeMB: getMaxFileSizeMB("jpg-to-png"),
    keywords: ["jpg to png", "jpeg to png", "lossless png", "convert jpg", "photo to png"],
    howItWorks: [
      "Select your JPG file.",
      "Review the dimensions and file details.",
      "Export and download the lossless PNG file."
    ],
    faq: [
      {
        question: "Does converting to PNG improve compressed JPG quality?",
        answer: "It preserves exact pixel fidelity from the source and prevents further compression degradation during future editing."
      }
    ],
    relatedSlugs: ["png-to-jpg", "jpg-to-pdf", "image-resize"]
  },
  {
    id: "image-to-pdf",
    slug: "image-to-pdf",
    name: "Image to PDF",
    category: "image",
    description: "Convert any picture (JPG, PNG, WebP) into a PDF.",
    detailedDescription: "Universal image conversion tool that accepts any standard raster format and compiles it into a clean, unskewed PDF document.",
    icon: "Image",
    route: "/tools/image-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
    maxSizeMB: getMaxFileSizeMB("image-to-pdf"),
    keywords: ["image to pdf", "picture to pdf", "photo to pdf", "scan to pdf", "convert picture", "make pdf from pictures"],
    howItWorks: [
      "Upload any image file from your device.",
      "Adjust page scaling, paper format, and margins.",
      "Generate and download the compiled PDF."
    ],
    faq: [
      {
        question: "Which image formats are accepted?",
        answer: "JPG, JPEG, PNG, and WebP are fully supported for instant client-side conversion."
      }
    ],
    relatedSlugs: ["jpg-to-pdf", "multiple-images-to-pdf", "pdf-to-jpg"]
  },
  {
    id: "multiple-images-to-pdf",
    slug: "multiple-images-to-pdf",
    name: "Multiple Images to PDF",
    category: "image",
    description: "Combine multiple photos and scans into a single PDF document.",
    detailedDescription: "Upload multiple photos, arrange their order with drag-or-click controls, and bundle them into an organized multi-page PDF document.",
    icon: "Layers",
    route: "/tools/multiple-images-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
    maxSizeMB: getMaxFileSizeMB("multiple-images-to-pdf"),
    keywords: ["multiple images to pdf", "combine photos", "batch images", "merge photos into pdf", "album to pdf"],
    howItWorks: [
      "Select multiple image files at once.",
      "Reorder pages using the Up/Down arrow controls.",
      "Export as a single cohesive multi-page PDF document."
    ],
    faq: [
      {
        question: "Is there a limit on how many images I can merge?",
        answer: "You can combine up to 20 images or a total of 100MB per batch directly in browser memory."
      }
    ],
    relatedSlugs: ["jpg-to-pdf", "image-to-pdf", "merge-pdf"]
  },
  {
    id: "image-resize",
    slug: "image-resize",
    name: "Image Resize",
    category: "image",
    description: "Resize dimensions, scale percentage, and change image formats.",
    detailedDescription: "Adjust image width and height in pixels, preserve aspect ratios, configure target quality, and convert between JPEG, PNG, and WebP.",
    icon: "Maximize2",
    route: "/tools/image-resize",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
    maxSizeMB: getMaxFileSizeMB("image-resize"),
    keywords: ["resize image", "scale image", "dimensions", "shrink photo", "crop", "resolution", "pixel", "photo"],
    howItWorks: [
      "Upload your photo or graphic.",
      "Input target width, height, or click aspect ratio presets.",
      "Download resized image in JPG, PNG, or WebP."
    ],
    faq: [
      {
        question: "Will resizing stretch or distort my image?",
        answer: "By default, 'Maintain Aspect Ratio' is enabled to guarantee proportions remain identical."
      }
    ],
    relatedSlugs: ["png-to-jpg", "jpg-to-png", "id-photo"]
  },
  {
    id: "webp-to-jpg",
    slug: "webp-to-jpg",
    name: "WEBP to JPG",
    category: "image",
    description: "Convert modern WEBP images to standard JPG format.",
    detailedDescription: "Instantly convert WebP graphics into universally compatible JPG images with white background fill for transparency. Runs entirely in your browser.",
    icon: "RefreshCw",
    route: "/tools/webp-to-jpg",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["WEBP"],
    maxSizeMB: getMaxFileSizeMB("webp-to-jpg"),
    keywords: ["webp to jpg", "convert webp", "webp to jpeg", "google webp", "webp converter"],
    howItWorks: [
      "Upload your WebP image file.",
      "The converter fills transparent areas with white.",
      "Download the compatible JPG file instantly."
    ],
    faq: [
      {
        question: "Does this work on all browsers?",
        answer: "Yes — Chrome, Firefox, Edge, and Safari 14+ all decode WebP natively in the Canvas API."
      }
    ],
    relatedSlugs: ["webp-to-png", "png-to-jpg", "jpg-to-png", "compress-image"]
  },
  {
    id: "webp-to-png",
    slug: "webp-to-png",
    name: "WEBP to PNG",
    category: "image",
    description: "Convert WebP images to lossless PNG with alpha transparency preserved.",
    detailedDescription: "Convert WebP assets to PNG format while preserving alpha transparency channels. Runs entirely in your browser — no upload required.",
    icon: "Repeat",
    route: "/tools/webp-to-png",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["WEBP"],
    maxSizeMB: getMaxFileSizeMB("webp-to-png"),
    keywords: ["webp to png", "transparent webp", "convert webp", "webp transparency", "lossless webp"],
    howItWorks: [
      "Upload your WebP file.",
      "Alpha transparency is preserved in the PNG output.",
      "Download the lossless PNG."
    ],
    faq: [],
    relatedSlugs: ["webp-to-jpg", "png-to-jpg", "jpg-to-png", "compress-image"]
  },
  {
    id: "crop-image",
    slug: "crop-image",
    name: "Crop Image",
    category: "image",
    description: "Crop photos to custom dimensions and aspect ratios.",
    detailedDescription: "Crop images to any dimension with preset aspect ratios (Free, 1:1 Square, 4:3, 16:9, 2:3 Portrait) or custom pixel values. Preserves alpha for PNG output.",
    icon: "Scissors",
    route: "/tools/crop-image",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
    maxSizeMB: getMaxFileSizeMB("crop-image"),
    keywords: ["crop image", "crop photo", "cut image", "avatar crop", "square crop", "aspect ratio", "trim photo"],
    howItWorks: [
      "Upload your photo or graphic.",
      "Enter crop coordinates or choose an aspect ratio preset.",
      "Download the cropped image in JPG or PNG format."
    ],
    faq: [
      {
        question: "Can I crop to a specific pixel size?",
        answer: "Yes — enter exact X, Y, width, and height values in pixels."
      }
    ],
    relatedSlugs: ["image-resize", "rotate-image", "compress-image", "id-photo"]
  },
  {
    id: "rotate-image",
    slug: "rotate-image",
    name: "Rotate Image",
    category: "image",
    description: "Rotate images 90°, 180°, 270° and flip horizontally or vertically.",
    detailedDescription: "Fix sideways or upside-down photos instantly. Apply 90°/180°/270° rotations and horizontal/vertical flips. All processing happens in your browser.",
    icon: "Repeat",
    route: "/tools/rotate-image",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
    maxSizeMB: getMaxFileSizeMB("rotate-image"),
    keywords: ["rotate image", "turn image", "flip photo", "fix upside down photo", "rotate 90", "flip horizontal", "flip vertical"],
    howItWorks: [
      "Upload your photo.",
      "Select a rotation angle (90°, 180°, 270°) and/or flip direction.",
      "Download the corrected image."
    ],
    faq: [
      {
        question: "Does rotation reduce image quality?",
        answer: "No — the image is re-rendered at full resolution onto a correctly-sized canvas."
      }
    ],
    relatedSlugs: ["image-resize", "crop-image", "rotate-pdf", "compress-image"]
  },
  {
    id: "compress-image",
    slug: "compress-image",
    name: "Compress Image",
    category: "image",
    description: "Reduce image file size with adjustable quality settings.",
    detailedDescription: "Compress JPG, PNG, and WebP images directly in your browser. Control quality level and see actual before/after file sizes — no estimated savings.",
    icon: "FileDown",
    route: "/tools/compress-image",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
    maxSizeMB: getMaxFileSizeMB("compress-image"),
    keywords: ["compress image", "reduce image size", "shrink photo", "optimize image", "smaller image", "image quality"],
    howItWorks: [
      "Upload your JPG, PNG, or WebP image.",
      "Adjust the quality slider to balance size and clarity.",
      "See the actual savings and download the smaller file."
    ],
    faq: [
      {
        question: "What if the compressed file is larger than the original?",
        answer: "We'll tell you honestly — no fake savings are shown. The tool will suggest keeping your original file."
      }
    ],
    relatedSlugs: ["image-resize", "crop-image", "jpg-to-png", "webp-to-jpg"]
  },

  // --- PDF TOOLS (WORKING BROWSER ENGINES) ---
  {
    id: "pdf-to-excel",
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    category: "pdf",
    description: "Convert PDF tables into editable Microsoft Excel spreadsheets.",
    detailedDescription: "Extract tables and structured data from PDF documents into authentic Microsoft Excel (.xlsx) workbooks with separate sheets, column preservation, and number detection.",
    icon: "FileSpreadsheet",
    route: "/tools/pdf-to-excel",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-to-excel"),
    keywords: [
      "pdf to excel",
      "pdf to xlsx",
      "convert pdf to excel",
      "make spreadsheet from pdf",
      "extract table from pdf",
      "pdf spreadsheet"
    ],
    howItWorks: [
      "Select or drag your PDF document containing tabular data.",
      "The client engine scans and detects rows, columns, and numeric cells.",
      "Download your genuine Microsoft Excel (.xlsx) spreadsheet instantly."
    ],
    faq: [
      {
        question: "What happens if my PDF does not contain tables?",
        answer: "If no reliable tabular structure is detected, Saarvi will inform you: 'This PDF does not contain a reliably detectable table.' rather than creating an empty file."
      },
      {
        question: "Are multi-page tables supported?",
        answer: "Yes, multi-page documents create individual sheets for each page with tables."
      }
    ],
    relatedSlugs: ["excel-to-pdf", "pdf-to-word", "pdf-to-jpg", "merge-pdf"]
  },
  {
    id: "excel-to-pdf",
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    category: "pdf",
    description: "Convert Microsoft Excel spreadsheets into clean PDF documents.",
    detailedDescription: "Transform Microsoft Excel (.xlsx) workbooks into formatted PDF files with sheet selection, auto-landscape for wide tables, grid borders, and repeated headers.",
    icon: "FileSpreadsheet",
    route: "/tools/excel-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["XLSX"],
    maxSizeMB: getMaxFileSizeMB("excel-to-pdf"),
    keywords: [
      "excel to pdf",
      "xlsx to pdf",
      "convert excel to pdf",
      "spreadsheet to pdf",
      "sheet to pdf",
      "excel converter"
    ],
    howItWorks: [
      "Upload your Microsoft Excel (.xlsx) workbook.",
      "Choose to convert all sheets or a selected worksheet.",
      "The local engine formats grid lines, margins, and page breaks into a crisp PDF."
    ],
    faq: [
      {
        question: "Can I convert wide spreadsheets?",
        answer: "Yes, tables with more than 6 columns automatically switch to landscape orientation to prevent truncating data."
      },
      {
        question: "Are formulas evaluated?",
        answer: "Cached formula values and computed cell strings inside the OpenXML package are preserved."
      }
    ],
    relatedSlugs: ["pdf-to-excel", "word-to-pdf", "powerpoint-to-pdf"]
  },
  {
    id: "pdf-to-powerpoint",
    slug: "pdf-to-powerpoint",
    name: "PDF to PowerPoint",
    category: "pdf",
    description: "Convert PDF documents into editable Microsoft PowerPoint presentations.",
    detailedDescription: "Convert each page of your PDF into an authentic PowerPoint (.pptx) slide with extracted text boxes, preserved positions, font styles, and slide aspect ratios.",
    icon: "Presentation",
    route: "/tools/pdf-to-powerpoint",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-to-powerpoint"),
    keywords: [
      "pdf to powerpoint",
      "pdf to pptx",
      "convert pdf to powerpoint",
      "pdf to slides",
      "pdf to presentation"
    ],
    howItWorks: [
      "Upload your PDF document.",
      "Each page is mapped to a PowerPoint slide with extracted text frames.",
      "Download your authentic .pptx slide deck directly to your device."
    ],
    faq: [
      {
        question: "Can scanned PDFs be converted into editable slides?",
        answer: "If the PDF is a scanned image without selectable text, Saarvi explains that OCR is required for editable text."
      },
      {
        question: "Are slide dimensions preserved?",
        answer: "Yes, slide dimensions are calculated based on the aspect ratio and viewport of the original PDF pages."
      }
    ],
    relatedSlugs: ["powerpoint-to-pdf", "pdf-to-word", "pdf-to-excel"]
  },
  {
    id: "powerpoint-to-pdf",
    slug: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    category: "pdf",
    description: "Convert Microsoft PowerPoint presentations into PDF documents.",
    detailedDescription: "Transform PowerPoint (.pptx) slide presentations into high-fidelity PDF documents, creating one PDF page per slide while preserving aspect ratios, text frames, shapes, and images.",
    icon: "Presentation",
    route: "/tools/powerpoint-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PPTX"],
    maxSizeMB: getMaxFileSizeMB("powerpoint-to-pdf"),
    keywords: [
      "powerpoint to pdf",
      "turn powerpoint into pdf",
      "pptx to pdf",
      "convert powerpoint to pdf",
      "slides to pdf",
      "presentation to pdf"
    ],
    howItWorks: [
      "Select your Microsoft PowerPoint (.pptx) file.",
      "The local engine parses slides, shapes, text, and embedded media.",
      "Download your publication-ready PDF document instantly."
    ],
    faq: [
      {
        question: "Is slide widescreen aspect ratio preserved?",
        answer: "Yes, each PDF page matches the exact width and height proportions of your slides (4:3 or 16:9)."
      },
      {
        question: "Will embedded images remain clear?",
        answer: "Yes, extracted slide images are embedded directly into the PDF without recompression degradation."
      }
    ],
    relatedSlugs: ["pdf-to-powerpoint", "excel-to-pdf", "word-to-pdf"]
  },
  {
    id: "txt-to-pdf",
    slug: "txt-to-pdf",
    name: "TXT to PDF",
    category: "pdf",
    description: "Convert plain text files into cleanly paginated PDF documents.",
    detailedDescription: "Transform plain text (.txt) files into clean, beautifully formatted PDF documents with UTF-8 support, automatic word wrapping, standard margins, and page numbering.",
    icon: "FileText",
    route: "/tools/txt-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    supportedFormats: ["TXT"],
    maxSizeMB: getMaxFileSizeMB("txt-to-pdf"),
    keywords: [
      "txt to pdf",
      "convert txt to pdf",
      "text to pdf",
      "plain text to pdf",
      "notepad to pdf"
    ],
    howItWorks: [
      "Upload your text (.txt) file.",
      "The client engine applies clean typography, margins, and pagination.",
      "Download your paginated PDF document with page numbers."
    ],
    faq: [
      {
        question: "Does it support international characters?",
        answer: "Yes, files are decoded using UTF-8 text encoding."
      },
      {
        question: "Are line breaks and paragraphs preserved?",
        answer: "Yes, all line breaks and paragraph separations are maintained."
      }
    ],
    relatedSlugs: ["csv-to-pdf", "word-to-pdf", "pdf-to-word", "html-to-pdf"]
  },
  {
    id: "csv-to-pdf",
    slug: "csv-to-pdf",
    name: "CSV to PDF",
    category: "pdf",
    description: "Convert CSV data into clean, structured PDF tables.",
    detailedDescription: "Convert comma-separated, semicolon, or tab-delimited CSV spreadsheets into styled PDF tables with repeated headers, alternating row colors, and auto-landscape orientation.",
    icon: "Table",
    route: "/tools/csv-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    supportedFormats: ["CSV", "TXT"],
    maxSizeMB: getMaxFileSizeMB("csv-to-pdf"),
    keywords: [
      "csv to pdf",
      "convert csv to pdf",
      "csv to table pdf",
      "data to pdf",
      "comma separated to pdf"
    ],
    howItWorks: [
      "Upload your CSV spreadsheet.",
      "The parser detects delimiters, calculates column widths, and sets page orientation.",
      "Download your formatted PDF table with repeating headers."
    ],
    faq: [
      {
        question: "What happens if a table has many columns?",
        answer: "Saarvi automatically switches to landscape mode to prevent text clipping."
      },
      {
        question: "Are long text fields wrapped?",
        answer: "Yes, cell text is wrapped within column boundaries without truncation."
      }
    ],
    relatedSlugs: ["excel-to-pdf", "pdf-to-excel", "txt-to-pdf", "word-to-pdf"]
  },
  {
    id: "html-to-pdf",
    slug: "html-to-pdf",
    name: "HTML to PDF",
    category: "pdf",
    description: "Convert HTML documents into clean, secure PDF files.",
    detailedDescription: "Transform HTML files and web markup into structured PDF documents with sanitized styling, headings, paragraphs, lists, tables, and pagination.",
    icon: "FileCode",
    route: "/tools/html-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    supportedFormats: ["HTML", "HTM"],
    maxSizeMB: getMaxFileSizeMB("html-to-pdf"),
    keywords: [
      "html to pdf",
      "convert html to pdf",
      "webpage to pdf",
      "save html as pdf"
    ],
    howItWorks: [
      "Upload your HTML file.",
      "The document is sanitized against dangerous scripts and parsed into document blocks.",
      "Download your converted PDF document instantly."
    ],
    faq: [
      {
        question: "Is uploaded HTML safe from script execution?",
        answer: "Yes. All script tags, inline event handlers, and JavaScript URIs are strictly stripped before rendering."
      },
      {
        question: "Are tables and lists supported?",
        answer: "Yes, HTML tables, unordered lists, ordered lists, and headings are converted into PDF structures."
      }
    ],
    relatedSlugs: ["txt-to-pdf", "word-to-pdf", "pdf-to-word", "excel-to-pdf"]
  },
  {
    id: "pdf-to-word",
    slug: "pdf-to-word",
    name: "PDF to Word",
    category: "pdf",
    description: "Convert PDF documents into editable Microsoft Word documents.",
    detailedDescription: "Transform PDF documents into editable Microsoft Word (.docx) files locally in your browser. Extracts readable text, detects headings, preserves paragraphs, basic line breaks, and page flow without server uploads.",
    icon: "FileType",
    route: "/tools/pdf-to-word",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-to-word"),
    keywords: [
      "pdf to word",
      "pdf to docx",
      "convert pdf to word",
      "pdf converter",
      "editable word document",
      "pdf document"
    ],
    howItWorks: [
      "Select or drag your PDF document into the upload area.",
      "Our local browser engine extracts structured text, headings, and paragraph layout.",
      "Download the editable Microsoft Word (.docx) document instantly."
    ],
    faq: [
      {
        question: "Can I edit the converted Word document in Microsoft Office or Google Docs?",
        answer: "Yes. The output is a standard OpenXML (.docx) file fully compatible with Microsoft Word, Google Docs, LibreOffice, and Apple Pages."
      },
      {
        question: "Are my documents uploaded to any remote server?",
        answer: "No. Conversion executes 100% locally inside your browser. Your private documents never leave your device."
      },
      {
        question: "What happens if my PDF is a scanned image without selectable text?",
        answer: "If the PDF contains scanned photos without embedded text, selectable text cannot be extracted directly and OCR is required."
      }
    ],
    relatedSlugs: ["word-to-pdf", "pdf-to-jpg", "pdf-to-png", "merge-pdf", "compress-pdf"]
  },
  {
    id: "word-to-pdf",
    slug: "word-to-pdf",
    name: "Word to PDF",
    category: "pdf",
    description: "Convert Microsoft Word documents into PDF files.",
    detailedDescription: "Convert Microsoft Word (.docx) documents into clean, professional PDF documents right in your browser. Preserves headings, paragraphs, lists, bold/italic formatting, and basic tables with standard page margins.",
    icon: "FileType",
    route: "/tools/word-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["DOCX"],
    maxSizeMB: getMaxFileSizeMB("word-to-pdf"),
    keywords: [
      "word to pdf",
      "docx to pdf",
      "convert word to pdf",
      "word converter",
      "document to pdf",
      "docx converter"
    ],
    howItWorks: [
      "Upload your Microsoft Word (.docx) document.",
      "The local parser processes document paragraphs, headings, formatting, and tables.",
      "Download your generated PDF document with professional margins and page breaks."
    ],
    faq: [
      {
        question: "Which Word formats are supported?",
        answer: "Standard Microsoft Word (.docx) OpenXML documents are fully supported."
      },
      {
        question: "Does conversion happen privately in my browser?",
        answer: "Yes. The entire DOCX parsing and PDF compilation happens on your device without uploading your file to any server."
      },
      {
        question: "Are multi-page documents supported?",
        answer: "Yes. Content flows naturally across multiple A4 pages with clean margins and automatic pagination."
      }
    ],
    relatedSlugs: ["pdf-to-word", "pdf-to-jpg", "jpg-to-pdf", "merge-pdf"]
  },
  {
    id: "pdf-to-jpg",
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    category: "pdf",
    description: "Convert PDF pages into high-resolution JPG images.",
    detailedDescription: "Extract pages from your PDF document and render them into sharp JPG images. Download individual pages or all pages as a ZIP archive.",
    icon: "FileType",
    route: "/tools/pdf-to-jpg",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-to-jpg"),
    keywords: ["pdf to jpg", "pdf to image", "pdf to jpeg", "extract images", "render pdf pages"],
    howItWorks: [
      "Upload your PDF document.",
      "Select extraction resolution scale and pages.",
      "Download single pages or download all pages packaged in a ZIP archive."
    ],
    faq: [
      {
        question: "Can I download individual pages?",
        answer: "Yes, you can download each page individually or download all pages together in a single ZIP file."
      },
      {
        question: "Is this done completely in the browser?",
        answer: "Yes. PDF.js renders your pages directly on client-side HTML5 canvas elements."
      }
    ],
    relatedSlugs: ["merge-pdf", "split-pdf", "extract-pdf-pages"]
  },
  {
    id: "pdf-to-png",
    slug: "pdf-to-png",
    name: "PDF to PNG",
    category: "pdf",
    description: "Render PDF pages into high-quality PNG images with transparency support.",
    detailedDescription: "Convert PDF pages to lossless PNG images. Useful for presentations, design assets, and transparent overlays. Download individual pages or all pages as a ZIP.",
    icon: "FileImage",
    route: "/tools/pdf-to-png",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-to-png"),
    keywords: ["pdf to png", "lossless pdf to image", "render png from pdf", "pdf page as image", "transparent pdf"],
    howItWorks: [
      "Upload your PDF document.",
      "Select which pages to export (all pages by default).",
      "Download individual PNGs or all pages as a ZIP archive."
    ],
    faq: [
      {
        question: "What is the difference between PDF to JPG and PDF to PNG?",
        answer: "PNG is lossless and supports transparency. JPG uses lossy compression with a white background fill."
      }
    ],
    relatedSlugs: ["pdf-to-jpg", "split-pdf", "compress-pdf"]
  },
  {
    id: "merge-pdf",
    slug: "merge-pdf",
    name: "Merge PDF",
    category: "pdf",
    description: "Combine multiple PDF files into one organized document.",
    detailedDescription: "Merge assignments, reports, and invoices into a single sequential PDF file with custom file reordering.",
    icon: "Combine",
    route: "/tools/merge-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("merge-pdf"),
    keywords: ["merge pdf", "combine pdf", "join pdf", "concatenate pdf", "bundle pdf"],
    howItWorks: [
      "Select two or more PDF files.",
      "Use the Up and Down buttons to adjust the order.",
      "Click Merge to compile your new combined PDF document."
    ],
    faq: [
      {
        question: "Does merging keep the original formatting?",
        answer: "Yes. All fonts, vector paths, form elements, and annotations are preserved exactly as in the source files."
      }
    ],
    relatedSlugs: ["split-pdf", "extract-pdf-pages", "rotate-pdf"]
  },
  {
    id: "split-pdf",
    slug: "split-pdf",
    name: "Split PDF",
    category: "pdf",
    description: "Split PDF into individual pages or custom ranges.",
    detailedDescription: "Separate a large multi-page PDF into discrete documents by specifying custom page ranges (e.g. 1-3, 5) or exporting every page into a ZIP archive.",
    icon: "Scissors",
    route: "/tools/split-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("split-pdf"),
    keywords: ["split pdf", "slice pdf", "separate pdf", "cut pdf pages", "divide pdf"],
    howItWorks: [
      "Upload your multi-page PDF.",
      "Choose 'Custom Page Range' or 'Extract All Pages as ZIP'.",
      "Process and download your separated document."
    ],
    faq: [
      {
        question: "How do I specify multiple ranges?",
        answer: "Enter comma-separated values like '1-3, 5, 8-10' to extract non-consecutive page blocks."
      }
    ],
    relatedSlugs: ["extract-pdf-pages", "merge-pdf", "pdf-to-jpg"]
  },
  {
    id: "rotate-pdf",
    slug: "rotate-pdf",
    name: "Rotate PDF",
    category: "pdf",
    description: "Rotate PDF pages 90, 180, or 270 degrees clockwise.",
    detailedDescription: "Permanently fix upside-down or sideways pages in scanned documents. Apply rotation to all pages or specific page numbers.",
    icon: "Repeat",
    route: "/tools/rotate-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("rotate-pdf"),
    keywords: ["rotate pdf", "turn pdf", "orientation", "fix upside down pdf", "landscape to portrait"],
    howItWorks: [
      "Upload your PDF document.",
      "Choose the rotation angle (90°, 180°, or 270°).",
      "Choose whether to rotate all pages or only specific pages, then download."
    ],
    faq: [
      {
        question: "Can I rotate just one upside-down page?",
        answer: "Yes, select 'Selected Pages' and input the specific page number to rotate only that page."
      }
    ],
    relatedSlugs: ["merge-pdf", "split-pdf", "extract-pdf-pages"]
  },
  {
    id: "extract-pdf-pages",
    slug: "extract-pdf-pages",
    name: "Extract PDF Pages",
    category: "pdf",
    description: "Extract specific pages from a PDF into a new document.",
    detailedDescription: "Select exact page numbers or ranges (e.g. 2, 5, 8-10) and generate a clean standalone PDF containing only the selected content.",
    icon: "FileDown",
    route: "/tools/extract-pdf-pages",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("extract-pdf-pages"),
    keywords: ["extract pages", "select pages", "save pages from pdf", "pdf page extractor", "pull pages from pdf"],
    howItWorks: [
      "Upload your PDF.",
      "Enter the target page numbers or ranges you wish to keep.",
      "Download a new PDF containing only those specified pages."
    ],
    faq: [
      {
        question: "Are extracted pages recompressed?",
        answer: "No, pages are extracted losslessly without raster downsampling."
      }
    ],
    relatedSlugs: ["split-pdf", "delete-pdf-pages", "organize-pdf", "rotate-pdf"]
  },
  {
    id: "delete-pdf-pages",
    slug: "delete-pdf-pages",
    name: "Delete PDF Pages",
    category: "pdf",
    description: "Remove specific pages or page ranges from a PDF document.",
    detailedDescription: "Permanently remove unwanted pages from PDF documents. Specify individual pages (e.g. 2, 5) or ranges (e.g. 8-10). Your original file is never modified.",
    icon: "Trash2",
    route: "/tools/delete-pdf-pages",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("delete-pdf-pages"),
    keywords: ["delete pdf pages", "remove pages", "remove page from pdf", "delete page pdf", "cut pages"],
    howItWorks: [
      "Upload your PDF document.",
      "Enter the page numbers to delete (e.g. 2, 5, 8-10).",
      "Download the new PDF with those pages permanently removed."
    ],
    faq: [
      {
        question: "Does this modify my original file?",
        answer: "No — a new PDF is generated locally in your browser. Your original file is untouched."
      },
      {
        question: "Can I delete multiple page ranges?",
        answer: "Yes — enter comma-separated values like '2, 5, 8-10' to remove multiple pages or ranges."
      }
    ],
    relatedSlugs: ["extract-pdf-pages", "organize-pdf", "split-pdf", "rotate-pdf"]
  },
  {
    id: "reorder-pdf-pages",
    slug: "reorder-pdf-pages",
    name: "Reorder PDF Pages",
    category: "pdf",
    description: "Rearrange PDF pages into any custom order.",
    detailedDescription: "Specify a new page order for your PDF document. Perfect for correcting scanned page sequences or restructuring report layouts. Fully browser-side.",
    icon: "GripVertical",
    route: "/tools/reorder-pdf-pages",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("reorder-pdf-pages"),
    keywords: ["reorder pdf pages", "rearrange pdf", "reorganize pdf", "change page order", "shuffle pdf"],
    howItWorks: [
      "Upload your PDF.",
      "Enter the new page order (e.g. 3, 1, 2 to move page 3 first).",
      "Download the rearranged PDF."
    ],
    faq: [
      {
        question: "Do I need to list all pages?",
        answer: "Yes — enter all page numbers in your desired order. Use the Organize PDF tool for a visual interface."
      }
    ],
    relatedSlugs: ["organize-pdf", "delete-pdf-pages", "merge-pdf", "extract-pdf-pages"]
  },
  {
    id: "organize-pdf",
    slug: "organize-pdf",
    name: "Organize PDF",
    category: "pdf",
    description: "Visually manage PDF pages — reorder, rotate, and delete with thumbnails.",
    detailedDescription: "Upload a PDF and see all pages as thumbnails. Select pages to delete, rotate, or move up/down. Export a new clean PDF with your changes applied.",
    icon: "LayoutGrid",
    route: "/tools/organize-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("organize-pdf"),
    keywords: ["organize pdf", "manage pdf pages", "reorder pdf", "delete pdf pages", "rotate pdf pages", "arrange pdf", "pdf page manager"],
    howItWorks: [
      "Upload your PDF to see all pages as small thumbnails.",
      "Select pages and apply actions: Delete, Rotate, Move Up, Move Down.",
      "Click Export to generate and download your reorganized PDF."
    ],
    faq: [
      {
        question: "Is drag-and-drop supported?",
        answer: "Move Up and Move Down controls work for all browsers including mobile. Drag-and-drop reorder is coming in a future update."
      },
      {
        question: "Does this upload my document?",
        answer: "No — all page manipulation happens entirely in your browser using pdf-lib. Your document never leaves your device."
      }
    ],
    relatedSlugs: ["delete-pdf-pages", "reorder-pdf-pages", "rotate-pdf", "split-pdf", "merge-pdf"]
  },
  {
    id: "compress-pdf",
    slug: "compress-pdf",
    name: "Compress PDF",
    category: "pdf",
    description: "Reduce PDF file size for easy email and portal uploads.",
    detailedDescription: "Optimize PDF documents directly in your browser. Downsample heavy embedded raster images to make files compact for college and job application portals.",
    icon: "FileDown",
    route: "/tools/compress-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("compress-pdf"),
    keywords: ["compress pdf", "reduce pdf size", "shrink pdf", "smaller pdf", "optimize pdf", "file size"],
    howItWorks: [
      "Upload the PDF you want to shrink.",
      "Select your compression preset: Low, Balanced, or High.",
      "Receive your optimized file with truthful percentage savings."
    ],
    faq: [
      {
        question: "Will text become blurry?",
        answer: "Vector text and fonts remain sharp. Compression focuses on reducing the resolution of embedded photographic scans."
      }
    ],
    relatedSlugs: ["pdf-to-jpg", "split-pdf", "merge-pdf"]
  },
  {
    id: "protect-pdf",
    slug: "protect-pdf",
    name: "Protect PDF",
    category: "pdf",
    description: "Secure PDF documents with custom open and owner passwords.",
    detailedDescription: "Encrypt sensitive PDF documents directly in your browser using standard 128-bit encryption with custom passwords and access permissions for printing, copying, and modifications.",
    icon: "Lock",
    route: "/tools/protect-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("protect-pdf"),
    keywords: ["protect pdf", "password protect pdf", "encrypt pdf", "secure pdf", "pdf password", "lock pdf"],
    howItWorks: [
      "Upload your PDF document.",
      "Enter a strong password and choose document permissions.",
      "Download your encrypted, password-protected PDF."
    ],
    faq: [
      {
        question: "Is my password sent to a server?",
        answer: "No. Encryption happens entirely within your browser using local cryptographic algorithms. Passwords never leave your device."
      },
      {
        question: "What encryption standard is used?",
        answer: "Standard PDF 1.7 128-bit encryption compatible with all major PDF viewers including Adobe Acrobat, Apple Preview, and Chrome."
      }
    ],
    relatedSlugs: ["unlock-pdf", "flatten-pdf", "pdf-metadata"]
  },
  {
    id: "unlock-pdf",
    slug: "unlock-pdf",
    name: "Unlock PDF",
    category: "pdf",
    description: "Remove password protection and printing restrictions from PDFs.",
    detailedDescription: "Remove restrictive permissions and passwords from PDFs you have the right to access. Saarvi decrypts files locally without sending data across the network.",
    icon: "Unlock",
    route: "/tools/unlock-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("unlock-pdf"),
    keywords: ["unlock pdf", "remove pdf password", "decrypt pdf", "unprotect pdf", "pdf restrictions"],
    howItWorks: [
      "Select your protected PDF file.",
      "Enter the known password if prompted or strip restrictions instantly.",
      "Download the unlocked, unrestricted PDF."
    ],
    faq: [
      {
        question: "Can Saarvi crack unknown passwords?",
        answer: "No. Saarvi operates ethically and client-side. If a document requires an open password, you must provide it to unlock and strip permissions."
      },
      {
        question: "Can it remove print and copy restrictions?",
        answer: "Yes, restriction-only owner locks can be cleared cleanly in your browser."
      }
    ],
    relatedSlugs: ["protect-pdf", "pdf-metadata", "flatten-pdf"]
  },
  {
    id: "watermark-pdf",
    slug: "watermark-pdf",
    name: "Watermark PDF",
    category: "pdf",
    description: "Add custom text watermarks to your PDF documents.",
    detailedDescription: "Stamp confidential markers, draft notices, or custom branding on your PDF pages with full control over opacity, angle, font size, position, and page ranges.",
    icon: "Stamp",
    route: "/tools/watermark-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("watermark-pdf"),
    keywords: ["watermark pdf", "add watermark to pdf", "stamp pdf", "confidential watermark", "pdf text watermark"],
    howItWorks: [
      "Upload your PDF file.",
      "Type your watermark text, pick opacity, rotation angle, and position.",
      "Download your stamped PDF document."
    ],
    faq: [
      {
        question: "Can I apply the watermark to only specific pages?",
        answer: "Yes. You can specify single pages, ranges, or comma-separated lists like 1-3, 5, 8."
      },
      {
        question: "Does watermarking distort the original layout?",
        answer: "No. Watermarks are rendered as a transparent overlay vector layer, preserving underlying text and images."
      }
    ],
    relatedSlugs: ["page-numbers-pdf", "pdf-header-footer", "protect-pdf"]
  },
  {
    id: "page-numbers-pdf",
    slug: "page-numbers-pdf",
    name: "Add Page Numbers",
    category: "pdf",
    description: "Insert clean, customizable page numbers into your PDF.",
    detailedDescription: "Number your PDF pages with professional formatting (Page X of Y, Page X, X), flexible alignments (bottom center, top right, etc.), and custom start offsets.",
    icon: "ListOrdered",
    route: "/tools/page-numbers-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("page-numbers-pdf"),
    keywords: ["page numbers pdf", "add page numbers", "number pdf pages", "pdf pagination", "page x of y"],
    howItWorks: [
      "Upload your PDF document.",
      "Choose numbering format, placement position, and starting page number.",
      "Download the neatly paginated PDF."
    ],
    faq: [
      {
        question: "Can I skip numbering the cover page?",
        answer: "Yes, set Start Page to 2 or specify custom page ranges."
      },
      {
        question: "Can I show the total page count?",
        answer: "Yes, the Page X of Y format dynamically counts and prints the total page count."
      }
    ],
    relatedSlugs: ["pdf-header-footer", "watermark-pdf", "merge-pdf"]
  },
  {
    id: "pdf-header-footer",
    slug: "pdf-header-footer",
    name: "PDF Header & Footer",
    category: "pdf",
    description: "Add custom headers, footers, dates, and page counts to PDFs.",
    detailedDescription: "Insert running headers and footers across PDF pages. Include document titles, dates, author details, and dynamic {page} and {total} placeholders.",
    icon: "Heading",
    route: "/tools/pdf-header-footer",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-header-footer"),
    keywords: ["pdf header footer", "add header to pdf", "add footer to pdf", "running header pdf", "pdf document header"],
    howItWorks: [
      "Upload your PDF document.",
      "Enter header and footer text with optional {page} and {total} tags.",
      "Download the formatted PDF with consistent margins."
    ],
    faq: [
      {
        question: "Can I leave either header or footer empty?",
        answer: "Yes, both header and footer fields are optional."
      },
      {
        question: "Does this overwrite existing content?",
        answer: "Content is placed in page margin zones so it does not occlude existing body text."
      }
    ],
    relatedSlugs: ["page-numbers-pdf", "watermark-pdf", "pdf-metadata"]
  },
  {
    id: "pdf-metadata",
    slug: "pdf-metadata",
    name: "PDF Metadata Editor",
    category: "pdf",
    description: "View, edit, or strip PDF metadata tags and author information.",
    detailedDescription: "Inspect and modify PDF metadata properties including Title, Author, Subject, Keywords, Creator, and Producer, or sanitize tags before sharing.",
    icon: "Tags",
    route: "/tools/pdf-metadata",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-metadata"),
    keywords: ["pdf metadata", "edit pdf metadata", "remove pdf author", "clean pdf metadata", "pdf properties"],
    howItWorks: [
      "Upload your PDF file to read current metadata tags.",
      "Update fields or click Clear All to sanitize properties.",
      "Download your sanitized PDF."
    ],
    faq: [
      {
        question: "Can I remove all personal information?",
        answer: "Yes. Clearing author, producer, and title tags removes identifiable metadata from the document."
      },
      {
        question: "Does editing metadata change page content?",
        answer: "No. Only document information dictionary properties are modified; page contents remain untouched."
      }
    ],
    relatedSlugs: ["pdf-info", "protect-pdf", "flatten-pdf"]
  },
  {
    id: "flatten-pdf",
    slug: "flatten-pdf",
    name: "Flatten PDF",
    category: "pdf",
    description: "Flatten interactive fillable forms and annotations into permanent content.",
    detailedDescription: "Convert interactive AcroForms, form fields, checkboxes, and text inputs into non-editable vector page graphics to prevent accidental edits and ensure uniform printing.",
    icon: "Layers",
    route: "/tools/flatten-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("flatten-pdf"),
    keywords: ["flatten pdf", "flatten form fields", "lock pdf form", "make pdf non editable", "flatten acroform"],
    howItWorks: [
      "Upload a fillable or annotated PDF document.",
      "Click Flatten to merge all form fields into static page contents.",
      "Download the secure, unalterable PDF."
    ],
    faq: [
      {
        question: "Can someone edit the form fields after flattening?",
        answer: "No. Interactive form fields are converted directly into static page drawing operations."
      },
      {
        question: "Will it reduce print errors?",
        answer: "Yes, flattened documents render identically on all printers and government submission portals."
      }
    ],
    relatedSlugs: ["protect-pdf", "compress-pdf", "pdf-info"]
  },
  {
    id: "pdf-info",
    slug: "pdf-info",
    name: "PDF Info & Inspection",
    category: "pdf",
    description: "Inspect PDF properties, page dimensions, encryption status, and metadata.",
    detailedDescription: "Examine detailed technical information about any PDF: total pages, paper dimensions (A4, Letter), encryption status, creation timestamps, and embedded metadata.",
    icon: "Info",
    route: "/tools/pdf-info",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["PDF"],
    maxSizeMB: getMaxFileSizeMB("pdf-info"),
    keywords: ["pdf info", "pdf inspector", "check pdf pages", "pdf size", "pdf metadata viewer", "pdf details"],
    howItWorks: [
      "Upload your PDF file.",
      "Instantly view page counts, paper dimensions, encryption status, and metadata.",
      "Export report or inspect page geometry."
    ],
    faq: [
      {
        question: "Are my files uploaded for analysis?",
        answer: "Never. All inspection runs locally inside your browser memory using client-side JavaScript."
      },
      {
        question: "Does it show whether a PDF is encrypted?",
        answer: "Yes, it reports encryption status and whether forms are present."
      }
    ],
    relatedSlugs: ["pdf-metadata", "flatten-pdf", "compress-pdf"]
  },

  // --- IMAGE & SCAN TOOLKIT — PHASE 35 ---
  {
    id: "document-scanner",
    slug: "document-scanner",
    name: "Document Scanner",
    category: "image",
    description: "Scan documents, receipts, and photos into clear, readable PDFs with camera or uploads.",
    detailedDescription: "Capture physical papers with your webcam or camera, crop boundaries, apply contrast and black & white document filters, and compile multi-page PDFs.",
    icon: "Scan",
    route: "/tools/document-scanner",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "PNG", "WEBP", "BMP"],
    maxSizeMB: getMaxFileSizeMB("document-scanner"),
    keywords: ["document scanner", "scan document", "camera scan", "mobile scan", "pdf scanner", "paper scanner"],
    howItWorks: [
      "Capture with your camera or select image files.",
      "Adjust crop, rotation, brightness, and high-contrast B&W document filters.",
      "Export as a consolidated, crisp PDF."
    ],
    faq: [
      {
        question: "Is my camera feed uploaded to the server?",
        answer: "Never. Camera capture and canvas filters execute entirely inside your local browser."
      },
      {
        question: "Can I scan multiple pages into one PDF?",
        answer: "Yes, you can queue multiple captures and export them as a single multi-page PDF."
      }
    ],
    relatedSlugs: ["scan-to-pdf", "photo-to-document", "image-to-pdf"]
  },
  {
    id: "scan-to-pdf",
    slug: "scan-to-pdf",
    name: "Scan to PDF",
    category: "image",
    description: "Convert photos and scanned images into a clean, searchable PDF document.",
    detailedDescription: "Transform scanned photos into print-ready A4 or proportional PDFs with automatic orientation and contrast enhancement.",
    icon: "FileCheck",
    route: "/tools/scan-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "PNG", "WEBP", "BMP"],
    maxSizeMB: getMaxFileSizeMB("scan-to-pdf"),
    keywords: ["scan to pdf", "convert scans", "scanned photos to pdf", "image to pdf", "paper scan"],
    howItWorks: [
      "Upload your scanned page photos.",
      "Reorder pages and apply clean document filters.",
      "Download the compiled PDF."
    ],
    faq: [
      {
        question: "Can I rearrange the order of scanned pages?",
        answer: "Yes, you can reorder pages before compiling."
      },
      {
        question: "What page sizes are supported?",
        answer: "You can choose standard A4 or match the original image dimensions."
      }
    ],
    relatedSlugs: ["document-scanner", "photo-to-document", "merge-pdf"]
  },
  {
    id: "photo-to-document",
    slug: "photo-to-document",
    name: "Photo to Document",
    category: "image",
    description: "Enhance smartphone photos of documents, receipts, and whiteboard notes.",
    detailedDescription: "Equalize uneven lighting, boost contrast, and convert paper phone photos into high-legibility document scans.",
    icon: "Camera",
    route: "/tools/photo-to-document",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "PNG", "WEBP", "BMP"],
    maxSizeMB: getMaxFileSizeMB("photo-to-document"),
    keywords: ["photo to document", "clean photo", "receipt scanner", "whiteboard photo enhancer", "paper cleanup"],
    howItWorks: [
      "Upload a smartphone photo of any document or receipt.",
      "The engine boosts contrast and removes background shadows.",
      "Download as a clean document PDF or enhanced image."
    ],
    faq: [
      {
        question: "Does this work on handwritten notes?",
        answer: "Yes, the binarization algorithm highlights ink strokes while eliminating gray paper shadows."
      },
      {
        question: "Can I compare before and after?",
        answer: "Yes, you can toggle between original and enhanced previews."
      }
    ],
    relatedSlugs: ["document-scanner", "scan-to-pdf", "id-photo"]
  },

  // --- STUDENT & ACADEMIC UTILITIES ---
  {
    id: "id-photo",
    slug: "id-photo",
    name: "ID Photo Utility",
    category: "student",
    description: "Crop and prepare photos for student IDs, passports and exam forms.",
    detailedDescription: "Scheduled for Phase 3: Specialized biometric cropping utility with aspect guides for official college ID cards, passport standards (35x45mm, 2x2 in), and exam registrations.",
    icon: "Camera",
    route: "/tools/id-photo",
    status: "coming_soon",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["JPG", "JPEG", "PNG"],
    maxSizeMB: 25,
    keywords: ["id photo", "passport photo", "visa photo", "student id", "biometric", "exam form photo", "35x45"],
    howItWorks: [
      "This utility is scheduled for Phase 3."
    ],
    faq: [
      {
        question: "When will this tool be available?",
        answer: "ID Photo Utility with passport biometric guides is scheduled for Phase 3."
      }
    ],
    relatedSlugs: ["image-resize", "jpg-to-pdf"]
  },
  {
    id: "resume-builder",
    slug: "resume-builder",
    name: "Resume Builder",
    category: "student",
    subcategory: "career",
    badge: "ATS Templates",
    description: "ATS-friendly student resume builder with live preview.",
    detailedDescription: "Create professional ATS-optimized student resumes with real-time vector preview, customizable templates, and clean PDF export.",
    icon: "GraduationCap",
    route: "/student/resume",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["resume builder", "resume", "cv maker", "curriculum vitae", "ats resume", "student resume", "job application"],
    howItWorks: [
      "Fill in your education, technical skills, projects, and work experience.",
      "Switch between ATS Classic, ATS Modern, and Student Clean templates with live preview.",
      "Export directly to clean vector PDF with instant 3-second auto-download."
    ],
    faq: [
      {
        question: "Is Resume Builder completely free?",
        answer: "Yes, 100% free with unlimited draft saving and vector PDF exports."
      }
    ],
    relatedSlugs: ["cover-letter", "certificates", "internships"]
  },
  {
    id: "cover-letter",
    slug: "cover-letter",
    name: "Cover Letter Builder",
    category: "student",
    subcategory: "career",
    badge: "Vector PDF",
    description: "Tailored professional cover letters with live preview and PDF export.",
    detailedDescription: "Generate clean, well-formatted cover letters matching your resume style with customizable classic, modern, and minimal templates.",
    icon: "FileText",
    route: "/student/cover-letter",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["cover letter", "cover letter builder", "job application letter", "internship letter", "cover letter maker"],
    howItWorks: [
      "Enter your background, the target company, and key project highlights.",
      "Preview the tailored cover letter live in your browser.",
      "Export to selectable vector PDF ready for applications."
    ],
    faq: [],
    relatedSlugs: ["resume-builder", "internships"]
  },
  {
    id: "cgpa-calculator",
    slug: "cgpa-calculator",
    name: "VTU CGPA Calculator",
    category: "student",
    subcategory: "academic",
    badge: "VTU 2022 Scheme",
    description: "Cumulative GPA calculator with official VTU 2022 percentage conversion and 8-semester progression.",
    detailedDescription: "Calculate cumulative grade point averages using official VTU credit-weighted formulas, progression timeline, and official (CGPA - 0.75) * 10 percentage conversion.",
    icon: "Award",
    route: "/student/cgpa-calculator",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["cgpa", "cgpa calculator", "vtu cgpa", "vtu 2022", "vtu percentage", "gpa", "cumulative gpa", "weighted credits", "grade points", "college gpa", "vtu calculator", "semester tracker"],
    howItWorks: [
      "Select your university grading scale (official VTU 2022 or general 10-point).",
      "Enter semester SGPAs and earned credits.",
      "View calculated CGPA, official percentage, and timeline progression curve."
    ],
    faq: [],
    relatedSlugs: ["sgpa-calculator", "percentage", "attendance"]
  },
  {
    id: "sgpa-calculator",
    slug: "sgpa-calculator",
    name: "VTU SGPA Calculator",
    category: "student",
    subcategory: "academic",
    badge: "VTU 2022 Scheme",
    description: "Calculate VTU semester SGPA with preloaded official courses, locked credits, CIE/SEE inputs, and elective options.",
    detailedDescription: "Official VTU 2022 Scheme calculator for CSE, ISE, AIML, and ECE. Auto-populates official course codes, credit weightages, and assesses passing thresholds (CIE >= 20, SEE >= 18).",
    icon: "Layers",
    route: "/student/sgpa-calculator",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["sgpa", "sgpa calculator", "vtu sgpa", "vtu 2022", "vtu marks", "vtu grading", "semester gpa", "semester grade", "credits calculation", "cie see", "vtu calculator", "semester tracker"],
    howItWorks: [
      "Select Semester, Branch, and Scheme (VTU 2022 Scheme).",
      "Enter Continuous Internal Evaluation (CIE) and Semester End Exam (SEE) marks.",
      "View automated letter grades, grade points, and official VTU SGPA with transparent calculation breakdown."
    ],
    faq: [],
    relatedSlugs: ["cgpa-calculator", "marks-calculator"]
  },
  {
    id: "percentage",
    slug: "percentage",
    name: "Percentage Calculator",
    category: "student",
    subcategory: "academic",
    badge: "Aggregate",
    description: "Multi-subject aggregate percentage and total marks calculator.",
    detailedDescription: "Calculate overall percentage from obtained and maximum marks across all courses with grade estimates.",
    icon: "Calculator",
    route: "/student/percentage",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["percentage", "percentage calculator", "calculate marks", "marks percentage", "score percentage", "academic percentage"],
    howItWorks: [
      "Add your subjects with obtained and maximum marks.",
      "Calculate total marks, maximum marks, and overall percentage."
    ],
    faq: [],
    relatedSlugs: ["marks-calculator", "cgpa-calculator"]
  },
  {
    id: "attendance",
    slug: "attendance",
    name: "Attendance Calculator",
    category: "student",
    subcategory: "academic",
    badge: "Target 75%",
    description: "Calculate current attendance % and classes required to meet target.",
    detailedDescription: "Determine current attendance ratio, how many upcoming classes you must attend to meet the required threshold, or your safe bunk margin.",
    icon: "Clock",
    route: "/student/attendance",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["attendance", "attendance calculator", "bunk calculator", "classes needed", "attendance percentage", "75 attendance", "academic attendance"],
    howItWorks: [
      "Enter total classes conducted and classes you attended.",
      "Set your university target threshold (e.g. 75% or 80%).",
      "Get exact count of consecutive classes required or safe skips."
    ],
    faq: [],
    relatedSlugs: ["study-planner", "cgpa-calculator"]
  },
  {
    id: "marks-calculator",
    slug: "marks-calculator",
    name: "Marks Calculator",
    category: "student",
    subcategory: "academic",
    badge: "40:60 / 50:50",
    description: "Internal and external composite marks with configurable weightage.",
    detailedDescription: "Calculate total subject scores combining internal assessments and semester-end examinations using 40:60, 50:50, or custom weightages.",
    icon: "GraduationCap",
    route: "/student/marks-calculator",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["marks", "marks calculator", "internal marks", "external marks", "composite marks", "weightage", "required marks", "target marks", "what marks do i need"],
    howItWorks: [
      "Choose your university weightage ratio (40:60, 50:50, etc.).",
      "Enter internal and external test scores for your courses.",
      "View composite percentage and scaled scores."
    ],
    faq: [],
    relatedSlugs: ["percentage", "cgpa-calculator"]
  },
  {
    id: "study-planner",
    slug: "study-planner",
    name: "Study Planner",
    category: "student",
    subcategory: "planning",
    badge: "Conflict Alerts",
    description: "Plan revision sessions, study blocks, and track task completion.",
    detailedDescription: "Daily and upcoming study planner with priority scoring, interval overlap conflict detection, and progress checks.",
    icon: "Calendar",
    route: "/student/study-planner",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["study plan", "study planner", "revision planner", "study session", "exam prep", "conflict detector", "academic planner"],
    howItWorks: [
      "Add study sessions with subject, duration, and priority.",
      "Filter by Today, Upcoming, and Completed sessions with automatic conflict alerts."
    ],
    faq: [],
    relatedSlugs: ["assignment-planner", "timetable"]
  },
  {
    id: "assignment-planner",
    slug: "assignment-planner",
    name: "Assignment Planner",
    category: "student",
    subcategory: "planning",
    badge: "Priority Sort",
    description: "Coursework and problem set deadlines tracker with overdue alerts.",
    detailedDescription: "Track homework deadlines, project milestones, and lab reports with deterministic multi-criteria urgency sorting.",
    icon: "FileText",
    route: "/student/assignment-planner",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["assignment", "assignment planner", "homework tracker", "deadline tracker", "coursework", "urgency sort"],
    howItWorks: [
      "Enter assignment title, course, and due date.",
      "Track status from Not Started to In Progress and Completed."
    ],
    faq: [],
    relatedSlugs: ["study-planner", "timetable"]
  },
  {
    id: "timetable",
    slug: "timetable",
    name: "Timetable Generator",
    category: "student",
    subcategory: "planning",
    badge: "Vector PDF",
    description: "Weekly class schedule builder with print and PDF vector export.",
    detailedDescription: "Design your weekly lecture and lab routine with interval overlap conflict detection, print views, and clean PDF downloads.",
    icon: "CalendarDays",
    route: "/student/timetable",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["timetable", "timetable generator", "weekly schedule", "class routine", "class timetable", "schedule conflict"],
    howItWorks: [
      "Add your courses to specific days of the week with start/end times.",
      "View on weekly desktop grid or day-by-day mobile view with real conflict warnings.",
      "Export to clean printable vector PDF."
    ],
    faq: [],
    relatedSlugs: ["study-planner", "attendance"]
  },
  {
    id: "certificates",
    slug: "certificates",
    name: "Certificate Organizer",
    category: "student",
    subcategory: "organization",
    badge: "Zero Uploads",
    description: "Track course credentials, verification links, and achievement IDs.",
    detailedDescription: "Privacy-first metadata organizer for academic certificates, online courses, and competition honors with duplicate credential detection.",
    icon: "Award",
    route: "/student/certificates",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["certificate", "certificate organizer", "credentials", "course certificates", "credential id", "duplicate detection"],
    howItWorks: [
      "Record certificate titles, issuing bodies, dates, and verification URLs.",
      "Filter by Course, Academic, Competition, or Internship categories."
    ],
    faq: [],
    relatedSlugs: ["resume-builder", "internships", "hackathons"]
  },
  {
    id: "internships",
    slug: "internships",
    name: "Internship Tracker",
    category: "student",
    subcategory: "organization",
    badge: "Stages",
    description: "Track co-op and internship applications from applied to offer.",
    detailedDescription: "Monitor application stages, interview rounds, upcoming deadlines, and offers with real statistics.",
    icon: "Briefcase",
    route: "/student/internships",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["internship", "internship tracker", "job tracker", "application tracker", "co-op", "interview tracker"],
    howItWorks: [
      "Add company name, role, and application date.",
      "Update status across Assessment, Interview, and Offer stages."
    ],
    faq: [],
    relatedSlugs: ["resume-builder", "cover-letter", "hackathons"]
  },
  {
    id: "hackathons",
    slug: "hackathons",
    name: "Hackathon Tracker",
    category: "student",
    subcategory: "organization",
    badge: "Deadlines",
    description: "Track hackathon registrations, team members, and deadlines.",
    detailedDescription: "Keep organized records of coding contests, team rosters, submission cutoffs, and placements.",
    icon: "Trophy",
    route: "/student/hackathons",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: [],
    maxSizeMB: 0,
    keywords: ["hackathon", "hackathon tracker", "coding contest", "hackathon deadlines", "team name"],
    howItWorks: [
      "Enter hackathon name, organizer, dates, and team details.",
      "Track your progress from Registered to Finalist or Winner."
    ],
    faq: [],
    relatedSlugs: ["internships", "certificates"]
  },
  {
    id: "notes-to-pdf",
    slug: "notes-to-pdf",
    name: "Notes to PDF",
    category: "student",
    subcategory: "documents",
    badge: "Multi-Page",
    description: "Convert lecture notes and whiteboard photos into study documents.",
    detailedDescription: "Specialized conversion for notebook and whiteboard photos into clean multi-page PDFs.",
    icon: "Layers",
    route: "/tools/multiple-images-to-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["JPG", "JPEG", "PNG"],
    maxSizeMB: 50,
    keywords: ["notes to pdf", "notebook to pdf", "lecture notes", "handwritten scan", "whiteboard", "study documents"],
    howItWorks: [
      "Select your notebook snapshots or whiteboard photos.",
      "Reorder pages and compile into a single structured study PDF."
    ],
    faq: [],
    relatedSlugs: ["multiple-images-to-pdf", "jpg-to-pdf"]
  },

  // --- AI & OCR INTELLIGENT DOCUMENT LAYER (PHASE 22) ---
  {
    id: "ocr-image",
    slug: "ocr-image",
    name: "Image to Text (OCR)",
    category: "ocr",
    badge: "OCR",
    description: "Extract editable text from photos, scans, and screenshots.",
    detailedDescription: "Extract text from images with pre-processing, editable preview, copy, and text file export.",
    icon: "ScanText",
    route: "/tools/ocr-image",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
    inputFormats: ["image/jpeg", "image/png", "image/webp"],
    maxSizeMB: 15,
    requiresExternalProcessing: true,
    supportsLocalProcessing: false,
    supportsOCR: true,
    supportsAI: false,
    privacyLevel: "external",
    processor: "ocr-image",
    limits: { maxMB: 15, maxPixels: 4000000 },
    keywords: ["ocr", "image to text", "extract text", "photo to text", "scan text", "picture text", "screenshot ocr"],
    howItWorks: [
      "Upload or drop your image document.",
      "Review privacy notice and consent to OCR processing.",
      "View, edit, copy, or download the extracted plain text."
    ],
    faq: [
      {
        question: "Is OCR 100% accurate?",
        answer: "OCR results may contain recognition errors, especially on handwritten or low-contrast text. Always review the output before using it."
      }
    ],
    relatedSlugs: ["ocr-pdf", "document-summary"]
  },
  {
    id: "ocr-pdf",
    slug: "ocr-pdf",
    name: "Scanned PDF to Text",
    category: "ocr",
    badge: "OCR",
    description: "Extract text from scanned PDFs or create searchable PDFs with text layer.",
    detailedDescription: "Select page ranges or process scanned multi-page PDFs into text or generate searchable PDFs.",
    icon: "FileSearch",
    route: "/tools/ocr-pdf",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["PDF"],
    inputFormats: ["application/pdf"],
    maxSizeMB: 25,
    requiresExternalProcessing: true,
    supportsLocalProcessing: false,
    supportsOCR: true,
    supportsAI: false,
    privacyLevel: "external",
    processor: "ocr-pdf",
    limits: { maxPages: 20, maxMB: 25 },
    keywords: ["ocr pdf", "scanned pdf to text", "searchable pdf", "pdf ocr", "extract pdf text"],
    howItWorks: [
      "Upload your scanned PDF document.",
      "Select specific pages or page range to process.",
      "Extract text or generate a searchable PDF with embedded text layer."
    ],
    faq: [
      {
        question: "What is a searchable PDF?",
        answer: "A searchable PDF embeds an invisible text layer over the scanned pages, allowing you to select, copy, and search text using standard PDF readers."
      }
    ],
    relatedSlugs: ["ocr-image", "document-summary"]
  },
  {
    id: "document-summary",
    slug: "document-summary",
    name: "Document Summarizer",
    category: "ai",
    subcategory: "documents",
    badge: "AI",
    description: "Generate concise, standard, or detailed summaries and key takeaways.",
    detailedDescription: "Extract key points, summaries, and executive bullet points from study notes, articles, or reports.",
    icon: "Sparkles",
    route: "/tools/document-summary",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["TXT", "PDF", "MD"],
    inputFormats: ["text/plain", "application/pdf", "text/markdown"],
    maxSizeMB: 10,
    requiresExternalProcessing: true,
    supportsLocalProcessing: false,
    supportsOCR: false,
    supportsAI: true,
    privacyLevel: "external",
    processor: "ai-summarize",
    limits: { maxChars: 50000, maxMB: 10 },
    keywords: ["ai summary", "document summarizer", "summarize pdf", "key points", "tldr", "notes summary"],
    howItWorks: [
      "Paste text or upload a plain text/PDF document.",
      "Select summary length: Brief, Standard, or Detailed.",
      "Review the AI-generated summary and key takeaways."
    ],
    faq: [
      {
        question: "Can AI make mistakes?",
        answer: "Yes. AI-generated answers may be incorrect. Verify important information against the original document."
      }
    ],
    relatedSlugs: ["document-qa", "ocr-pdf"]
  },
  {
    id: "document-qa",
    slug: "document-qa",
    name: "Ask This Document",
    category: "ai",
    subcategory: "documents",
    badge: "AI Q&A",
    description: "Ask questions and get answers with citations from your document text.",
    detailedDescription: "Lightweight, privacy-respecting document question answering with chunk citations and zero vector database overhead.",
    icon: "MessageSquareText",
    route: "/tools/document-qa",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["TXT", "PDF", "MD"],
    inputFormats: ["text/plain", "application/pdf", "text/markdown"],
    maxSizeMB: 10,
    requiresExternalProcessing: true,
    supportsLocalProcessing: false,
    supportsOCR: false,
    supportsAI: true,
    privacyLevel: "external",
    processor: "ai-qa",
    limits: { maxChars: 50000, maxMB: 10 },
    keywords: ["ask document", "document qa", "chat with pdf", "query document", "ai reading assistant"],
    howItWorks: [
      "Upload or paste document text.",
      "Type your question about the content.",
      "The system retrieves relevant text chunks and answers with cited context."
    ],
    faq: [
      {
        question: "Does Saarvi store my document on a remote server?",
        answer: "No. Documents are processed ephemerally in-session. Only the relevant context chunks needed to answer your question are sent to the AI provider."
      }
    ],
    relatedSlugs: ["document-summary", "ocr-image"]
  },
  {
    id: "resume-feedback",
    slug: "resume-feedback",
    name: "AI Resume Review",
    category: "ai",
    subcategory: "career",
    badge: "AI Career",
    description: "Get constructive suggestions, clarity improvements, and gap analysis for your resume.",
    detailedDescription: "Privacy-respecting AI review of resume text for impact, structure, and suggestions while preserving deterministic formatting.",
    icon: "FileCheck",
    route: "/career/resumes",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["JSON", "TXT", "PDF"],
    inputFormats: ["text/plain", "application/json", "application/pdf"],
    maxSizeMB: 5,
    requiresExternalProcessing: true,
    supportsLocalProcessing: false,
    supportsOCR: false,
    supportsAI: true,
    privacyLevel: "external",
    processor: "ai-resume",
    limits: { maxChars: 25000, maxMB: 5 },
    keywords: ["resume feedback", "resume ai", "cv review", "ats suggestions", "resume check"],
    howItWorks: [
      "Open any resume in your Career Workspace.",
      "Request optional AI feedback on clarity and impact.",
      "Review AI suggestions and choose which ones to apply manually."
    ],
    faq: [],
    relatedSlugs: ["job-description-analysis"]
  },
  {
    id: "job-description-analysis",
    slug: "job-description-analysis",
    name: "Job Description Skill Matcher",
    category: "ai",
    subcategory: "career",
    badge: "AI Career",
    description: "Analyze job descriptions to identify required skills, responsibilities, and skill gaps.",
    detailedDescription: "Extract role keywords and skills from job postings to compare against your career profile deterministically.",
    icon: "Briefcase",
    route: "/career/skills",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["TXT", "PDF"],
    inputFormats: ["text/plain", "application/pdf"],
    maxSizeMB: 5,
    requiresExternalProcessing: true,
    supportsLocalProcessing: false,
    supportsOCR: false,
    supportsAI: true,
    privacyLevel: "external",
    processor: "ai-job",
    limits: { maxChars: 30000, maxMB: 5 },
    keywords: ["job description analysis", "skill gap ai", "job keywords", "jd parser", "career skills"],
    howItWorks: [
      "Paste a job description or vacancy notice.",
      "AI extracts structured requirements, skills, and keywords.",
      "Saarvi compares them with your career skills using deterministic Set-matching."
    ],
    faq: [],
    relatedSlugs: ["resume-feedback"]
  },
  {
    id: "study-assistant",
    slug: "study-assistant",
    name: "AI Study Assistant",
    category: "student",
    subcategory: "academic",
    badge: "AI Study",
    description: "Explain course concepts, generate review questions, and synthesize revision points.",
    detailedDescription: "Privacy-respecting study intelligence for lecture notes and syllabus topics with strict academic calculation separation.",
    icon: "GraduationCap",
    route: "/student/study-assistant",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: false,
    supportedFormats: ["TXT", "MD"],
    inputFormats: ["text/plain", "text/markdown"],
    maxSizeMB: 10,
    requiresExternalProcessing: true,
    supportsLocalProcessing: false,
    supportsOCR: false,
    supportsAI: true,
    privacyLevel: "external",
    processor: "ai-study",
    limits: { maxChars: 40000, maxMB: 10 },
    keywords: ["study assistant", "explain lecture", "exam questions", "revision points", "study ai"],
    howItWorks: [
      "Paste lecture notes or syllabus topic text.",
      "Receive structured explanations, key terms, and revision questions.",
      "Academic SGPA/CGPA calculations remain strictly deterministic."
    ],
    faq: [],
    relatedSlugs: ["document-summary", "notes-to-pdf"]
  },
  {
    id: "student-copilot",
    slug: "student-copilot",
    name: "AI Student & Career Copilot",
    category: "student",
    subcategory: "academic",
    badge: "AI Copilot",
    description: "Intelligent conversational assistant for VTU academics, study planning, attendance recovery, and career prep.",
    detailedDescription: "Unified AI Copilot grounded in your local workspace records with deterministic VTU calculations and user-confirmed action execution.",
    icon: "Sparkles",
    route: "/student/copilot",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["TXT", "MD"],
    maxSizeMB: 10,
    supportsAI: true,
    supportsLocalProcessing: true,
    privacyLevel: "local",
    keywords: ["copilot", "student copilot", "study assistant", "attendance copilot", "vtu copilot", "career copilot", "ask copilot"],
    howItWorks: [
      "Ask questions regarding your academic records, attendance recovery, or study schedule.",
      "Deterministic academic facts are verified locally with zero cloud calculation.",
      "Review and confirm proposed study plans or tasks before saving to your workspace."
    ],
    faq: [],
    relatedSlugs: ["copilot-interview", "study-assistant", "study-planner"]
  },
  {
    id: "copilot-interview",
    slug: "copilot-interview",
    name: "AI Mock Interview Coach",
    category: "student",
    subcategory: "career",
    badge: "AI Interview",
    description: "Interactive technical and behavioral interview practice grounded in your target role and skills.",
    detailedDescription: "Role-specific interview simulation offering constructive feedback notes, qualitative ratings, and actionable improvement tips.",
    icon: "Briefcase",
    route: "/student/copilot/interview",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["TXT"],
    maxSizeMB: 10,
    supportsAI: true,
    supportsLocalProcessing: true,
    privacyLevel: "local",
    keywords: ["mock interview", "interview coach", "interview prep", "behavioral questions", "technical interview", "placement practice"],
    howItWorks: [
      "Select your target placement role and review skills context.",
      "Answer technical and behavioral questions one by one.",
      "Receive qualitative ratings and actionable tips for continuous improvement."
    ],
    faq: [],
    relatedSlugs: ["student-copilot", "resume-builder", "career-workspace"]
  },
  {
    id: "student-notes",
    slug: "student-notes",
    name: "Study Notes",
    category: "student",
    subcategory: "planning",
    badge: "Local",
    description: "Create, organize, and search private revision summaries and lecture notes locally.",
    detailedDescription: "Private, searchable student notes stored entirely in your local browser. Organize lecture summaries, key formulas, and exam prep definitions with zero cloud upload.",
    icon: "FileText",
    route: "/student/notes",
    status: "available",
    requiresAuth: false,
    requiresPro: false,
    popular: true,
    supportedFormats: ["TXT"],
    maxSizeMB: 5,
    keywords: ["student notes", "study notes", "lecture notes", "exam notes", "private notes", "revision notes"],
    howItWorks: [
      "Click New Note and enter your title, tags, and content.",
      "Instant keyword search filters your notes across all subjects.",
      "Export notes as TXT or backup all records safely as JSON."
    ],
    faq: [
      {
        question: "Are my study notes saved to the cloud?",
        answer: "No. All notes are saved 100% locally in your browser storage for complete privacy."
      }
    ],
    relatedSlugs: ["study-planner", "assignment-planner", "exam-tracker"]
  }
];

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOLS_CONFIG.find((t) => t.slug === slug);
}

export function getPopularTools(): ToolDefinition[] {
  return TOOLS_CONFIG.filter((t) => t.popular);
}

export function getToolsByCategory(category: ToolDefinition["category"]): ToolDefinition[] {
  return TOOLS_CONFIG.filter((t) => t.category === category);
}

export function getAITools(): ToolDefinition[] {
  return TOOLS_CONFIG.filter((t) => t.category === "ai" || t.supportsAI);
}

export function getOCRTools(): ToolDefinition[] {
  return TOOLS_CONFIG.filter((t) => t.category === "ocr" || t.supportsOCR);
}

export function getStudentTools(): ToolDefinition[] {
  return TOOLS_CONFIG.filter((t) => t.category === "student" && t.status === "available");
}

export function getStudentToolsBySubcategory(subcategory: NonNullable<ToolDefinition["subcategory"]>): ToolDefinition[] {
  return TOOLS_CONFIG.filter(
    (t) => t.category === "student" && t.subcategory === subcategory && t.status === "available"
  );
}

