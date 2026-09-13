import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { xml2js, Element as XmlElement } from "xml-js";
import { ToolOperation, SingleFileResult, ValidationResult } from "../types";
import { readFileAsArrayBuffer } from "../../utils";
import { validateInputFile, sanitizeFilename } from "../../security/file-security";

export interface WordToPdfConfig {
  pageSize?: "A4" | "Letter";
  marginPt?: number;
}

interface DocxFormattedRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number; // in pt
}

interface DocxParagraphModel {
  type: "paragraph";
  isHeading: boolean;
  headingLevel?: number; // 1, 2, 3
  isListItem?: boolean;
  listMarker?: string;
  align: "left" | "center" | "right";
  runs: DocxFormattedRun[];
}

interface DocxTableModel {
  type: "table";
  rows: {
    cells: {
      paragraphs: DocxParagraphModel[];
    }[];
  }[];
}

type DocxElementModel = DocxParagraphModel | DocxTableModel;

/**
 * Parses WordprocessingML DOM into a structured element model
 */
function parseDocxXml(xmlStr: string): DocxElementModel[] {
  const result: DocxElementModel[] = [];

  let parsed: XmlElement | undefined;
  try {
    parsed = xml2js(xmlStr, { compact: false }) as XmlElement;
  } catch {
    return result;
  }

  function findElement(node: XmlElement, name: string): XmlElement | undefined {
    if (!node.elements) return undefined;
    return node.elements.find((el) => el.name === name || el.name?.endsWith(`:${name}`));
  }

  function findElements(node: XmlElement, name: string): XmlElement[] {
    if (!node.elements) return [];
    return node.elements.filter((el) => el.name === name || el.name?.endsWith(`:${name}`));
  }

  const root = parsed.elements?.find((el: XmlElement) => el.name === "w:document" || el.name?.endsWith(":document"));
  if (!root) return result;

  const body = findElement(root, "body");
  if (!body || !body.elements) return result;

  for (const child of body.elements) {
    const tagName = child.name?.replace(/^.*:/, "");

    // 1. Paragraph element (<w:p>)
    if (tagName === "p") {
      const pPr = findElement(child, "pPr");
      let isHeading = false;
      let headingLevel: number | undefined = undefined;
      let align: "left" | "center" | "right" = "left";
      let isListItem = false;
      let listMarker: string | undefined = undefined;

      if (pPr) {
        // Heading detection
        const pStyle = findElement(pPr, "pStyle");
        const styleVal = (pStyle?.attributes?.["w:val"] || pStyle?.attributes?.val || "") as string;
        if (/Heading1/i.test(styleVal) || /Title/i.test(styleVal)) {
          isHeading = true;
          headingLevel = 1;
        } else if (/Heading2/i.test(styleVal)) {
          isHeading = true;
          headingLevel = 2;
        } else if (/Heading3/i.test(styleVal)) {
          isHeading = true;
          headingLevel = 3;
        }

        // Alignment detection
        const jc = findElement(pPr, "jc");
        const jcVal = (jc?.attributes?.["w:val"] || jc?.attributes?.val || "") as string;
        if (jcVal === "center") align = "center";
        else if (jcVal === "right") align = "right";

        // List detection
        const numPr = findElement(pPr, "numPr");
        if (numPr) {
          isListItem = true;
          listMarker = `• `;
        }
      }

      const runs: DocxFormattedRun[] = [];
      const runElements = findElements(child, "r");

      for (const r of runElements) {
        const rPr = findElement(r, "rPr");
        let bold = false;
        let italic = false;
        let underline = false;
        let fontSize = isHeading ? (headingLevel === 1 ? 18 : headingLevel === 2 ? 14 : 12) : 10.5;

        if (rPr) {
          if (findElement(rPr, "b")) bold = true;
          if (findElement(rPr, "i")) italic = true;
          if (findElement(rPr, "u")) underline = true;

          const sz = findElement(rPr, "sz");
          const szVal = Number(sz?.attributes?.["w:val"] || sz?.attributes?.val);
          if (!isNaN(szVal) && szVal > 0) {
            fontSize = Math.max(8, Math.min(36, szVal / 2)); // half-points to points
          }
        }

        // Collect text nodes (<w:t>)
        const tElements = findElements(r, "t");
        let textVal = "";
        for (const t of tElements) {
          if (t.elements && t.elements[0]?.type === "text") {
            textVal += t.elements[0].text || "";
          }
        }

        // Line break nodes (<w:br>)
        const brElements = findElements(r, "br");
        if (brElements.length > 0 && !textVal) {
          runs.push({ text: "\n", bold: false, italic: false, underline: false, fontSize });
        }

        if (textVal) {
          runs.push({
            text: textVal,
            bold: isHeading ? true : bold,
            italic,
            underline,
            fontSize: isHeading && headingLevel ? (headingLevel === 1 ? 18 : 14) : fontSize,
          });
        }
      }

      if (runs.length > 0) {
        result.push({
          type: "paragraph",
          isHeading,
          headingLevel,
          isListItem,
          listMarker,
          align,
          runs,
        });
      }
    }

    // 2. Table element (<w:tbl>)
    else if (tagName === "tbl") {
      const rows: { cells: { paragraphs: DocxParagraphModel[] }[] }[] = [];
      const trElements = findElements(child, "tr");

      for (const tr of trElements) {
        const cells: { paragraphs: DocxParagraphModel[] }[] = [];
        const tcElements = findElements(tr, "tc");

        for (const tc of tcElements) {
          const cellParagraphs: DocxParagraphModel[] = [];
          const cellPElements = findElements(tc, "p");

          for (const cp of cellPElements) {
            const cellRuns: DocxFormattedRun[] = [];
            const rElements = findElements(cp, "r");

            for (const r of rElements) {
              const rPr = findElement(r, "rPr");
              const bold = Boolean(rPr && findElement(rPr, "b"));
              const italic = Boolean(rPr && findElement(rPr, "i"));
              const underline = Boolean(rPr && findElement(rPr, "u"));

              const tElements = findElements(r, "t");
              let textVal = "";
              for (const t of tElements) {
                if (t.elements && t.elements[0]?.type === "text") {
                  textVal += t.elements[0].text || "";
                }
              }

              if (textVal) {
                cellRuns.push({
                  text: textVal,
                  bold,
                  italic,
                  underline,
                  fontSize: 9.5,
                });
              }
            }

            if (cellRuns.length > 0) {
              cellParagraphs.push({
                type: "paragraph",
                isHeading: false,
                align: "left",
                runs: cellRuns,
              });
            }
          }

          cells.push({ paragraphs: cellParagraphs });
        }

        if (cells.length > 0) {
          rows.push({ cells });
        }
      }

      if (rows.length > 0) {
        result.push({
          type: "table",
          rows,
        });
      }
    }
  }

  return result;
}

