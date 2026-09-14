import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { validateInputFile, sanitizeFilename, sanitizeHtmlContent } from "../../security/file-security";

export { sanitizeHtmlContent };

export interface HtmlToPdfConfig {
  pageSize?: "A4" | "Letter";
}

interface HtmlBlockElement {
  type: "h1" | "h2" | "h3" | "h4" | "p" | "li" | "table" | "hr";
  text?: string;
  listMarker?: string;
  tableRows?: string[][];
}

/**
 * Parses sanitized HTML into structured document blocks
 */
function parseHtmlToBlocks(html: string): HtmlBlockElement[] {
  const blocks: HtmlBlockElement[] = [];

  // Browser DOMParser path
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const body = doc.body;

      const walkNode = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();

          if (tag === "h1") {
            blocks.push({ type: "h1", text: el.textContent?.trim() || "" });
          } else if (tag === "h2") {
            blocks.push({ type: "h2", text: el.textContent?.trim() || "" });
          } else if (tag === "h3") {
            blocks.push({ type: "h3", text: el.textContent?.trim() || "" });
          } else if (tag === "h4" || tag === "h5" || tag === "h6") {
            blocks.push({ type: "h4", text: el.textContent?.trim() || "" });
          } else if (tag === "p") {
            const txt = el.textContent?.trim();
            if (txt) blocks.push({ type: "p", text: txt });
          } else if (tag === "li") {
            const txt = el.textContent?.trim();
            if (txt) blocks.push({ type: "li", text: txt, listMarker: "•" });
          } else if (tag === "hr") {
            blocks.push({ type: "hr" });
          } else if (tag === "table") {
            const rows: string[][] = [];
            const trElements = el.querySelectorAll("tr");
            trElements.forEach((tr) => {
              const cells: string[] = [];
              tr.querySelectorAll("th, td").forEach((cell) => {
                cells.push(cell.textContent?.trim() || "");
              });
              if (cells.length > 0) rows.push(cells);
            });
            if (rows.length > 0) {
              blocks.push({ type: "table", tableRows: rows });
            }
          } else {
            node.childNodes.forEach(walkNode);
          }
        }
      };

      body.childNodes.forEach(walkNode);
      if (blocks.length > 0) return blocks;
    } catch {
      // Fallback to regex parser
    }
  }

  // Regex / text-based fallback parser
  const clean = html.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "");

  // Match headings, paragraphs, lists, and tables
  const tagRegex = /<(h[1-6]|p|li|hr|table)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let match;

  while ((match = tagRegex.exec(clean)) !== null) {
    const rawTag = (match[1] || "hr").toLowerCase();
    const innerHtml = match[2] || "";

    if (rawTag === "hr") {
      blocks.push({ type: "hr" });
    } else if (rawTag === "h1") {
      const text = innerHtml.replace(/<[^>]+>/g, "").trim();
      if (text) blocks.push({ type: "h1", text });
    } else if (rawTag === "h2") {
      const text = innerHtml.replace(/<[^>]+>/g, "").trim();
      if (text) blocks.push({ type: "h2", text });
    } else if (rawTag === "h3") {
      const text = innerHtml.replace(/<[^>]+>/g, "").trim();
      if (text) blocks.push({ type: "h3", text });
    } else if (rawTag.startsWith("h")) {
      const text = innerHtml.replace(/<[^>]+>/g, "").trim();
      if (text) blocks.push({ type: "h4", text });
    } else if (rawTag === "p") {
      const text = innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ type: "p", text });
    } else if (rawTag === "li") {
      const text = innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ type: "li", text, listMarker: "•" });
    } else if (rawTag === "table") {
      const rows: string[][] = [];
      const trMatches = innerHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      for (const tr of trMatches) {
        const rowCells: string[] = [];
        const cellMatches = tr[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi);
        for (const c of cellMatches) {
          rowCells.push(c[1].replace(/<[^>]+>/g, " ").trim());
        }
        if (rowCells.length > 0) rows.push(rowCells);
      }
      if (rows.length > 0) {
        blocks.push({ type: "table", tableRows: rows });
      }
    }
  }

  // If no blocks matched tags, fallback to stripped text
  if (blocks.length === 0) {
    const stripped = clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (stripped) {
      blocks.push({ type: "p", text: stripped });
    }
  }

  return blocks;
}

