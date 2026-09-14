import type * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";
import { buildPptxPresentation, PptxSlideData, PptxSlideElement } from "./openxml-helper";
import { loadPdfjs } from "../pdf/pdfjs-loader";

export interface PdfToPowerPointConfig {
  detectScanned?: boolean;
}

interface PageTextBlock {
  text: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  fontSize: number;
  bold: boolean;
}

/**
 * Extracts structured text boxes and images from a PDF page
 */
async function extractSlideDataFromPdfPage(
  page: pdfjsLib.PDFPageProxy
): Promise<{ widthPt: number; heightPt: number; textBlocks: PageTextBlock[]; totalChars: number }> {
  const viewport = page.getViewport({ scale: 1.0 });
  const widthPt = Math.round(viewport.width);
  const heightPt = Math.round(viewport.height);

  const textContent = await page.getTextContent();
  const rawItems: Array<{
    str: string;
    x: number;
    y: number;
    fontSize: number;
    width: number;
    height: number;
    bold: boolean;
  }> = [];

  let totalChars = 0;

  for (const item of textContent.items) {
    if (!("str" in item)) continue;
    const str = item.str;
    if (!str || !str.trim()) continue;

    totalChars += str.trim().length;

    const tx = item.transform;
    const x = tx[4];
    const yFromBottom = tx[5];
    const fontSize = Math.max(8, Math.round(Math.hypot(tx[0], tx[1])));
    const fontName = ("fontName" in item ? String(item.fontName) : "").toLowerCase();
    const bold = fontName.includes("bold") || fontName.includes("black") || fontName.includes("heavy");

    // Convert to top-left coordinate system
    const y = Math.max(0, heightPt - yFromBottom - fontSize);
    const width = item.width || fontSize * str.length * 0.5;
    const height = item.height || fontSize * 1.2;

    rawItems.push({ str, x, y, fontSize, width, height, bold });
  }

  // Group items into lines (Y difference <= 4pt)
  rawItems.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: Array<{
    y: number;
    fontSize: number;
    bold: boolean;
    items: typeof rawItems;
  }> = [];

  for (const item of rawItems) {
    let matchedLine = lines.find((l) => Math.abs(l.y - item.y) <= 4);
    if (!matchedLine) {
      matchedLine = { y: item.y, fontSize: item.fontSize, bold: item.bold, items: [] };
      lines.push(matchedLine);
    }
    matchedLine.items.push(item);
  }

  // Construct text blocks from lines
  const textBlocks: PageTextBlock[] = [];

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    let combinedText = "";
    let minX = Infinity;
    let maxX = 0;

    for (const it of line.items) {
      combinedText += (combinedText ? " " : "") + it.str;
      minX = Math.min(minX, it.x);
      maxX = Math.max(maxX, it.x + it.width);
    }

    if (combinedText.trim()) {
      textBlocks.push({
        text: combinedText.trim(),
        xPt: Math.max(20, Math.round(minX)),
        yPt: Math.max(20, Math.round(line.y)),
        widthPt: Math.max(50, Math.round(maxX - minX + 20)),
        heightPt: Math.max(20, Math.round(line.fontSize * 1.5)),
        fontSize: line.fontSize,
        bold: line.bold,
      });
    }
  }

  return { widthPt, heightPt, textBlocks, totalChars };
}

/**
 * Converts a single PDF file to an authentic PPTX presentation
 */
async function convertSinglePdfToPptx(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number }> {
  const securityCheck = await validateInputFile(file, ["pdf"], 50 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid PDF file structure.");
  }

  if (onProgress) onProgress(15);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfjs = await loadPdfjs();

  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: typeof window !== "undefined" ? "/cmaps/" : undefined,
    cMapPacked: true,
    standardFontDataUrl: typeof window !== "undefined" ? "/standard_fonts/" : undefined,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  if (numPages === 0) {
    throw new Error("The PDF document contains 0 pages.");
  }

  const pptxSlides: PptxSlideData[] = [];
  let cumulativeTextLength = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const { widthPt, heightPt, textBlocks, totalChars } = await extractSlideDataFromPdfPage(page);

    cumulativeTextLength += totalChars;

    const elements: PptxSlideElement[] = textBlocks.map((block) => ({
      type: "text",
      text: block.text,
      xPt: block.xPt,
      yPt: block.yPt,
      widthPt: block.widthPt,
      heightPt: block.heightPt,
      fontSize: block.fontSize,
      bold: block.bold,
      color: "0F172A",
    }));

    pptxSlides.push({
      widthPt,
      heightPt,
      elements,
    });

    if (onProgress) {
      onProgress(15 + Math.round((pageNum / numPages) * 65));
    }
  }

  // Requirement: For scanned PDFs: explain that OCR is required for editable text.
  // Never create fake slide text.
  if (cumulativeTextLength < 10) {
    throw new Error(
      "This PDF appears to be a scanned document without editable text. OCR is required to extract editable text for PowerPoint."
    );
  }

  if (onProgress) onProgress(85);

  const pptxBytes = await buildPptxPresentation(pptxSlides);
  const blob = new Blob([pptxBytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const filename = `${baseName}.pptx`;

  if (onProgress) onProgress(100);

  return {
    filename,
    blob,
    originalSize: file.size,
    newSize: blob.size,
  };
}

export const pdfToPowerPointOperation: ToolOperation<PdfToPowerPointConfig, SingleFileResult | MultiFileResult> = {
  id: "pdf-to-powerpoint",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a PDF document to convert to PowerPoint." };
    }
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        return { valid: false, error: `"${file.name}" is not a valid PDF document.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    _config: PdfToPowerPointConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one PDF document to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSinglePdfToPptx(files[0], onProgress);
      return {
        type: "single",
        filename: res.filename,
        blob: res.blob,
        originalSize: res.originalSize,
        newSize: res.newSize,
      };
    }

    // Batch conversion
    const zip = new JSZip();
    const convertedFiles: MultiFileResult["files"] = [];
    let totalOriginalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalOriginalSize += file.size;

      const singleProgress = (pct: number) => {
        if (onProgress) {
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          onProgress(overall);
        }
      };

      const res = await convertSinglePdfToPptx(file, singleProgress);
      zip.file(res.filename, res.blob);
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(res.blob) : "";
      convertedFiles.push({ filename: res.filename, blob: res.blob, url, size: res.newSize });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const firstBase = sanitizeFilename(files[0].name.replace(/\.[^/.]+$/, ""));
    const zipFilename = `${firstBase}_and_${files.length - 1}_more_presentation.zip`;

    if (onProgress) onProgress(100);

    return {
      type: "multiple",
      zipBlob,
      zipFilename,
      files: convertedFiles,
      originalSize: totalOriginalSize,
      newSize: zipBlob.size,
    };
  },
};
