import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { ToolOperation, SingleFileResult, MultiFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";
import { parseXlsxWorkbook } from "./openxml-helper";

export interface ExcelToPdfConfig {
  sheetSelection?: string | "all"; // Specific sheet name or "all"
  pageSize?: "A4" | "Letter";
  orientation?: "auto" | "portrait" | "landscape";
}

/**
 * Wraps text to fit within a given column width
 */
function wrapCellText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If a single word is wider than maxWidth, clip or split
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

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/**
 * Converts a single XLSX file to a clean, genuine PDF document
 */
async function convertSingleXlsxToPdf(
  file: File,
  config: ExcelToPdfConfig = {},
  onProgress?: (pct: number) => void
): Promise<{ filename: string; blob: Blob; originalSize: number; newSize: number }> {
  const securityCheck = await validateInputFile(file, ["xlsx"], 50 * 1024 * 1024);
  if (!securityCheck.valid) {
    throw new Error(securityCheck.error || "Invalid Excel (.xlsx) file structure.");
  }

  if (onProgress) onProgress(15);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const allSheets = await parseXlsxWorkbook(arrayBuffer);

  if (!allSheets || allSheets.length === 0) {
    throw new Error("No worksheets found in this Excel workbook.");
  }

  // Filter sheets by user selection
  let targetSheets = allSheets;
  if (config.sheetSelection && config.sheetSelection !== "all") {
    targetSheets = allSheets.filter((s) => s.name.toLowerCase() === config.sheetSelection?.toLowerCase());
    if (targetSheets.length === 0) targetSheets = allSheets;
  }

  // Filter out completely empty sheets
  targetSheets = targetSheets.filter((s) => s.rows.length > 0 && s.rows.some((r) => r.some((c) => String(c ?? "").trim() !== "")));
  if (targetSheets.length === 0) {
    throw new Error("Selected worksheets contain no readable cell data.");
  }

  if (onProgress) onProgress(35);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const fontSize = 9;
  const headerFontSize = 9.5;
  const rowPaddingY = 5;

  const pagesTotalAccumulator: PDFPage[] = [];

  for (let sIdx = 0; sIdx < targetSheets.length; sIdx++) {
    const sheet = targetSheets[sIdx];
    const rows = sheet.rows;
    if (rows.length === 0) continue;

    // Determine column count
    const numCols = Math.max(...rows.map((r) => r.length));
    if (numCols === 0) continue;

    // Determine page orientation: Landscape if > 6 columns or wide content
    let isLandscape = config.orientation === "landscape";
    if (config.orientation === "portrait") {
      isLandscape = false;
    } else if (config.orientation !== "landscape") {
      isLandscape = numCols > 6;
    }

    const pageWidth = isLandscape ? 841.89 : 595.28;
    const pageHeight = isLandscape ? 595.28 : 841.89;
    const printableWidth = pageWidth - margin * 2;

    // Calculate column widths based on content lengths
    const colMaxChars: number[] = new Array(numCols).fill(5);
    for (const r of rows) {
      for (let c = 0; c < numCols; c++) {
        const val = String(r[c] ?? "");
        colMaxChars[c] = Math.max(colMaxChars[c], Math.min(val.length, 40));
      }
    }

    const totalChars = colMaxChars.reduce((sum, v) => sum + v, 0);
    const colWidths: number[] = colMaxChars.map((chars) => {
      const rawW = (chars / totalChars) * printableWidth;
      return Math.max(40, rawW); // minimum 40 points per column
    });

    // Scale colWidths to fit exactly within printableWidth
    const actualTotalW = colWidths.reduce((sum, v) => sum + v, 0);
    const scaleFactor = printableWidth / actualTotalW;
    for (let c = 0; c < numCols; c++) {
      colWidths[c] = colWidths[c] * scaleFactor;
    }

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pagesTotalAccumulator.push(currentPage);

    let currentY = pageHeight - margin;

    // Draw Sheet Title Header
    currentPage.drawText(sheet.name || `Sheet ${sIdx + 1}`, {
      x: margin,
      y: currentY - 14,
      size: 14,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    currentY -= 30;

    // Helper to draw a single table row
    const drawRow = (
      page: PDFPage,
      rowValues: (string | number | boolean | null | undefined)[],
      y: number,
      isHeader: boolean
    ): number => {
      const font = isHeader ? fontBold : fontRegular;
      const fSize = isHeader ? headerFontSize : fontSize;
      const textColor = isHeader ? rgb(0.06, 0.09, 0.16) : rgb(0.2, 0.25, 0.33);

      // Measure height needed for wrapped lines in each cell
      const cellLines: string[][] = [];
      let maxLinesInRow = 1;

      for (let c = 0; c < numCols; c++) {
        const text = String(rowValues[c] ?? "");
        const maxTextW = colWidths[c] - 10; // 5pt padding left and right
        const lines = wrapCellText(text, font, fSize, Math.max(20, maxTextW));
        cellLines.push(lines);
        maxLinesInRow = Math.max(maxLinesInRow, lines.length);
      }

      const lineHeight = fSize + 3;
      const rowHeight = maxLinesInRow * lineHeight + rowPaddingY * 2;

      // Draw row background fill
      if (isHeader) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: printableWidth,
          height: rowHeight,
          color: rgb(0.94, 0.96, 0.98), // soft slate-100 header fill
        });
      }

      // Draw bottom row border line
      page.drawLine({
        start: { x: margin, y: y - rowHeight },
        end: { x: margin + printableWidth, y: y - rowHeight },
        thickness: 0.5,
        color: rgb(0.88, 0.91, 0.94),
      });

      // Draw cell text and vertical borders
      let colX = margin;
      for (let c = 0; c < numCols; c++) {
        const lines = cellLines[c];
        let textY = y - rowPaddingY - fSize;

        for (const line of lines) {
          if (line) {
            page.drawText(line, {
              x: colX + 5,
              y: textY,
              size: fSize,
              font,
              color: textColor,
            });
          }
          textY -= lineHeight;
        }

        colX += colWidths[c];

        // Draw vertical cell border
        page.drawLine({
          start: { x: colX, y },
          end: { x: colX, y: y - rowHeight },
          thickness: 0.5,
          color: rgb(0.88, 0.91, 0.94),
        });
      }

      // Left outer border
      page.drawLine({
        start: { x: margin, y },
        end: { x: margin, y: y - rowHeight },
        thickness: 0.5,
        color: rgb(0.88, 0.91, 0.94),
      });

      return rowHeight;
    };

    // Draw header row
    const headerRow = rows[0];
    let headerHeight = drawRow(currentPage, headerRow, currentY, true);
    currentY -= headerHeight;

    // Draw data rows
    for (let r = 1; r < rows.length; r++) {
      const rowData = rows[r];

      // Estimated row height check for page overflow
      const maxCharInCell = Math.max(...rowData.map((c) => String(c ?? "").length));
      const estLines = Math.max(1, Math.ceil(maxCharInCell / 15));
      const estHeight = estLines * (fontSize + 3) + rowPaddingY * 2;

      // Page break check (leave 50pt for bottom margin / page number)
      if (currentY - estHeight < margin + 20) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        pagesTotalAccumulator.push(currentPage);
        currentY = pageHeight - margin;

        // Repeat header row on new page
        headerHeight = drawRow(currentPage, headerRow, currentY, true);
        currentY -= headerHeight;
      }

      const actualHeight = drawRow(currentPage, rowData, currentY, false);
      currentY -= actualHeight;
    }

    if (onProgress) {
      onProgress(35 + Math.round(((sIdx + 1) / targetSheets.length) * 55));
    }
  }

  // Add Page Numbers in footer
  const totalPages = pagesTotalAccumulator.length;
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const page = pagesTotalAccumulator[pIdx];
    const { width } = page.getSize();
    const footerText = `Page ${pIdx + 1} of ${totalPages}`;
    const textW = fontRegular.widthOfTextAtSize(footerText, 8);
    page.drawText(footerText, {
      x: (width - textW) / 2,
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

export const excelToPdfOperation: ToolOperation<ExcelToPdfConfig, SingleFileResult | MultiFileResult> = {
  id: "excel-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select an Excel (.xlsx) document to convert to PDF." };
    }
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".xlsx") && !file.type.includes("spreadsheet")) {
        return { valid: false, error: `"${file.name}" is not a valid Microsoft Excel (.xlsx) file.` };
      }
      if (file.size > 50 * 1024 * 1024) {
        return { valid: false, error: `"${file.name}" exceeds the 50MB limit.` };
      }
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: ExcelToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult | MultiFileResult> {
    if (!files || files.length === 0) {
      throw new Error("Please select at least one Excel spreadsheet to convert.");
    }

    // Single file conversion
    if (files.length === 1) {
      const res = await convertSingleXlsxToPdf(files[0], config, onProgress);
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

      const res = await convertSingleXlsxToPdf(file, config, singleProgress);
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
