/**
 * VTU Result Provider Architecture & Semester Discovery Engine
 *
 * Implements Prompt Section 5, 7, 8, 38:
 * - Provider adapter interface (VTUResultProvider)
 * - Automatic semester discovery engine based on USN batch year
 * - Strict No-CAPTCHA bypass policy
 * - Fallback to official VTU portal link and PDF marks card upload
 * - ABSOLUTE RULE: Zero fake/dummy marks or placeholder grades.
 */

import { AcademicSchemeRegistry, AcademicScheme } from '../scheme-registry';

export interface DiscoveredExamSession {
  sessionId: string;
  examName: string; // e.g. "Dec 2024 / Jan 2025 Examination"
  semester: number;
  schemeId: string;
  academicYear: string; // e.g. "2024-2025"
  monthYear: string; // e.g. "Dec/Jan 2025"
  resultType: 'REGULAR' | 'REVALUATION';
  portalUrl: string;
  availability: 'AVAILABLE' | 'PORTAL_RESTRICTED' | 'NOT_YET_ANNOUNCED';
}

export interface RawSubjectResult {
  courseCode: string;
  courseTitle: string;
  credits: number;
  cieMarks?: number;
  seeMarks?: number;
  totalMarks: number;
  grade: string;
  gradePoint: number;
  resultStatus: 'P' | 'F' | 'AB' | 'NE';
}

export interface CanonicalExtractedResult {
  usn: string;
  studentName?: string;
  semester: number;
  schemeId: string;
  branchCode: string;
  examSession: string;
  resultType: 'REGULAR' | 'REVALUATION';
  source: 'OFFICIAL_PORTAL' | 'IMPORTED_PDF' | 'MANUAL_ENTRY';
  fetchedAt: string;
  subjects: RawSubjectResult[];
  sgpa: number;
  totalCredits: number;
  earnedCredits: number;
  hasBacklogs: boolean;
}

export type CanonicalSemesterResult = CanonicalExtractedResult;

export interface VTUResultProvider {
  readonly providerKey: string;
  readonly displayName: string;
  readonly isOfficial: boolean;

  discoverExams(usn: string, signal?: AbortSignal): Promise<DiscoveredExamSession[]>;
  fetchResult(usn: string, sessionId: string, signal?: AbortSignal): Promise<CanonicalExtractedResult | null>;
  healthCheck(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'; latencyMs: number; message: string }>;
  attribution(): { providerName: string; officialSourceUrl: string; disclaimer: string };
  supportsScheme(schemeId: string): boolean;
}

/**
 * Semester Result Discovery Engine (Prompt Section 8)
 * Deterministically derives candidate exam sessions for a given USN without inventing fake results.
 */
export class SemesterResultDiscoveryEngine {
  /**
   * Discovers valid exam sessions based on student USN batch year and current date.
   */
  public static discoverSessionsForUSN(usn: string): {
    scheme: AcademicScheme;
    batchYear: number;
    branchCode: string;
    sessions: DiscoveredExamSession[];
  } {
    const cleanUsn = usn.trim().toUpperCase();
    const scheme = AcademicSchemeRegistry.detectSchemeFromUSN(cleanUsn);

    // Extract batch year & branch code: e.g. 1RV23CS001 -> '23' -> 2023, 'CS' -> CSE
    const match = cleanUsn.match(/^[1-4][A-Z]{2}(\d{2})([A-Z]{2,3})/);
    const batchYear = match && match[1] ? 2000 + parseInt(match[1], 10) : 2022;
    const branchCode = match && match[2] ? match[2] : 'GEN';

    const currentYear = new Date().getFullYear();
    const maxSemesters = Math.min(8, Math.max(1, (currentYear - batchYear) * 2));

    const sessions: DiscoveredExamSession[] = [];

    for (let sem = 1; sem <= maxSemesters; sem++) {
      const isOdd = sem % 2 === 1;
      const semAcademicYear = batchYear + Math.floor((sem - 1) / 2);
      const yearLabel = `${semAcademicYear}-${semAcademicYear + 1}`;
      const examName = isOdd
        ? `Dec ${semAcademicYear} / Jan ${semAcademicYear + 1} Examination`
        : `May / June ${semAcademicYear + 1} Examination`;
      const monthYear = isOdd ? `Dec/Jan ${semAcademicYear + 1}` : `May/June ${semAcademicYear + 1}`;

      sessions.push({
        sessionId: `${cleanUsn}_sem_${sem}_${semAcademicYear}`,
        examName,
        semester: sem,
        schemeId: scheme.schemeId,
        academicYear: yearLabel,
        monthYear,
        resultType: 'REGULAR',
        portalUrl: 'https://results.vtu.ac.in/',
        availability: 'PORTAL_RESTRICTED', // Protected by VTU security verification
      });
    }

    // Sort descending by semester (latest first)
    sessions.sort((a, b) => b.semester - a.semester);

    return {
      scheme,
      batchYear,
      branchCode,
      sessions,
    };
  }
}

/**
 * Official VTU Portal Provider Reference
 * Adheres to Section 5: Does not bypass CAPTCHAs or security controls.
 */
export class OfficialVTUResultProvider implements VTUResultProvider {
  public readonly providerKey = 'official_vtu_portal';
  public readonly displayName = 'Official VTU Result Portal';
  public readonly isOfficial = true;

  public async discoverExams(usn: string): Promise<DiscoveredExamSession[]> {
    const discovery = SemesterResultDiscoveryEngine.discoverSessionsForUSN(usn);
    return discovery.sessions;
  }

  public async fetchResult(usn: string, sessionId: string): Promise<CanonicalExtractedResult | null> {
    // Section 5 Invariant: We do NOT bypass CAPTCHA, authentication, or anti-bot mechanisms.
    // When live direct retrieval is protected, caller falls back to user PDF upload or official portal referral.
    return null;
  }

  public async healthCheck(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'; latencyMs: number; message: string }> {
    const start = Date.now();
    try {
      const res = await fetch('https://results.vtu.ac.in/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);

      const latencyMs = Date.now() - start;
      if (res && res.status < 500) {
        return { status: 'HEALTHY', latencyMs, message: 'VTU official results portal is online.' };
      }
      return { status: 'DEGRADED', latencyMs, message: 'VTU portal returned non-200 or high latency.' };
    } catch {
      return { status: 'UNAVAILABLE', latencyMs: Date.now() - start, message: 'VTU portal is unreachable or timed out.' };
    }
  }

  public attribution(): { providerName: string; officialSourceUrl: string; disclaimer: string } {
    return {
      providerName: 'Visvesvaraya Technological University (VTU) Examination Section',
      officialSourceUrl: 'https://results.vtu.ac.in/',
      disclaimer: 'Saarvi is an unofficial student productivity analysis workspace and is not affiliated with or endorsed by VTU.',
    };
  }

  public supportsScheme(schemeId: string): boolean {
    return ['vtu-2018', 'vtu-2021', 'vtu-2022', 'vtu-2025'].includes(schemeId);
  }
}
