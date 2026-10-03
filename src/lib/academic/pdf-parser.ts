/**
 * Layered VTU Result PDF Extraction Pipeline
 *
 * Implements Prompt Sections 14, 15, 16, 17, 36, 37:
 * - Level 1: Native PDF text extraction via pdfjs-dist with fallback geometry
 * - Level 2: Multi-layer USN detection (Exact, Spaced/Kerning, Label-based, Squashed, and Fallback Context)
 * - Level 3: Comprehensive Multi-Scheme Course Code pattern matching (2022 Scheme BMATS/BCS, 2021/2018 Scheme, etc.)
 * - Level 4: Scheme and Semester inference from course hierarchy
 * - Level 5: Grade & Status computation with User Verification output schema
 * - 100% In-Browser Privacy: Zero cloud file uploads
 */

import { AcademicSchemeRegistry } from './scheme-registry';
import { CanonicalExtractedResult, RawSubjectResult } from './providers/vtu-result-provider';
import { roundTo } from './engine/calculations';
import { ALL_VERIFIED_VTU_COURSES } from '@/lib/student/vtu/curriculum-data';

export interface ParseMarksheetOptions {
  fallbackUsn?: string;
  defaultSemester?: number;
}

export interface ParsedMarksheetOutcome {
  success: boolean;
  result?: CanonicalExtractedResult;
  needsReview: boolean;
  reviewReasons: string[];
  rawTextPreview?: string;
  error?: string;
  isScannedDocument?: boolean;
}

/**
 * Validates PDF magic bytes (%PDF) and maximum file size
 */
export function validatePdfBytes(buffer: ArrayBuffer, maxBytes = 15 * 1024 * 1024): { valid: boolean; error?: string } {
  if (!buffer || buffer.byteLength === 0) {
    return { valid: false, error: 'Empty file provided.' };
  }

  if (buffer.byteLength > maxBytes) {
    return { valid: false, error: `File size exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)}MB limit.` };
  }

  const header = new Uint8Array(buffer.slice(0, 5));
  const headerStr = String.fromCharCode(...header);
  if (!headerStr.startsWith('%PDF')) {
    return { valid: false, error: 'Invalid document: Header is not a valid PDF (%PDF).' };
  }

  return { valid: true };
}

/**
 * Extracts plain text items with geometric coordinates from PDF ArrayBuffer
 */
export async function extractPdfTextItems(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // Configure local worker bundled in public/ or fallback gracefully
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = Math.min(pdf.numPages, 4); // VTU result cards are typically 1-2 pages

  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter((s: string) => Boolean(s && s.trim()));

    fullText += strings.join(' ') + '\n';
  }

  return fullText;
}

/**
 * Multi-layer USN detector supporting spaced glyphs, labels, squashed text, and active session context
 */
export function detectUsnFromText(text: string, fallbackUsn?: string): string {
  // Strategy 1: Direct exact match (e.g. 1RV23CS001, 2LB24CS047)
  const exactMatch = text.match(/\b([1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4})\b/i);
  if (exactMatch) return exactMatch[1].toUpperCase();

  // Strategy 2: Spaced characters / kerning (e.g. 2 L B 2 4 C S 0 4 7)
  const spacedMatch = text.match(/\b([1-4]\s*[A-Za-z]{2}\s*\d{2}\s*[A-Za-z]{2,3}\s*\d{2,4})\b/i);
  if (spacedMatch) {
    const candidate = spacedMatch[1].replace(/\s+/g, '').toUpperCase();
    if (/^[1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4}$/.test(candidate)) {
      return candidate;
    }
  }

  // Strategy 3: Target label-based extraction (e.g. "University Seat Number : 2LB24CS047" or "USN: 2LB24CS047")
  const labelMatch = text.match(/(?:University\s*Seat\s*Number|USN|Seat\s*No|Roll\s*No)\s*[:.-]?\s*([A-Za-z0-9\s]{7,18})/i);
  if (labelMatch) {
    const candidate = labelMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const subMatch = candidate.match(/([1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4})/);
    if (subMatch) return subMatch[1];
  }

  // Strategy 4: Search squashed text (removes all non-alphanumeric characters)
  const squashed = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const squashedMatch = squashed.match(/([1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4})/);
  if (squashedMatch) {
    return squashedMatch[1];
  }

  // Strategy 5: Contextual Fallback (User already typed/searched their USN on page)
  if (fallbackUsn) {
    const cleanFallback = fallbackUsn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{2,4}$/.test(cleanFallback)) {
      return cleanFallback;
    }
  }

  return '';
}

