import {
  AcademicSubjectProvider,
  AcademicScope,
  AuthoritativeSubject,
  AcademicSourceType,
} from './types';
import { ALL_VERIFIED_VTU_COURSES } from '@/lib/student/vtu/curriculum-data';
import { academicServerStore } from '@/lib/academic/academic-store';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

/**
 * Priority 1 & 2 Provider: Official University Curriculum & Syllabus PDFs
 * Direct extraction from verified university scheme documents.
 */
export class OfficialCurriculumProvider implements AcademicSubjectProvider {
  public readonly priority = 1;
  public readonly providerName = 'Official University Curriculum Provider';
  public readonly sourceType: AcademicSourceType = 'OFFICIAL_CURRICULUM_PDF';

  async searchSubjects(scope: AcademicScope, query?: string): Promise<AuthoritativeSubject[]> {
    const results: AuthoritativeSubject[] = [];
    const normalizedBranch = scope.branchId.toUpperCase().replace(/^VTU-\d{4}-/, '');
    const normalizedScheme = scope.schemeId.replace(/^vtu-/, '');

    // 1. Check verified VTU courses repository
    for (const c of ALL_VERIFIED_VTU_COURSES) {
      const matchScheme = c.scheme === normalizedScheme || scope.schemeId.includes(c.scheme);
      const matchBranch =
        c.branch.toUpperCase() === normalizedBranch ||
        c.branch.toUpperCase() === scope.branchId.toUpperCase() ||
        scope.branchId.toUpperCase().includes(c.branch.toUpperCase());
      const matchSem = c.semester === scope.semester;

      if (matchScheme && matchBranch && matchSem) {
        if (
          !query ||
          c.courseCode.toLowerCase().includes(query.toLowerCase()) ||
          c.courseTitle.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({
            id: `vtu_${c.scheme}_${c.branch.toLowerCase()}_s${c.semester}_${c.courseCode.toLowerCase()}`,
            subjectCode: c.courseCode.toUpperCase(),
            subjectName: c.courseTitle,
            credits: c.credits,
            semester: c.semester,
            branch: c.branch.toUpperCase(),
            scheme: c.scheme,
            university: 'VTU',
            academicYear: scope.academicYear || `${c.scheme}-${Number(c.scheme) + 4}`,
            sourceType: 'OFFICIAL_CURRICULUM_PDF',
            sourceUrl: 'https://vtu.ac.in/en/b-e-scheme-syllabus/',
            sourceDocument: `VTU ${c.scheme} Scheme Syllabus Regulation (B.E. ${c.branch})`,
            lastVerifiedAt: '2026-01-01T00:00:00.000Z',
            verificationStatus: 'VERIFIED',
            courseType: c.category?.includes('Lab') ? 'Lab' : 'Theory',
            seeApplicable: c.assessment?.hasSEE !== false,
            cieApplicable: true,
          });
        }
      }
    }

    // 2. Check academicServerStore published subjects
    const allStoreSubjects = academicServerStore.getSubjects({
      universityId: scope.universityId,
      schemeId: scope.schemeId,
      branchId: scope.branchId,
      semester: scope.semester,
      status: 'PUBLISHED',
    });

    const storeSubjects = query
      ? allStoreSubjects.filter(
          (s) =>
            s.subjectCode.toLowerCase().includes(query.toLowerCase()) ||
            s.subjectName.toLowerCase().includes(query.toLowerCase())
        )
      : allStoreSubjects;

    // 2. Check academicServerStore published subjects (Admin published subjects take top priority)
    for (const s of storeSubjects) {
      const existingIdx = results.findIndex((r) => r.subjectCode.toUpperCase() === s.subjectCode.toUpperCase());
      const publishedItem: AuthoritativeSubject = {
        id: s.id,
        subjectCode: s.subjectCode.toUpperCase(),
        subjectName: s.subjectName,
        credits: s.credits,
        semester: s.semester,
        branch: s.branchId,
        scheme: s.schemeId,
        university: s.universityId.toUpperCase(),
        academicYear: scope.academicYear || '2022-2026',
        sourceType: 'OFFICIAL_UNIVERSITY_WEBSITE',
        sourceUrl: 'https://vtu.ac.in',
        sourceDocument: 'Official University Curriculum Portal (Admin Published)',
        lastVerifiedAt: s.updatedAt || new Date().toISOString(),
        verificationStatus: 'VERIFIED',
        courseType: s.courseType,
        seeApplicable: s.seeApplicable,
        cieApplicable: true,
      };

      if (existingIdx >= 0) {
        results[existingIdx] = publishedItem;
      } else {
        results.push(publishedItem);
      }
    }

    // Exclude archived subjects
    const archivedSubjects = academicServerStore.getSubjects({
      universityId: scope.universityId,
      schemeId: scope.schemeId,
      branchId: scope.branchId,
      semester: scope.semester,
      status: 'ARCHIVED',
    });
    const archivedCodes = new Set(archivedSubjects.map((s) => s.subjectCode.toUpperCase()));
    const unarchivedResults = results.filter((r) => !archivedCodes.has(r.subjectCode.toUpperCase()));

    // 3. Check MockStorage verified subjects
    const storedSubjects = MockStorageProvider.getAcademicSubjects({
      universityId: scope.universityId,
      schemeId: scope.schemeId,
      branchId: scope.branchId,
      semester: scope.semester,
      search: query,
      status: 'VERIFIED',
    });

    for (const s of storedSubjects) {
      const idx = results.findIndex((r) => r.subjectCode.toUpperCase() === s.subjectCode.toUpperCase());
      const item: AuthoritativeSubject = {
        id: s.id,
        subjectCode: s.subjectCode.toUpperCase(),
        subjectName: s.subjectName,
        credits: s.credits,
        semester: s.semester,
        branch: s.branchId,
        scheme: s.schemeId,
        university: s.universityId.toUpperCase(),
        academicYear: s.academicYear,
        sourceType: s.sourceType,
        sourceUrl: s.sourceUrl,
        sourceDocument: s.sourceDocument,
        lastVerifiedAt: s.lastVerifiedAt,
        verificationStatus: s.verificationStatus,
        courseType: s.courseType as any,
        seeApplicable: s.seeApplicable,
        cieApplicable: s.cieApplicable,
        auditHistory: s.auditHistory,
      };

      if (idx >= 0) {
        results[idx] = item;
      } else {
        results.push(item);
      }
    }

    const archivedSubjects = academicServerStore.getSubjects({
      universityId: scope.universityId,
      schemeId: scope.schemeId,
      branchId: scope.branchId,
      semester: scope.semester,
      status: 'ARCHIVED',
    });
    const archivedCodes = new Set(archivedSubjects.map((s) => s.subjectCode.toUpperCase()));
    return results.filter((r) => !archivedCodes.has(r.subjectCode.toUpperCase()));
  }

  async getSubject(scope: AcademicScope, subjectCode: string): Promise<AuthoritativeSubject | null> {
    const all = await this.searchSubjects(scope, subjectCode);
    return all.find((s) => s.subjectCode.toUpperCase() === subjectCode.toUpperCase()) || null;
  }
}
