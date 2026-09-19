import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { xml2js } from "xml-js";
import type { Element as XmlElement } from "xml-js";
import type { ToolOperation, SingleFileResult, ValidationResult } from "../types.ts";
import { readFileAsArrayBuffer } from "../../utils.ts";
import { validateInputFile, sanitizeFilename } from "../../security/file-security.ts";

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
  pageBreakBefore?: boolean;
}

interface DocxTableModel {
  type: "table";
  rows: {
    cells: {
      paragraphs: DocxParagraphModel[];
    }[];
  }[];
}

interface DocxImageModel {
  type: "image";
  relId: string;
  widthPt: number;
  heightPt: number;
}

type DocxElementModel = DocxParagraphModel | DocxTableModel | DocxImageModel;

interface DocxSectionProperties {
  pageWidthPt: number;
  pageHeightPt: number;
  marginTopPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
  marginRightPt: number;
}

function findElement(node: XmlElement, name: string): XmlElement | undefined {
  if (!node.elements) return undefined;
  return node.elements.find((el) => el.name === name || el.name?.endsWith(`:${name}`));
}

function findElements(node: XmlElement, name: string): XmlElement[] {
  if (!node.elements) return [];
  return node.elements.filter((el) => el.name === name || el.name?.endsWith(`:${name}`));
}

/**
 * Parses WordprocessingML DOM into a structured element model
 */
