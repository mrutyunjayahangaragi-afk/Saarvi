import {
  AcademicScope,
  AuthoritativeSubject,
  AcademicSubjectProvider,
} from '../providers/types';
import { OfficialCurriculumProvider } from '../providers/official-curriculum-provider';
import { OfficialUniversityApiProvider } from '../providers/official-university-api-provider';
import { VerifiedAcademicApiProvider } from '../providers/verified-academic-api-provider';
import { MockStorageProvider, StoredAcademicConflict, StoredAcademicSubject } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface SubjectCacheEntry {
  version: number;
  lastVerifiedAt: string;
  sourceUrl?: string;
  subjects: AuthoritativeSubject[];
  expiresAt: number;
}

export class SubjectAuthorityService {
  private static instance: SubjectAuthorityService;

  private providers: AcademicSubjectProvider[];
  private cache: Map<string, SubjectCacheEntry> = new Map();
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes safe cache

  private constructor() {
    this.providers = [
      new OfficialCurriculumProvider(),
      new OfficialUniversityApiProvider(),
      new VerifiedAcademicApiProvider(),
    ].sort((a, b) => a.priority - b.priority);
  }

  public static getInstance(): SubjectAuthorityService {
    if (!SubjectAuthorityService.instance) {
      SubjectAuthorityService.instance = new SubjectAuthorityService();
    }
    return SubjectAuthorityService.instance;
  }

  public getCacheKey(scope: AcademicScope): string {
    return `${scope.universityId.toLowerCase()}_${scope.schemeId.toLowerCase()}_${scope.branchId.toLowerCase()}_sem${scope.semester}`;
  }