/**
 * Wraps text into lines that fit within maxWidth
 */
function wrapHtmlText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testW = font.widthOfTextAtSize(testLine, fontSize);

    if (testW <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) <= maxWidth) {
            chunk += ch;
          } else {
            lines.push(chunk);
            chunk = ch;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

/**
 * Converts a single HTML document file into a clean, genuine PDF document
 */
async function convertSingleHtmlToPdf(
  file: File,
  _config: HtmlToPdfConfig = {},
  onProgress?: (pct: number) => void
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number }> {
  const securityCheck = await validateInputFile(file, ["html", "txt"], 25 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid HTML file structure.");
  }

  if (onProgress) onProgress(15);

  const rawHtml = await file.text();
  if (!rawHtml.trim()) {
    throw new Error("The HTML file is empty.");
  }

  // Strict security sanitization
  const cleanHtml = sanitizeHtmlContent(rawHtml);
  const blocks = parseHtmlToBlocks(cleanHtml);

  if (blocks.length === 0) {
    throw new Error("No readable text or content found in the HTML document.");
  }

  if (onProgress) onProgress(35);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const printableWidth = pageWidth - margin * 2;

  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);

  let currentY = pageHeight - margin;

  const checkPageBreak = (neededHeight: number): void => {
    if (currentY - neededHeight < margin + 25) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      currentY = pageHeight - margin;
    }
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "h1") {
      checkPageBreak(35);
      currentPage.drawText(block.text || "", {
        x: margin,
        y: currentY - 18,
        size: 18,
        font: fontBold,
        color: rgb(0.06, 0.09, 0.16),
      });
      currentY -= 32;
    } else if (block.type === "h2") {
      checkPageBreak(28);
      currentPage.drawText(block.text || "", {
        x: margin,
        y: currentY - 14,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.24),
      });
      currentY -= 26;
    } else if (block.type === "h3" || block.type === "h4") {
      checkPageBreak(22);
      currentPage.drawText(block.text || "", {
        x: margin,
        y: currentY - 12,
        size: 12,
        font: fontBold,
        color: rgb(0.15, 0.2, 0.3),
      });
      currentY -= 20;
    } else if (block.type === "p") {
      const fontSize = 10;
      const lineHeight = 14;
      const lines = wrapHtmlText(block.text || "", fontRegular, fontSize, printableWidth);

      for (const line of lines) {
        checkPageBreak(lineHeight);
        currentPage.drawText(line, {
          x: margin,
          y: currentY - fontSize,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.33),
        });
        currentY -= lineHeight;
      }
      currentY -= 6; // Paragraph spacing
    } else if (block.type === "li") {
      const fontSize = 10;
      const lineHeight = 14;
      const bulletIndent = 16;
      const lines = wrapHtmlText(block.text || "", fontRegular, fontSize, printableWidth - bulletIndent);

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        checkPageBreak(lineHeight);
        if (lIdx === 0) {
          currentPage.drawText(block.listMarker || "•", {
            x: margin + 4,
            y: currentY - fontSize,
            size: fontSize,
            font: fontBold,
            color: rgb(0.25, 0.45, 0.85),
          });
        }
        currentPage.drawText(lines[lIdx], {
          x: margin + bulletIndent,
          y: currentY - fontSize,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.33),
        });
        currentY -= lineHeight;
      }
      currentY -= 2;
    } else if (block.type === "hr") {
      checkPageBreak(15);
      currentPage.drawLine({
        start: { x: margin, y: currentY - 6 },
        end: { x: margin + printableWidth, y: currentY - 6 },
        thickness: 0.5,
        color: rgb(0.88, 0.91, 0.94),
      });
      currentY -= 16;
    } else if (block.type === "table" && block.tableRows && block.tableRows.length > 0) {
      const rows = block.tableRows;
      const numCols = Math.max(...rows.map((r) => r.length));
      const colWidth = printableWidth / numCols;
      const cellFontSize = 8.5;
      const cellLineHeight = 11;

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const isHeader = rIdx === 0;
        const font = isHeader ? fontBold : fontRegular;

        // Measure row height
        const cellLinesArr = row.map((cellText) =>
          wrapHtmlText(cellText, font, cellFontSize, Math.max(15, colWidth - 8))
        );
        const maxLines = Math.max(1, ...cellLinesArr.map((cl) => cl.length));
        const rowHeight = maxLines * cellLineHeight + 8;

        checkPageBreak(rowHeight);

        // Header background
        if (isHeader) {
          currentPage.drawRectangle({
            x: margin,
            y: currentY - rowHeight,
            width: printableWidth,
            height: rowHeight,
            color: rgb(0.94, 0.96, 0.98),
          });
        }

        // Draw cells
        for (let c = 0; c < numCols; c++) {
          const lines = cellLinesArr[c] || [];
          let textY = currentY - 4 - cellFontSize;

          for (const l of lines) {
            currentPage.drawText(l, {
              x: margin + c * colWidth + 4,
              y: textY,
              size: cellFontSize,
              font,
              color: isHeader ? rgb(0.06, 0.09, 0.16) : rgb(0.2, 0.25, 0.33),
            });
            textY -= cellLineHeight;
          }

          // Vertical border
          currentPage.drawLine({
            start: { x: margin + (c + 1) * colWidth, y: currentY },
            end: { x: margin + (c + 1) * colWidth, y: currentY - rowHeight },
            thickness: 0.5,
            color: rgb(0.88, 0.91, 0.94),
          });
        }

        // Left & bottom borders
        currentPage.drawLine({
          start: { x: margin, y: currentY },
          end: { x: margin, y: currentY - rowHeight },
          thickness: 0.5,
          color: rgb(0.88, 0.91, 0.94),
        });
        currentPage.drawLine({
          start: { x: margin, y: currentY - rowHeight },
          end: { x: margin + printableWidth, y: currentY - rowHeight },
          thickness: 0.5,
          color: rgb(0.88, 0.91, 0.94),
        });

        currentY -= rowHeight;
      }
      currentY -= 10;
    }

    if (onProgress && i % 10 === 0) {
      onProgress(35 + Math.round((i / blocks.length) * 55));
    }
  }

  // Footer page numbers
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const footer = `Page ${i + 1} of ${totalPages}`;
    const textW = fontRegular.widthOfTextAtSize(footer, 8);
    page.drawText(footer, {
      x: (pageWidth - textW) / 2,
      y: margin / 2,
      size: 8,
      font: fontRegular,
      color: rgb(0.6, 0.65, 0.72),
    });
  }

  if (onProgress) onProgress(95);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const filename = `${baseName}.pdf`;

  if (onProgress) onProgress(100);

  return {
    filename,
    blob,
    originalSize: file.size,
    newSize: blob.size,
  };
}

export const htmlToPdfOperation: ToolOperation<HtmlToPdfConfig, SingleFileResult | MultiFileResult> = {
  id: "html-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select an HTML file to convert to PDF." };
    }
    for (const file of files) {
      if (
        !file.name.toLowerCase().endsWith(".html") &&
        !file.name.toLowerCase().endsWith(".htm") &&
        file.type !== "text/html" &&
        file.type !== "text/plain"
      ) {
        return { valid: false, error: `"${file.name}" is not a valid HTML document.` };
      }
      if (file.size > 25 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 25MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: HtmlToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one HTML document to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSingleHtmlToPdf(files[0], config, onProgress);
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

      const res = await convertSingleHtmlToPdf(file, config, singleProgress);
      zip.file(res.filename, res.blob);
      const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(res.blob) : "";
      convertedFiles.push({ filename: res.filename, blob: res.blob, url, size: res.newSize });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const firstBase = sanitizeFilename(files[0].name.replace(/\.[^/.]+$/, ""));
    const zipFilename = `${firstBase}_and_${files.length - 1}_more_pdf.zip`;

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
