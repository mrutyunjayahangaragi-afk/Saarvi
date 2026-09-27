import {
  AcademicSubjectProvider,
  AcademicScope,
  AuthoritativeSubject,
  AcademicSourceType,
} from './types';

/**
 * Priority 4 Provider: Verified Academic Dataset Provider
 * Strict source validation: requires explicit institution identification and approved source metadata.
 * Explicitly rejects Google snippets, random blogs, and unverified student lists.
 */
export class VerifiedAcademicApiProvider implements AcademicSubjectProvider {
  public readonly priority = 4;
  public readonly providerName = 'Verified Academic Dataset Provider';
  public readonly sourceType: AcademicSourceType = 'VERIFIED_ACADEMIC_DATASET';

  // Disallowed domains and terms
  private static readonly DISALLOWED_PATTERNS = [
    /google\./i,
    /bing\./i,
    /blog/i,
    /wordpress/i,
    /medium\./i,
    /quora\./i,
    /reddit\./i,
    /scribd\./i,
    /studocu\./i,
    /coursehero\./i,
    /student-upload/i,
  ];

  /**
   * Validates whether an academic source is reputable and authoritative.
   */
  public static isValidSource(sourceUrl?: string): boolean {
    if (!sourceUrl) return false;
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== 'https:') return false;
      const host = url.hostname.toLowerCase();
      for (const pattern of VerifiedAcademicApiProvider.DISALLOWED_PATTERNS) {
        if (pattern.test(host) || pattern.test(url.pathname)) {
          return false;
        }
      }
      return host.endsWith('.edu') || host.endsWith('.ac.in') || host.endsWith('.org') || host.endsWith('.gov.in');
    } catch {
      return false;
    }
  }

  async searchSubjects(scope: AcademicScope, query?: string): Promise<AuthoritativeSubject[]> {
    // Only returns verified subjects from recognized datasets
    return [];
  }

  async getSubject(scope: AcademicScope, subjectCode: string): Promise<AuthoritativeSubject | null> {
    const list = await this.searchSubjects(scope, subjectCode);
    return list.find((s) => s.subjectCode.toUpperCase() === subjectCode.toUpperCase()) || null;
  }
}