  public invalidateCache(scope?: AcademicScope): void {
    if (scope) {
      this.cache.delete(this.getCacheKey(scope));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Searches and resolves subjects for the given academic scope.
   * Scoped strictly by: University, Program/Branch, Scheme, Semester.
   * Enforces source priority and detects source conflicts.
   */
  async searchSubjects(
    scope: AcademicScope,
    query?: string,
    forceRefresh = false
  ): Promise<AuthoritativeSubject[]> {
    const cacheKey = this.getCacheKey(scope);

    if (!forceRefresh && !query) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.subjects;
      }
    }

    const aggregated = new Map<string, AuthoritativeSubject>();
    const providerMatches: Array<{ provider: AcademicSubjectProvider; subjects: AuthoritativeSubject[] }> = [];

    // Query providers in priority order
    for (const provider of this.providers) {
      try {
        const found = await provider.searchSubjects(scope, query);
        if (found.length > 0) {
          providerMatches.push({ provider, subjects: found });
        }
      } catch (err) {
        console.warn(`[SubjectAuthorityService] Provider ${provider.providerName} error:`, err);
      }
    }

    // Merge & Detect Conflicts
    for (const { provider, subjects } of providerMatches) {
      for (const subj of subjects) {
        const codeKey = subj.subjectCode.toUpperCase();
        const existing = aggregated.get(codeKey);

        if (!existing) {
          aggregated.set(codeKey, subj);
        } else {
          // Check for conflicts: credits or name discrepancy between different sources
          const creditsDiffer = Number(existing.credits) !== Number(subj.credits);
          const nameDiffers =
            existing.subjectName.trim().toLowerCase() !== subj.subjectName.trim().toLowerCase() &&
            !existing.subjectName.toLowerCase().includes(subj.subjectName.toLowerCase()) &&
            !subj.subjectName.toLowerCase().includes(existing.subjectName.toLowerCase());

          if (creditsDiffer || nameDiffers) {
            // Flag conflict: DO NOT SILENTLY OVERWRITE
            existing.verificationStatus = 'CONFLICT_REQUIRES_REVIEW';
            existing.conflictDetails = {
              conflictingSources: [
                {
                  source: existing.sourceType + ` (${existing.sourceUrl || 'internal'})`,
                  subjectName: existing.subjectName,
                  credits: existing.credits,
                  timestamp: existing.lastVerifiedAt,
                },
                {
                  source: provider.providerName + ` (${subj.sourceUrl || 'provider'})`,
                  subjectName: subj.subjectName,
                  credits: subj.credits,
                  timestamp: new Date().toISOString(),
                },
              ],
            };

            // Record conflict record for admin verification queue
            this.recordSubjectConflict({
              id: `conf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              subjectCode: codeKey,
              subjectId: existing.id,
              universityId: scope.universityId,
              schemeId: scope.schemeId,
              branchId: scope.branchId,
              semester: scope.semester,
              existingSource: existing.sourceType,
              existingData: {
                subjectName: existing.subjectName,
                credits: existing.credits,
                sourceUrl: existing.sourceUrl,
              },
              conflictingSource: provider.sourceType,
              conflictingData: {
                subjectName: subj.subjectName,
                credits: subj.credits,
                sourceUrl: subj.sourceUrl,
              },
              resolutionStatus: 'PENDING',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    const results = Array.from(aggregated.values());

    // Filter by query if supplied
    let filtered = results;
    if (query) {
      const q = query.toLowerCase();
      filtered = results.filter(
        (s) => s.subjectCode.toLowerCase().includes(q) || s.subjectName.toLowerCase().includes(q)
      );
    }

    // Cache results
    if (!query) {
      this.cache.set(cacheKey, {
        version: 1,
        lastVerifiedAt: new Date().toISOString(),
        sourceUrl: results[0]?.sourceUrl,
        subjects: results,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    return filtered;
  }

  /**
   * Resolves a single authoritative subject.
   */
  async getSubject(scope: AcademicScope, subjectCode: string): Promise<AuthoritativeSubject | null> {
    const subjects = await this.searchSubjects(scope, subjectCode);
    return subjects.find((s) => s.subjectCode.toUpperCase() === subjectCode.toUpperCase()) || null;
  }

  /**
   * Records conflict into Supabase or MockStorage for Admin review queue.
   */
  public async recordSubjectConflict(conflict: StoredAcademicConflict): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('academic_subject_conflicts').upsert({
            subject_code: conflict.subjectCode,
            university_id: conflict.universityId,
            scheme_id: conflict.schemeId,
            branch_id: conflict.branchId,
            semester: conflict.semester,
            existing_source: conflict.existingSource,
            existing_data: conflict.existingData,
            conflicting_source: conflict.conflictingSource,
            conflicting_data: conflict.conflictingData,
            resolution_status: 'PENDING',
          });
          return;
        } catch (dbErr) {
          console.warn('[SubjectAuthorityService] Supabase conflict insert warning:', dbErr);
        }
      }
    }

    MockStorageProvider.saveAcademicSubjectConflict(conflict);
  }

  /**
   * Admin verification / manual correction workflow with complete audit trail.
   */
  async adminCorrectSubject(params: {
    scope: AcademicScope;
    subjectCode: string;
    newSubjectName: string;
    newCredits: number;
    officialSourceUrl: string;
    officialDocument: string;
    actorEmail: string;
    notes?: string;
  }): Promise<{ success: boolean; subject?: AuthoritativeSubject; error?: string }> {
    const {
      scope,
      subjectCode,
      newSubjectName,
      newCredits,
      officialSourceUrl,
      officialDocument,
      actorEmail,
      notes,
    } = params;

    // Validate inputs
    if (!subjectCode || !newSubjectName || isNaN(newCredits) || newCredits < 0) {
      return { success: false, error: 'Invalid parameters: valid code, name, and non-negative credits required.' };
    }

    const existing = await this.getSubject(scope, subjectCode);
    const oldValues = {
      subjectName: existing?.subjectName,
      credits: existing?.credits,
      sourceUrl: existing?.sourceUrl,
      verificationStatus: existing?.verificationStatus,
    };

    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'ADMIN_MANUAL_CORRECTION',
      actor: actorEmail,
      changes: {
        subjectName: { old: oldValues.subjectName, new: newSubjectName },
        credits: { old: oldValues.credits, new: newCredits },
        sourceUrl: { old: oldValues.sourceUrl, new: officialSourceUrl },
        verificationStatus: { old: oldValues.verificationStatus, new: 'VERIFIED' },
      },
      notes,
    };

    const updatedRecord: StoredAcademicSubject = {
      id: existing?.id || `${scope.universityId}_${scope.schemeId}_${scope.branchId}_sem${scope.semester}_${subjectCode.toLowerCase()}`,
      universityId: scope.universityId,
      schemeId: scope.schemeId,
      branchId: scope.branchId,
      semester: scope.semester,
      academicYear: scope.academicYear || '2022-2026',
      subjectCode: subjectCode.toUpperCase(),
      subjectName: newSubjectName.trim(),
      credits: newCredits,
      courseType: newCredits <= 2 ? 'Lab' : 'Theory',
      seeApplicable: true,
      cieApplicable: true,
      sourceType: 'MANUAL_ADMIN_ENTRY',
      sourceUrl: officialSourceUrl,
      sourceDocument: officialDocument,
      verificationStatus: 'VERIFIED',
      auditHistory: [...(existing?.auditHistory || []), auditEntry],
      version: (existing?.auditHistory?.length || 0) + 1,
      lastVerifiedAt: new Date().toISOString(),
      createdAt: existing?.lastVerifiedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save in Supabase or MockStorage
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('academic_subjects').upsert({
            id: updatedRecord.id,
            university_id: updatedRecord.universityId,
            scheme_id: updatedRecord.schemeId,
            branch_id: updatedRecord.branchId,
            semester: updatedRecord.semester,
            academic_year: updatedRecord.academicYear,
            subject_code: updatedRecord.subjectCode,
            subject_name: updatedRecord.subjectName,
            credits: updatedRecord.credits,
            course_type: updatedRecord.courseType,
            see_applicable: updatedRecord.seeApplicable,
            cie_applicable: updatedRecord.cieApplicable,
            source_type: updatedRecord.sourceType,
            source_url: updatedRecord.sourceUrl,
            source_document: updatedRecord.sourceDocument,
            verification_status: 'VERIFIED',
            audit_history: updatedRecord.auditHistory,
            last_verified_at: updatedRecord.lastVerifiedAt,
            updated_at: updatedRecord.updatedAt,
          });
        } catch (dbErr: any) {
          console.warn('[SubjectAuthorityService] DB upsert error:', dbErr);
        }
      }
    }

    MockStorageProvider.saveAcademicSubject(updatedRecord);
    MockStorageProvider.recordAcademicAuditLog({
      action: 'ADMIN_SUBJECT_CORRECTION',
      subjectCode: updatedRecord.subjectCode,
      actor: actorEmail,
      details: auditEntry,
    });

    // Invalidate caches
    this.invalidateCache(scope);

    return {
      success: true,
      subject: {
        ...updatedRecord,
        branch: updatedRecord.branchId,
        scheme: updatedRecord.schemeId,
        university: updatedRecord.universityId,
        courseType: updatedRecord.courseType as any,
      },
    };
  }
}

export const subjectAuthorityService = SubjectAuthorityService.getInstance();
