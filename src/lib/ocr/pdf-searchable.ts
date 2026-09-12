import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Injects an invisible, selectable OCR text layer over PDF pages.
 * The visual appearance of the document is unchanged, but users can now
 * highlight, search, and copy text.
 */
export async function createSearchablePdf(
  originalPdfBytes: Uint8Array,
  pageTexts: string[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const text = pageTexts[i] || "";
    if (!text.trim()) continue;

    const { height } = page.getSize();
    const lines = text.split("\n");
    const fontSize = 9;
    const lineHeight = 13;
    let y = height - 36;

    for (const line of lines) {
      if (y < 36) break;
      // Strip non-ASCII characters for StandardFonts compatibility
      const cleanLine = line.replace(/[^\x20-\x7E]/g, " ").trim();
      if (cleanLine.length > 0) {
        // Injected with opacity: 0 (invisible overlay layer)
        page.drawText(cleanLine.slice(0, 120), {
          x: 36,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      }
      y -= lineHeight;
    }
  }

  return await pdfDoc.save();
}

/**
 * Creates a clean text-based PDF document from extracted OCR text.
 */
export async function createPdfFromExtractedText(
  title: string,
  pages: { pageNumber: number; text: string }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const p of pages) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // Header
    page.drawText(`Saarvi OCR Export — ${title}`, {
      x: 40,
      y: height - 40,
      size: 11,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.2),
    });

    page.drawText(`Page ${p.pageNumber}`, {
      x: width - 90,
      y: height - 40,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Content
    const lines = p.text.split("\n");
    let y = height - 70;
    const fontSize = 10;
    const lineHeight = 14;

    for (const line of lines) {
      if (y < 40) break;
      const cleanLine = line.replace(/[^\x20-\x7E]/g, " ").trim();
      if (cleanLine.length > 0) {
        page.drawText(cleanLine.slice(0, 95), {
          x: 40,
          y,
          size: fontSize,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
      }
      y -= lineHeight;
    }
  }

  return await pdfDoc.save();
}
