import { CertificateRecord } from "@/types/student";

/**
 * Composite Key Certificate Duplicate Detector.
 *
 * Problem: Prevent accidental creation of duplicate certificate records without blocking valid submissions.
 * Approach:
 * - Construct a normalized canonical composite key: `normalizedName|normalizedIssuer|issueDate`
 * - Check existence in a precomputed Set in O(1) time.
 *
 * Complexity:
 * - Hash key construction: O(L) where L is string length.
 * - Set Lookup: O(1) average time.
 */

export function generateCertificateCompositeKey(
  name: string,
  issuer: string,
  issueDate: string
): string {
  const normName = (name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const normIssuer = (issuer || "").trim().toLowerCase().replace(/\s+/g, " ");
  const cleanDate = (issueDate || "").trim();
  return `${normName}|${normIssuer}|${cleanDate}`;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchingCertificate?: CertificateRecord;
  warningMessage?: string;
}

export function checkCertificateDuplicate(
  candidate: { name: string; issuer: string; issueDate: string; id?: string },
  existingCertificates: CertificateRecord[]
): DuplicateCheckResult {
  if (!existingCertificates || existingCertificates.length === 0) {
    return { isDuplicate: false };
  }

  const candidateKey = generateCertificateCompositeKey(
    candidate.name,
    candidate.issuer,
    candidate.issueDate
  );

  for (const cert of existingCertificates) {
    // Exclude self during edit
    if (candidate.id && cert.id === candidate.id) {
      continue;
    }

    const certKey = generateCertificateCompositeKey(cert.name, cert.issuer, cert.issueDate);
    if (candidateKey === certKey) {
      return {
        isDuplicate: true,
        matchingCertificate: cert,
        warningMessage: `A similar certificate "${cert.name}" from "${cert.issuer}" issued on ${cert.issueDate} already exists.`,
      };
    }
  }

  return { isDuplicate: false };
}

export interface CourseDuplicateCandidate {
  code: string;
  scheme?: string;
  semester?: number;
  id?: string;
  name?: string;
}

export function generateCourseCompositeKey(code: string, scheme: string = "2022"): string {
  const normCode = (code || "").trim().toUpperCase().replace(/\s+/g, "");
  const normScheme = (scheme || "2022").trim().toLowerCase();
  return `${normScheme}|${normCode}`;
}

export function checkCourseDuplicate(
  candidate: CourseDuplicateCandidate,
  existingCourses: CourseDuplicateCandidate[]
): { isDuplicate: boolean; matchingCourse?: CourseDuplicateCandidate; warningMessage?: string } {
  if (!existingCourses || existingCourses.length === 0) {
    return { isDuplicate: false };
  }
  const candidateKey = generateCourseCompositeKey(candidate.code, candidate.scheme);
  for (const c of existingCourses) {
    if (candidate.id && c.id === candidate.id) continue;
    if (generateCourseCompositeKey(c.code, c.scheme) === candidateKey) {
      return {
        isDuplicate: true,
        matchingCourse: c,
        warningMessage: `Course with code "${candidate.code.toUpperCase()}" already exists in the ${candidate.scheme || "current"} scheme.`,
      };
    }
  }
  return { isDuplicate: false };
}

export function findDuplicateCourses(courses: CourseDuplicateCandidate[]): CourseDuplicateCandidate[] {
  const seen = new Set<string>();
  const duplicates: CourseDuplicateCandidate[] = [];
  for (const c of courses) {
    const key = generateCourseCompositeKey(c.code, c.scheme);
    if (seen.has(key)) {
      duplicates.push(c);
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

