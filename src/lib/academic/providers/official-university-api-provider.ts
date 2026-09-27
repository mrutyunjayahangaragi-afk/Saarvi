import {
  AcademicSubjectProvider,
  AcademicScope,
  AuthoritativeSubject,
  AcademicSourceType,
} from './types';

/**
 * Priority 3 Provider: Official University Authenticated API
 * Secure server-side adapter for universities offering official curriculum endpoints.
 * Enforces strict anti-SSRF defenses and domain validation.
 */
export class OfficialUniversityApiProvider implements AcademicSubjectProvider {
  public readonly priority = 3;
  public readonly providerName = 'Official University API Provider';
  public readonly sourceType: AcademicSourceType = 'OFFICIAL_UNIVERSITY_API';

  // Allowed official hostnames
  private static readonly ALLOWED_HOSTS = ['vtu.ac.in', 'api.vtu.ac.in'];

  async searchSubjects(scope: AcademicScope, query?: string): Promise<AuthoritativeSubject[]> {
    // Check if an official API URL is configured in environment
    const officialApiBase = process.env.OFFICIAL_UNIVERSITY_API_URL;
    if (!officialApiBase) {
      // Official university does not provide a public REST API; gracefully return empty
      return [];
    }

    try {
      const url = new URL(officialApiBase);
      if (!OfficialUniversityApiProvider.ALLOWED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
        console.warn(`[OfficialUniversityApiProvider] Rejected untrusted host: ${url.hostname}`);
        return [];
      }

      url.searchParams.set('university', scope.universityId);
      url.searchParams.set('scheme', scope.schemeId);
      url.searchParams.set('branch', scope.branchId);
      url.searchParams.set('semester', String(scope.semester));
      if (query) url.searchParams.set('q', query);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Saarvi-Academic-Engine/2.0',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return [];

      const data = await res.json();
      if (!Array.isArray(data.subjects)) return [];

      return data.subjects.map((item: any) => ({
        id: `api_${scope.schemeId}_${scope.branchId}_s${scope.semester}_${item.code}`,
        subjectCode: String(item.code || item.subjectCode).toUpperCase(),
        subjectName: String(item.name || item.subjectName),
        credits: Number(item.credits) || 0,
        semester: scope.semester,
        branch: scope.branchId,
        scheme: scope.schemeId,
        university: scope.universityId.toUpperCase(),
        academicYear: scope.academicYear || '2022-2026',
        sourceType: 'OFFICIAL_UNIVERSITY_API',
        sourceUrl: url.origin,
        sourceDocument: 'Official University Authenticated API',
        lastVerifiedAt: new Date().toISOString(),
        verificationStatus: 'VERIFIED',
      }));
    } catch {
      return [];
    }
  }

  async getSubject(scope: AcademicScope, subjectCode: string): Promise<AuthoritativeSubject | null> {
    const list = await this.searchSubjects(scope, subjectCode);
    return list.find((s) => s.subjectCode.toUpperCase() === subjectCode.toUpperCase()) || null;
  }
}