const NON_COURSE_KEYWORDS = new Set([
  'TOTAL', 'MARKS', 'CREDIT', 'CREDITS', 'GRADE', 'GRADES', 'RESULT',
  'SEMESTER', 'BRANCH', 'SCHEME', 'VTU', 'PASSED', 'FAILED', 'REGULAR',
  'BACKLOG', 'STATUS', 'REMARKS', 'COURSE', 'SUBJECT', 'CANDIDATE',
  'UNIVERSITY', 'BELAGAVI', 'PROVISIONAL', 'EXAMINATION', 'POINT', 'POINTS'
]);

/**
 * Deterministically parses extracted VTU marksheet text
 */
export function parseVTUMarksheetText(text: string, options?: ParseMarksheetOptions): ParsedMarksheetOutcome {
  const reviewReasons: string[] = [];
  let needsReview = false;

  // 1. Detect USN using multi-strategy resolver
  const detectedUsn = detectUsnFromText(text, options?.fallbackUsn);

  if (!detectedUsn) {
    const isLikelyScanned = text.trim().length < 50;
    return {
      success: false,
      needsReview: true,
      isScannedDocument: isLikelyScanned,
      reviewReasons: [
        isLikelyScanned
          ? 'Uploaded PDF appears to be a scanned image without an embedded digital text layer.'
          : 'Could not detect a valid VTU USN in the uploaded PDF.'
      ],
      rawTextPreview: text.slice(0, 300),
      error: 'USN not detected in document. Please verify this is an official VTU marks card.',
    };
  }

  // 2. Detect Scheme based on USN batch year
  const scheme = AcademicSchemeRegistry.detectSchemeFromUSN(detectedUsn);

  // 3. Parse Subject Rows using comprehensive multi-scheme regex
  // Format matches:
  // - 2022 Scheme: BMATS101, BCS301, BSCK307, BCSL305, etc.
  // - 2021/2018 Scheme: 21CS31, 21MAT31, 18CS52, etc.
  // - Elective / Other: MAT11, CS32, etc.
  const subjectCodeRegex = /\b((?:B[A-Z]{2,5}\d{2,3}[A-Z]?)|(?:\d{2}[A-Z]{2,4}\d{2,3}[A-Z]?)|(?:[A-Z]{2,5}\d{2,4}[A-Z]?))\b/gi;
  const rawMatches = Array.from(text.matchAll(subjectCodeRegex));

  const subjects: RawSubjectResult[] = [];
  const seenCodes = new Set<string>();

  for (const match of rawMatches) {
    const code = match[1].toUpperCase();
    if (seenCodes.has(code)) continue;
    if (NON_COURSE_KEYWORDS.has(code)) continue;
    seenCodes.add(code);

    // Look at text slice following the code for marks and grade
    const startIndex = match.index || 0;
    const windowSlice = text.slice(startIndex, startIndex + 200);

    // Detect Grade: O, A+, A, B+, B, C, P, F, S, D, E
    const gradeMatch = windowSlice.match(/\b(O|A\+|A|B\+|B|C|P|F|S|D|E)\b/i);
    const grade = gradeMatch ? gradeMatch[1].toUpperCase() : 'P';

    // Derive grade point deterministically from scheme
    let gradePoint = 0;
    const band = scheme.gradeBands.find((b) => b.grade.toUpperCase() === grade.toUpperCase());
    if (band) {
      gradePoint = band.gradePoint;
    } else if (grade === 'F') {
      gradePoint = 0;
    }

    // Attempt lookup in verified curriculum database for authentic title and credits
    const matchedCourse = ALL_VERIFIED_VTU_COURSES.find(
      (c) => c.courseCode.toUpperCase() === code
    );

    // Detect numbers for marks and credits
    const numbers = Array.from(windowSlice.matchAll(/\b(\d{1,3})\b/g)).map((m) => parseInt(m[1], 10));
    let credits = matchedCourse?.credits || 3;
    let totalMarks = 60;
    let cieMarks: number | undefined;
    let seeMarks: number | undefined;

    // Credits detection: typically 1, 2, 3, 4
    if (!matchedCourse) {
      const candidateCredit = numbers.find((n) => [1, 2, 3, 4].includes(n) && n !== totalMarks);
      if (candidateCredit) credits = candidateCredit;
    }

    // Total marks detection: typically between 35 and 100
    const candidateTotal = numbers.find((n) => n >= 35 && n <= 100);
    if (candidateTotal) totalMarks = candidateTotal;

    // Is passed
    const isPassed = grade !== 'F' && gradePoint > 0;

    subjects.push({
      courseCode: code,
      courseTitle: matchedCourse?.courseTitle || `Course ${code}`,
      credits,
      cieMarks,
      seeMarks,
      totalMarks,
      grade,
      gradePoint,
      resultStatus: isPassed ? 'P' : 'F',
    });
  }

  // 4. Detect Semester: e.g. "Semester : 3" or "Sem: 4" or infer from course codes
  let detectedSemester = options?.defaultSemester || 1;
  const semMatch = text.match(/(?:Semester|Sem|SEM)\s*[:.-]?\s*([1-8])/i) ||
                   text.match(/([1-8])(?:st|nd|rd|th)\s+(?:Semester|Sem)/i);

  if (semMatch && semMatch[1]) {
    detectedSemester = parseInt(semMatch[1], 10);
  } else if (subjects.length > 0) {
    // Infer semester from course code digits (e.g. BMATS101 -> 1, BCS301 -> 3, 21CS41 -> 4)
    for (const sub of subjects) {
      const numMatch = sub.courseCode.match(/(?:[A-Z]+)(\d)/i);
      if (numMatch && numMatch[1]) {
        const semDigit = parseInt(numMatch[1], 10);
        if (semDigit >= 1 && semDigit <= 8) {
          detectedSemester = semDigit;
          break;
        }
      }
    }
  } else {
    reviewReasons.push('Semester could not be confirmed automatically; defaulted to 1.');
    needsReview = true;
  }

  // 5. Detect Student Name if present
  const nameMatch = text.match(/(?:Student Name|Name of Student|Candidate Name)\s*[:.-]?\s*([A-Za-z\s]{3,40})/i);
  const studentName = nameMatch ? nameMatch[1].trim() : undefined;

  // If no courses were detected
  if (subjects.length === 0) {
    const isLikelyScanned = text.trim().length < 50;
    return {
      success: false,
      needsReview: true,
      isScannedDocument: isLikelyScanned,
      reviewReasons: [
        isLikelyScanned
          ? 'Uploaded PDF appears to be a scanned image without readable text.'
          : 'Could not extract individual subject rows with high confidence.'
      ],
      rawTextPreview: text.slice(0, 300),
      error: isLikelyScanned
        ? 'Uploaded PDF is a scanned image without readable text. Please use manual entry or check your document.'
        : 'Could not extract subject grades from PDF marks card.',
    };
  }

  // 6. Calculate Deterministic SGPA
  let totalCredits = 0;
  let earnedCredits = 0;
  let totalCreditPoints = 0;
  let hasBacklogs = false;

  for (const s of subjects) {
    totalCredits += s.credits;
    totalCreditPoints += s.credits * s.gradePoint;
    if (s.resultStatus === 'P') {
      earnedCredits += s.credits;
    } else {
      hasBacklogs = true;
    }
  }

  const sgpa = totalCredits > 0 ? roundTo(totalCreditPoints / totalCredits, 2) : 0;
  const branchCode = detectedUsn.length >= 7 ? detectedUsn.slice(5, 7) : 'CSE';

  return {
    success: true,
    needsReview,
    reviewReasons,
    result: {
      usn: detectedUsn,
      studentName,
      semester: detectedSemester,
      schemeId: scheme.schemeId,
      branchCode,
      examSession: `${new Date().getFullYear()} Examination`,
      resultType: 'REGULAR',
      source: 'IMPORTED_PDF',
      fetchedAt: new Date().toISOString(),
      subjects,
      sgpa,
      totalCredits,
      earnedCredits,
      hasBacklogs,
    },
  };
}
