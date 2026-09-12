/**
 * Fast O(1) Subject Indexing & Cross-Referencing.
 *
 * Provides bidirectional and normalized constant-time lookups for subjects
 * across coursework, timetable entries, exams, and attendance records.
 *
 * Complexity:
 * - Registration: O(1)
 * - Lookup by Code: O(1)
 * - Lookup by Normalized Name: O(1)
 * - Subject Resolution: O(1)
 */

export interface SubjectInfo {
  code: string;
  name: string;
  normalizedCode: string;
  normalizedName: string;
  credits?: number;
  scheme?: string;
  metadata?: Record<string, unknown>;
}

export class SubjectIndex {
  private byCode: Map<string, SubjectInfo> = new Map();
  private byNormalizedName: Map<string, SubjectInfo> = new Map();

  public static normalizeCode(code: string): string {
    return (code || "").trim().toUpperCase().replace(/[\s-_]/g, "");
  }

  public static normalizeName(name: string): string {
    return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  public register(info: {
    code: string;
    name: string;
    credits?: number;
    scheme?: string;
    metadata?: Record<string, unknown>;
  }): SubjectInfo {
    const normCode = SubjectIndex.normalizeCode(info.code);
    const normName = SubjectIndex.normalizeName(info.name);

    const subject: SubjectInfo = {
      code: info.code.trim(),
      name: info.name.trim(),
      normalizedCode: normCode,
      normalizedName: normName,
      credits: info.credits,
      scheme: info.scheme,
      metadata: info.metadata,
    };

    if (normCode) {
      this.byCode.set(normCode, subject);
    }
    if (normName) {
      this.byNormalizedName.set(normName, subject);
    }

    return subject;
  }

  public getByCode(code: string): SubjectInfo | undefined {
    return this.byCode.get(SubjectIndex.normalizeCode(code));
  }

  public getByName(name: string): SubjectInfo | undefined {
    return this.byNormalizedName.get(SubjectIndex.normalizeName(name));
  }

  /**
   * Resolves a subject by either code or name in O(1) average time.
   */
  public resolve(identifier: string): SubjectInfo | undefined {
    if (!identifier) return undefined;
    // Try code first
    const codeMatch = this.getByCode(identifier);
    if (codeMatch) return codeMatch;
    // Try name
    return this.getByName(identifier);
  }

  public getAll(): SubjectInfo[] {
    const seen = new Set<string>();
    const list: SubjectInfo[] = [];
    for (const sub of this.byCode.values()) {
      if (!seen.has(sub.normalizedCode)) {
        seen.add(sub.normalizedCode);
        list.push(sub);
      }
    }
    return list;
  }

  public clear(): void {
    this.byCode.clear();
    this.byNormalizedName.clear();
  }

  public size(): number {
    return this.getAll().length;
  }
}

// Global default subject index singleton
export const globalSubjectIndex = new SubjectIndex();
