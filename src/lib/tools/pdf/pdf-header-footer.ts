import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "@/lib/utils";
import { validateInputFile, sanitizeFilename } from "@/lib/security/file-security";
import { parsePageRange } from "./page-range-parser";

export interface HeaderFooterPdfConfig {
  headerText?: string;
  footerText?: string;
  alignment?: "left" | "center" | "right";
  margin?: number; // default 30
  fontSize?: number; // default 9
  pageRange?: string; // "all" or e.g. "1-10"
}

function resolvePlaceholders(template: string, pageNum: number, totalPages: number): string {
  if (!template) return "";
  return template
    .replace(/\{page\}/gi, `${pageNum}`)
    .replace(/\{total\}/gi, `${totalPages}`);
}

export const pdfHeaderFooterOperation: ToolOperation<
  HeaderFooterPdfConfig,
  SingleFileResult | MultiFileResult
> = {
  id: "pdf-header-footer",

  validate(files: File[], config?: HeaderFooterPdfConfig): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select at least one PDF file." };
    }

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && !file.type.includes("pdf")) {
        return { valid: false, error: `"${file.name}" is not a valid PDF file.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB file limit.` };
      }
    }

    if (!config?.headerText?.trim() && !config?.footerText?.trim()) {
      return { valid: false, error: "Please provide either header text, footer text, or both." };
    }

    return { valid: true };
  },

  async execute(
    files: File[],
    config: HeaderFooterPdfConfig,
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    const headerTpl = config.headerText?.trim() || "";
    const footerTpl = config.footerText?.trim() || "";
    const alignment = config.alignment || "center";
    const margin = typeof config.margin === "number" ? config.margin : 30;
    const fontSize = typeof config.fontSize === "number" && config.fontSize > 0 ? config.fontSize : 9;

    // Single File Processing
    if (files.length === 1) {
      const file = files[0];
      const securityCheck = await validateInputFile(file, ["pdf"]);
      if (!securityCheck.valid) {
        throw new Error(securityCheck.error || "Security check failed.");
      }

      if (onProgress) onProgress(15);

      const buffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();

      let targetIndices: number[] = [];
      if (!config.pageRange || config.pageRange.trim().toLowerCase() === "all") {
        targetIndices = Array.from({ length: totalPages }, (_, i) => i);
      } else {
        const parseRes = parsePageRange(config.pageRange, totalPages);
        if (!parseRes.valid) {
          throw new Error(parseRes.error || "Invalid page range specified.");
        }
        targetIndices = parseRes.indices;
      }

      if (onProgress) onProgress(45);

      for (let i = 0; i < targetIndices.length; i++) {
        const idx = targetIndices[i];
        const page = pdfDoc.getPage(idx);
        const { width, height } = page.getSize();
        const pageNum = idx + 1;

        // Draw Header
        if (headerTpl) {
          const resolvedHeader = resolvePlaceholders(headerTpl, pageNum, totalPages);
          const textWidth = font.widthOfTextAtSize(resolvedHeader, fontSize);
          let x = (width - textWidth) / 2;
          if (alignment === "left") x = margin;
          else if (alignment === "right") x = width - margin - textWidth;

          const y = height - margin - fontSize;
          page.drawText(resolvedHeader, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.25, 0.3, 0.35),
          });
        }

        // Draw Footer
        if (footerTpl) {
          const resolvedFooter = resolvePlaceholders(footerTpl, pageNum, totalPages);
          const textWidth = font.widthOfTextAtSize(resolvedFooter, fontSize);
          let x = (width - textWidth) / 2;
          if (alignment === "left") x = margin;
          else if (alignment === "right") x = width - margin - textWidth;

          const y = margin;
          page.drawText(resolvedFooter, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.25, 0.3, 0.35),
          });
        }

        if (onProgress) {
          onProgress(45 + Math.round(((i + 1) / targetIndices.length) * 45));
        }
      }

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const finalFilename = `${cleanName}_header_footer.pdf`;
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";

      if (onProgress) onProgress(100);

      return {
        type: "single",
        blob,
        filename: finalFilename,
        originalSize: file.size,
        newSize: blob.size,
      };
    }

    // Batch Processing
    const zip = new JSZip();
    const convertedFiles: MultiFileResult["files"] = [];
    let totalOriginalSize = 0;

    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      totalOriginalSize += file.size;

      const buffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();

      for (let p = 0; p < totalPages; p++) {
        const page = pdfDoc.getPage(p);
        const { width, height } = page.getSize();
        const pageNum = p + 1;

        if (headerTpl) {
          const resolved = resolvePlaceholders(headerTpl, pageNum, totalPages);
          const textWidth = font.widthOfTextAtSize(resolved, fontSize);
          let x = (width - textWidth) / 2;
          if (alignment === "left") x = margin;
          else if (alignment === "right") x = width - margin - textWidth;

          page.drawText(resolved, {
            x,
            y: height - margin - fontSize,
            size: fontSize,
            font,
            color: rgb(0.25, 0.3, 0.35),
          });
        }

        if (footerTpl) {
          const resolved = resolvePlaceholders(footerTpl, pageNum, totalPages);
          const textWidth = font.widthOfTextAtSize(resolved, fontSize);
          let x = (width - textWidth) / 2;
          if (alignment === "left") x = margin;
          else if (alignment === "right") x = width - margin - textWidth;

          page.drawText(resolved, {
            x,
            y: margin,
            size: fontSize,
            font,
            color: rgb(0.25, 0.3, 0.35),
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ""));
      const outName = `${cleanName}_header_footer.pdf`;
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";

      zip.file(outName, pdfBytes);
      convertedFiles.push({
        blob,
        filename: outName,
        url,
        size: blob.size,
      });

      if (onProgress) {
        onProgress(Math.round(((f + 1) / files.length) * 90));
      }
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const zipBlob = new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
    const zipFilename = `header_footer_pdfs_${Date.now()}.zip`;

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