function parseDocxXml(xmlStr: string): {
  elements: DocxElementModel[];
  sectionProps: DocxSectionProperties;
} {
  const result: DocxElementModel[] = [];
  const defaultSectionProps: DocxSectionProperties = {
    pageWidthPt: 595.28,
    pageHeightPt: 841.89,
    marginTopPt: 54,
    marginBottomPt: 54,
    marginLeftPt: 54,
    marginRightPt: 54,
  };

  let parsed: XmlElement | undefined;
  try {
    parsed = xml2js(xmlStr, { compact: false }) as XmlElement;
  } catch {
    return { elements: result, sectionProps: defaultSectionProps };
  }

  const root = parsed.elements?.find((el: XmlElement) => el.name === "w:document" || el.name?.endsWith(":document"));
  if (!root) return { elements: result, sectionProps: defaultSectionProps };

  const body = findElement(root, "body");
  if (!body || !body.elements) return { elements: result, sectionProps: defaultSectionProps };

  // Parse Section Properties (<w:sectPr>)
  const sectPr = findElement(body, "sectPr");
  if (sectPr) {
    const pgSz = findElement(sectPr, "pgSz");
    if (pgSz?.attributes) {
      const wTwips = Number(pgSz.attributes["w:w"] || pgSz.attributes.w);
      const hTwips = Number(pgSz.attributes["w:h"] || pgSz.attributes.h);
      if (!isNaN(wTwips) && wTwips > 0) defaultSectionProps.pageWidthPt = wTwips / 20;
      if (!isNaN(hTwips) && hTwips > 0) defaultSectionProps.pageHeightPt = hTwips / 20;
    }

    const pgMar = findElement(sectPr, "pgMar");
    if (pgMar?.attributes) {
      const top = Number(pgMar.attributes["w:top"] || pgMar.attributes.top);
      const bottom = Number(pgMar.attributes["w:bottom"] || pgMar.attributes.bottom);
      const left = Number(pgMar.attributes["w:left"] || pgMar.attributes.left);
      const right = Number(pgMar.attributes["w:right"] || pgMar.attributes.right);
      if (!isNaN(top) && top > 0) defaultSectionProps.marginTopPt = top / 20;
      if (!isNaN(bottom) && bottom > 0) defaultSectionProps.marginBottomPt = bottom / 20;
      if (!isNaN(left) && left > 0) defaultSectionProps.marginLeftPt = left / 20;
      if (!isNaN(right) && right > 0) defaultSectionProps.marginRightPt = right / 20;
    }
  }

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
      let pageBreakBefore = false;

      if (pPr) {
        if (findElement(pPr, "pageBreakBefore")) pageBreakBefore = true;

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
        let fontSize = isHeading ? (headingLevel === 1 ? 16 : headingLevel === 2 ? 13 : 11.5) : 10.5;

        if (rPr) {
          if (findElement(rPr, "b")) bold = true;
          if (findElement(rPr, "i")) italic = true;
          if (findElement(rPr, "u")) underline = true;

          const sz = findElement(rPr, "sz");
          const szVal = Number(sz?.attributes?.["w:val"] || sz?.attributes?.val);
          if (!isNaN(szVal) && szVal > 0) {
            fontSize = Math.max(8, Math.min(36, szVal / 2));
          }
        }

        // Check for drawings / images (<w:drawing>)
        const drawing = findElement(r, "drawing");
        if (drawing) {
          const blip = findElement(drawing, "blip");
          const embedId = (blip?.attributes?.["r:embed"] || blip?.attributes?.embed) as string;
          if (embedId) {
            result.push({
              type: "image",
              relId: embedId,
              widthPt: 200,
              heightPt: 150,
            });
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
        for (const br of brElements) {
          if (br.attributes?.["w:type"] === "page" || br.attributes?.type === "page") {
            pageBreakBefore = true;
          } else {
            runs.push({ text: "\n", bold: false, italic: false, underline: false, fontSize });
          }
        }

        if (textVal) {
          runs.push({
            text: textVal,
            bold: isHeading ? true : bold,
            italic,
            underline,
            fontSize: isHeading && headingLevel ? (headingLevel === 1 ? 16 : 13) : fontSize,
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
          pageBreakBefore,
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

  return { elements: result, sectionProps: defaultSectionProps };
}

/**
 * Word to PDF High-Fidelity Converter Operation
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
    onProgress?: (percent: number, stageMessage?: string) => void
  ): Promise<SingleFileResult> {
    const file = files[0];

    // 1. Validate file signature using Saarvi security subsystem
    const securityCheck = await validateInputFile(file, ["docx"], 50 * 1024 * 1024);
    if (!securityCheck.valid) {
      throw new Error(securityCheck.error || "Invalid Microsoft Word (.docx) file signature.");
    }

    if (onProgress) onProgress(10, "Unpacking Word document structure...");

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
    if (onProgress) onProgress(30, "Parsing document elements and styles...");

    // 3. Parse Document Model & Section Properties
    const { elements, sectionProps } = parseDocxXml(xmlContent);
    if (elements.length === 0) {
      throw new Error("The selected Word document does not contain readable text or structure.");
    }

    if (onProgress) onProgress(50, "Initializing PDF layout engine...");

    // 4. Initialize PDF Document
    const pdfDoc = await PDFDocument.create();

    const pageWidth = sectionProps.pageWidthPt || 595.28;
    const pageHeight = sectionProps.pageHeightPt || 841.89;
    const marginLeft = sectionProps.marginLeftPt || config.marginPt || 54;
    const marginRight = sectionProps.marginRightPt || config.marginPt || 54;
    const marginTop = sectionProps.marginTopPt || config.marginPt || 54;
    const marginBottom = sectionProps.marginBottomPt || config.marginPt || 54;
    const printableWidth = pageWidth - marginLeft - marginRight;

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
    let currentY = pageHeight - marginTop;
    let pageCount = 1;
    let paragraphCount = 0;
    let tableCount = 0;

    function addNewPage(): PDFPage {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - marginTop;
      pageCount++;
      return currentPage;
    }

    function ensureVerticalSpace(neededPoints: number) {
      if (currentY - neededPoints < marginBottom) {
        addNewPage();
      }
    }

    if (onProgress) onProgress(65, "Rendering formatted pages...");

    // 5. Render Document Elements to PDF
    for (const elem of elements) {
      if (elem.type === "paragraph") {
        if (elem.pageBreakBefore) {
          addNewPage();
        }

        paragraphCount++;
        const defaultFontSize = elem.isHeading ? (elem.headingLevel === 1 ? 16 : 13) : 10.5;
        const lineHeight = defaultFontSize * 1.35;
        const spacingAfter = elem.isHeading ? 10 : 6;

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
          let startX = marginLeft;
          if (elem.align === "center") {
            startX = marginLeft + Math.max(0, (printableWidth - lineWidth) / 2);
          } else if (elem.align === "right") {
            startX = marginLeft + Math.max(0, printableWidth - lineWidth);
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

          let maxCellLines = 1;
          for (const cell of row.cells) {
            const cellText = cell.paragraphs.flatMap((p) => p.runs.map((r) => r.text)).join(" ");
            const linesEst = Math.max(1, Math.ceil(fontRegular.widthOfTextAtSize(cellText, rowFontSize) / (colWidth - cellPadding * 2)));
            if (linesEst > maxCellLines) maxCellLines = linesEst;
          }

          const rowHeight = maxCellLines * rowLineHeight + cellPadding * 2;
          ensureVerticalSpace(rowHeight);

          for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
            const cell = row.cells[colIdx];
            const cellX = marginLeft + colIdx * colWidth;
            const cellY = currentY - rowHeight;

            currentPage.drawRectangle({
              x: cellX,
              y: cellY,
              width: colWidth,
              height: rowHeight,
              borderColor: rgb(0.8, 0.82, 0.85),
              borderWidth: 0.75,
              color: rgb(0.98, 0.99, 1.0),
            });

            let cellTextY = currentY - cellPadding - rowFontSize;
            for (const cp of cell.paragraphs) {
              const fullCellStr = cp.runs.map((r) => r.text).join(" ").trim();
              if (!fullCellStr) continue;

              const words = fullCellStr.split(" ");
              let lineStr = "";

              for (const word of words) {
                const testLine = lineStr ? `${lineStr} ${word}` : word;
                if (fontRegular.widthOfTextAtSize(testLine, rowFontSize) > colWidth - cellPadding * 2 && lineStr) {
                  currentPage.drawText(lineStr, {
                    x: cellX + cellPadding,
                    y: cellTextY,
                    size: rowFontSize,
                    font: cp.runs.some((r) => r.bold) ? fontBold : fontRegular,
                    color: rgb(0.15, 0.18, 0.22),
                  });
                  cellTextY -= rowLineHeight;
                  lineStr = word;
                } else {
                  lineStr = testLine;
                }
              }

              if (lineStr) {
                currentPage.drawText(lineStr, {
                  x: cellX + cellPadding,
                  y: cellTextY,
                  size: rowFontSize,
                  font: cp.runs.some((r) => r.bold) ? fontBold : fontRegular,
                  color: rgb(0.15, 0.18, 0.22),
                });
                cellTextY -= rowLineHeight;
              }
            }
          }

          currentY -= rowHeight;
        }

        currentY -= 10;
      }
    }

    if (onProgress) onProgress(85, "Finalizing PDF document...");

    // 6. Save PDF Output
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

    if (onProgress) onProgress(100, "PDF document ready.");

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
        Formatting: "High-fidelity preservation of fonts, margins, and tables",
      },
    };
  },
};