/**
 * Word to PDF Local Converter Operation
 * Reads Microsoft Word (.docx) OpenXML archives and generates standard, multi-page PDF documents.
 */
export const wordToPdfOperation: ToolOperation<WordToPdfConfig, SingleFileResult> = {
  id: "word-to-pdf",

  validate(files: File[]): ValidationResult {
    if (!files || files.length === 0) {
      return { valid: false, error: "Please select a Word document (.docx) to convert." };
    }
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return { valid: false, error: `"${file.name}" is not a valid Microsoft Word (.docx) document.` };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 50MB limit for browser conversion." };
    }
    return { valid: true };
  },

  async execute(
    files: File[],
    config: WordToPdfConfig = {},
    onProgress?: (percent: number) => void
  ): Promise<SingleFileResult> {
    const file = files[0];

    // 1. Validate file signature using Saarvi security subsystem
    const securityCheck = await validateInputFile(file, ["docx"], 50 * 1024 * 1024);
    if (!securityCheck.valid) {
      throw new Error(securityCheck.error || "Invalid Microsoft Word (.docx) file signature.");
    }

    if (onProgress) onProgress(10);

    // 2. Unzip OpenXML container using JSZip
    const arrayBuffer = await readFileAsArrayBuffer(file);
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(arrayBuffer);
    } catch {
      throw new Error("Unable to unpack Word document archive. File may be corrupted or password-protected.");
    }

    const documentXmlFile = zip.file("word/document.xml");
    if (!documentXmlFile) {
      throw new Error("Invalid Word document: missing primary document structure (word/document.xml).");
    }

    const xmlContent = await documentXmlFile.async("text");
    if (onProgress) onProgress(30);

    // 3. Parse Document Model
    const elements = parseDocxXml(xmlContent);
    if (elements.length === 0) {
      throw new Error("The selected Word document does not contain readable text or structure.");
    }

    if (onProgress) onProgress(50);

    // 4. Initialize PDF Document
    const pdfDoc = await PDFDocument.create();

    // Standard A4 dimensions (points)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = config.marginPt ?? 50;
    const printableWidth = pageWidth - margin * 2;

    // Embed standard fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    function pickFont(bold: boolean, italic: boolean): PDFFont {
      if (bold && italic) return fontBoldItalic;
      if (bold) return fontBold;
      if (italic) return fontItalic;
      return fontRegular;
    }

    let currentPage: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;
    let pageCount = 1;
    let paragraphCount = 0;
    let tableCount = 0;

    function addNewPage(): PDFPage {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
      pageCount++;
      return currentPage;
    }

    function ensureVerticalSpace(neededPoints: number) {
      if (currentY - neededPoints < margin) {
        addNewPage();
      }
    }

    // 5. Render Document Elements to PDF
    for (const elem of elements) {
      // --- Render Paragraph ---
      if (elem.type === "paragraph") {
        paragraphCount++;
        const defaultFontSize = elem.isHeading ? (elem.headingLevel === 1 ? 18 : 14) : 10.5;
        const lineHeight = defaultFontSize * 1.35;
        const spacingAfter = elem.isHeading ? 12 : 8;

        // Build flat words with formatting tokens
        interface WordToken {
          word: string;
          bold: boolean;
          italic: boolean;
          underline: boolean;
          fontSize: number;
          width: number;
        }

        const tokens: WordToken[] = [];

        if (elem.isListItem && elem.listMarker) {
          const mFont = fontBold;
          tokens.push({
            word: elem.listMarker,
            bold: true,
            italic: false,
            underline: false,
            fontSize: defaultFontSize,
            width: mFont.widthOfTextAtSize(elem.listMarker, defaultFontSize),
          });
        }

        for (const run of elem.runs) {
          if (run.text === "\n") {
            tokens.push({
              word: "\n",
              bold: false,
              italic: false,
              underline: false,
              fontSize: run.fontSize,
              width: 0,
            });
            continue;
          }

          const rFont = pickFont(run.bold, run.italic);
          const rawWords = run.text.split(/(\s+)/);

          for (const w of rawWords) {
            if (!w) continue;
            tokens.push({
              word: w,
              bold: run.bold,
              italic: run.italic,
              underline: run.underline,
              fontSize: run.fontSize,
              width: rFont.widthOfTextAtSize(w, run.fontSize),
            });
          }
        }

        // Wrap tokens into lines
        const wrappedLines: WordToken[][] = [];
        let currLine: WordToken[] = [];
        let currLineWidth = 0;

        for (const tok of tokens) {
          if (tok.word === "\n") {
            wrappedLines.push(currLine);
            currLine = [];
            currLineWidth = 0;
            continue;
          }

          if (currLineWidth + tok.width > printableWidth && currLine.length > 0) {
            wrappedLines.push(currLine);
            currLine = [];
            currLineWidth = 0;
          }

          currLine.push(tok);
          currLineWidth += tok.width;
        }
        if (currLine.length > 0) {
          wrappedLines.push(currLine);
        }

        // Draw each wrapped line
        for (const lineTokens of wrappedLines) {
          ensureVerticalSpace(lineHeight);

          const lineWidth = lineTokens.reduce((sum, t) => sum + t.width, 0);
          let startX = margin;
          if (elem.align === "center") {
            startX = margin + Math.max(0, (printableWidth - lineWidth) / 2);
          } else if (elem.align === "right") {
            startX = margin + Math.max(0, printableWidth - lineWidth);
          }

          let drawX = startX;
          for (const t of lineTokens) {
            if (t.word.trim()) {
              const font = pickFont(t.bold, t.italic);
              const color = elem.isHeading ? rgb(0.1, 0.15, 0.25) : rgb(0.18, 0.2, 0.24);

              currentPage.drawText(t.word, {
                x: drawX,
                y: currentY - t.fontSize,
                size: t.fontSize,
                font,
                color,
              });

              if (t.underline) {
                currentPage.drawLine({
                  start: { x: drawX, y: currentY - t.fontSize - 1.5 },
                  end: { x: drawX + t.width, y: currentY - t.fontSize - 1.5 },
                  thickness: 0.75,
                  color,
                });
              }
            }
            drawX += t.width;
          }

          currentY -= lineHeight;
        }

        currentY -= spacingAfter;
      }

      // --- Render Table ---
      else if (elem.type === "table") {
        tableCount++;
        ensureVerticalSpace(30);

        const colCount = Math.max(...elem.rows.map((r) => r.cells.length), 1);
        const colWidth = printableWidth / colCount;
        const cellPadding = 5;

        for (const row of elem.rows) {
          const rowFontSize = 9.5;
          const rowLineHeight = rowFontSize * 1.3;

          // Compute row height based on cell text content
          let maxCellLines = 1;
          for (const cell of row.cells) {
            const cellText = cell.paragraphs.flatMap((p) => p.runs.map((r) => r.text)).join(" ");
            const linesEst = Math.max(1, Math.ceil(fontRegular.widthOfTextAtSize(cellText, rowFontSize) / (colWidth - cellPadding * 2)));
            if (linesEst > maxCellLines) maxCellLines = linesEst;
          }

          const rowHeight = maxCellLines * rowLineHeight + cellPadding * 2;
          ensureVerticalSpace(rowHeight);

          // Draw cells
          for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
            const cell = row.cells[colIdx];
            const cellX = margin + colIdx * colWidth;
            const cellY = currentY - rowHeight;

            // Border
            currentPage.drawRectangle({
              x: cellX,
              y: cellY,
              width: colWidth,
              height: rowHeight,
              borderColor: rgb(0.75, 0.78, 0.82),
              borderWidth: 0.75,
              color: rgb(0.98, 0.99, 1.0),
            });

            // Cell Text
            let cellTextY = currentY - cellPadding - rowFontSize;
            for (const cp of cell.paragraphs) {
              const fullCellStr = cp.runs.map((r) => r.text).join(" ").trim();
              if (!fullCellStr) continue;

              // Truncate or fit inside column
              let textToDraw = fullCellStr;
              while (textToDraw.length > 3 && fontRegular.widthOfTextAtSize(textToDraw, rowFontSize) > colWidth - cellPadding * 2) {
                textToDraw = textToDraw.slice(0, -4) + "...";
              }

              currentPage.drawText(textToDraw, {
                x: cellX + cellPadding,
                y: cellTextY,
                size: rowFontSize,
                font: cp.runs.some((r) => r.bold) ? fontBold : fontRegular,
                color: rgb(0.15, 0.18, 0.22),
              });

              cellTextY -= rowLineHeight;
            }
          }

          currentY -= rowHeight;
        }

        currentY -= 12; // spacing after table
      }
    }

    if (onProgress) onProgress(85);

    // 6. Save PDF Output
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

    if (onProgress) onProgress(100);

    const safeBaseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
    const filename = `${safeBaseName}.pdf`;

    return {
      type: "single",
      blob: pdfBlob,
      filename,
      originalSize: file.size,
      newSize: pdfBlob.size,
      details: {
        "Pages Generated": pageCount,
        "Paragraphs Converted": paragraphCount,
        "Tables Converted": tableCount,
        Note: "Basic document formatting is supported. Complex Word layouts may require minor adjustment.",
      },
    };
  },
};
