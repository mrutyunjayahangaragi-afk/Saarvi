/**
 * Client-Side Academic Report PDF Generation Engine
 *
 * Implements Prompt Section 30, 57:
 * - Generates high-fidelity vector PDF using pdf-lib
 * - 100% In-Browser Privacy: No marks or personal data uploaded to any server
 * - Comprehensive semester-by-semester transcript summary
 * - Unofficial analysis disclaimer prominently marked
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CanonicalSemesterResult } from './providers/vtu-result-provider';
import { AcademicSchemeRegistry } from './scheme-registry';

export interface AcademicReportData {
  usn: string;
  studentName?: string;
  schemeId: string;
  branchName: string;
  collegeName?: string;
  cgpa: number;
  percentageEquivalent: number;
  totalCreditsEarned: number;
  activeBacklogs: number;
  semesters: CanonicalSemesterResult[];
}

export async function generateAcademicReportPdf(data: AcademicReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points (72 DPI)
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const primaryColor = rgb(0.12, 0.38, 0.94); // Saarvi Royal Blue
  const darkSlate = rgb(0.06, 0.09, 0.16);
  const mutedText = rgb(0.4, 0.45, 0.55);
  const lightBg = rgb(0.96, 0.97, 0.99);
  const borderLine = rgb(0.88, 0.9, 0.94);

  let cursorY = height - 50;

  // 1. Header Banner & Branding
  page.drawRectangle({
    x: 40,
    y: cursorY - 45,
    width: width - 80,
    height: 55,
    color: lightBg,
    borderColor: borderLine,
    borderWidth: 1,
  });

  page.drawText('SAARVI ACADEMIC PERFORMANCE REPORT', {
    x: 55,
    y: cursorY - 18,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText('Unofficial Student Performance & CGPA Analysis Workspace', {
    x: 55,
    y: cursorY - 32,
    size: 9,
    font: fontRegular,
    color: mutedText,
  });

  page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
    x: width - 150,
    y: cursorY - 25,
    size: 9,
    font: fontRegular,
    color: mutedText,
  });

  cursorY -= 70;

  // 2. Student Metadata Grid
  const scheme = AcademicSchemeRegistry.getScheme(data.schemeId);

  page.drawText('STUDENT INFORMATION', {
    x: 40,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: darkSlate,
  });

  cursorY -= 15;

  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: width - 40, y: cursorY },
    thickness: 1,
    color: primaryColor,
  });

  cursorY -= 20;

  const col1X = 40;
  const col2X = 220;
  const col3X = 400;

  page.drawText(`USN: ${data.usn}`, { x: col1X, y: cursorY, size: 10, font: fontBold, color: darkSlate });
  page.drawText(`Scheme: ${scheme.name}`, { x: col2X, y: cursorY, size: 9, font: fontRegular, color: darkSlate });
  page.drawText(`Branch: ${data.branchName}`, { x: col3X, y: cursorY, size: 9, font: fontRegular, color: darkSlate });

  cursorY -= 18;

  if (data.studentName) {
    page.drawText(`Candidate: ${data.studentName}`, { x: col1X, y: cursorY, size: 9, font: fontRegular, color: darkSlate });
  }
  if (data.collegeName) {
    page.drawText(`Institution: ${data.collegeName}`, { x: col2X, y: cursorY, size: 9, font: fontRegular, color: darkSlate });
  }

  cursorY -= 30;

  // 3. Overall Academic Performance Summary
  page.drawText('CUMULATIVE PERFORMANCE METRICS', {
    x: 40,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: darkSlate,
  });

  cursorY -= 12;

  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: width - 40, y: cursorY },
    thickness: 1,
    color: borderLine,
  });

  cursorY -= 20;

  // Metric Boxes
  const boxWidth = (width - 80 - 30) / 4;
  const boxHeight = 45;

  const metrics = [
    { label: 'Cumulative CGPA', value: data.cgpa.toFixed(2), highlight: true },
    { label: 'Percentage Equiv.', value: `${data.percentageEquivalent.toFixed(2)}%` },
    { label: 'Earned Credits', value: `${data.totalCreditsEarned}` },
    { label: 'Active Backlogs', value: `${data.activeBacklogs}` },
  ];

  metrics.forEach((m, idx) => {
    const boxX = 40 + idx * (boxWidth + 10);
    page.drawRectangle({
      x: boxX,
      y: cursorY - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: m.highlight ? rgb(0.93, 0.96, 1.0) : lightBg,
      borderColor: m.highlight ? primaryColor : borderLine,
      borderWidth: 1,
    });

    page.drawText(m.label, {
      x: boxX + 8,
      y: cursorY - 14,
      size: 8,
      font: fontBold,
      color: m.highlight ? primaryColor : mutedText,
    });

    page.drawText(m.value, {
      x: boxX + 8,
      y: cursorY - 35,
      size: 14,
      font: fontBold,
      color: darkSlate,
    });
  });

  cursorY -= boxHeight + 35;

  // 4. Semester Summaries Table
  page.drawText('SEMESTER-WISE PERFORMANCE HISTORY', {
    x: 40,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: darkSlate,
  });

  cursorY -= 12;

  page.drawLine({
    start: { x: 40, y: cursorY },
    end: { x: width - 40, y: cursorY },
    thickness: 1,
    color: borderLine,
  });

  cursorY -= 18;

  // Table Header
  page.drawRectangle({
    x: 40,
    y: cursorY - 15,
    width: width - 80,
    height: 20,
    color: lightBg,
  });

  page.drawText('Semester', { x: 50, y: cursorY - 10, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Exam Session', { x: 120, y: cursorY - 10, size: 8, font: fontBold, color: darkSlate });
  page.drawText('SGPA', { x: 260, y: cursorY - 10, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Earned / Registered Credits', { x: 330, y: cursorY - 10, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Status', { x: 470, y: cursorY - 10, size: 8, font: fontBold, color: darkSlate });

  cursorY -= 25;

  for (const sem of data.semesters) {
    if (cursorY < 80) {
      page = pdfDoc.addPage([595.28, 841.89]);
      cursorY = height - 50;
    }

    page.drawText(`Semester ${sem.semester}`, { x: 50, y: cursorY, size: 8, font: fontBold, color: darkSlate });
    page.drawText(sem.examSession || '—', { x: 120, y: cursorY, size: 8, font: fontRegular, color: mutedText });
    page.drawText(sem.sgpa.toFixed(2), { x: 260, y: cursorY, size: 9, font: fontBold, color: primaryColor });
    page.drawText(`${sem.earnedCredits} / ${sem.totalCredits}`, { x: 330, y: cursorY, size: 8, font: fontRegular, color: darkSlate });
    page.drawText(sem.hasBacklogs ? 'Backlog' : 'Clear', {
      x: 470,
      y: cursorY,
      size: 8,
      font: fontBold,
      color: sem.hasBacklogs ? rgb(0.85, 0.2, 0.2) : rgb(0.1, 0.6, 0.3),
    });

    page.drawLine({
      start: { x: 40, y: cursorY - 6 },
      end: { x: width - 40, y: cursorY - 6 },
      thickness: 0.5,
      color: borderLine,
    });

    cursorY -= 20;
  }

  cursorY -= 20;

  // 5. Disclaimer & Official Verification Notice (Prompt Section 46)
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: 45,
    color: lightBg,
    borderColor: borderLine,
    borderWidth: 1,
  });

  page.drawText('OFFICIAL VERIFICATION DISCLAIMER:', {
    x: 50,
    y: 72,
    size: 7,
    font: fontBold,
    color: darkSlate,
  });

  page.drawText(
    'This academic report is generated by Saarvi as an unofficial student productivity analysis workspace.\nSGPA and CGPA are computed based on user-provided or imported marksheet records and applicable VTU regulations.\nAlways refer to your official VTU provisional marks card or university grade card for formal academic validation.',
    {
      x: 50,
      y: 60,
      size: 6.5,
      font: fontRegular,
      color: mutedText,
      lineHeight: 9,
    }
  );

  return pdfDoc.save();
}

/**
 * Triggers instant browser download of the generated academic report PDF
 */
export async function downloadAcademicReportPdf(data: AcademicReportData, filename?: string): Promise<void> {
  const pdfBytes = await generateAcademicReportPdf(data);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `Saarvi_Academic_Report_${data.usn || 'VTU'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
