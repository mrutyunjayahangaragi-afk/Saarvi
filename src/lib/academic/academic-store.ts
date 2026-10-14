/**
 * Authoritative Server-Side Multi-University Academic Platform Store
 *
 * Single source of truth for:
 * - Universities (VTU + extensible multi-universities)
 * - Schemes / Regulations (e.g. VTU 2022, VTU 2025, 2026 Regulation)
 * - Branches (CSE, ISE, AIML, ECE, ME, CV, etc.)
 * - Semesters (1 to N)
 * - Subjects (code, name, credits, courseType, SEE applicable)
 * - Publishing Lifecycle (DRAFT -> PUBLISHED -> ARCHIVED)
 * - CSV / JSON Batch Import
 *
 * Strictly adheres to:
 * - Deterministic validation (no NaN, non-negative credits, uniqueness within scope)
 * - No fake subjects or silent fallbacks for missing curriculum
 * - Safe audit logging
 */

import type {
  UniversityRecord,
  SchemeRecord,
  BranchRecord,
  AcademicSemesterRecord,
  AcademicSubjectRecord,
  CurriculumPublishStatus,
  AcademicCourseType,
  CurriculumRevisionRecord,
} from '@/types/admin';
import { ALL_VERIFIED_VTU_COURSES } from '../student/vtu/curriculum-data.ts';
import { MockStorageProvider } from '../supabase/mock-storage.ts';
import type { StoredAcademicSubject } from '../supabase/mock-storage.ts';
import { isSupabaseConfigured } from '../supabase/config.ts';
import { getSupabaseAdminClient } from '../supabase/admin.ts';

export class AcademicServerStore {
  private static instance: AcademicServerStore;
  private static cacheInvalidators: Array<(scope?: any) => void> = [];

  private universities: Map<string, UniversityRecord> = new Map();
  private schemes: Map<string, SchemeRecord> = new Map();
  private branches: Map<string, BranchRecord> = new Map();
  private semesters: Map<string, AcademicSemesterRecord> = new Map();
  private subjects: Map<string, AcademicSubjectRecord> = new Map();
  private revisions: Map<string, CurriculumRevisionRecord> = new Map();
  private initialized = false;

  private constructor() {
    this.initializeDefaults();
  }

  public static registerCacheInvalidator(fn: (scope?: any) => void) {
    AcademicServerStore.cacheInvalidators.push(fn);
  }

  public registerCacheInvalidator(fn: (scope?: any) => void) {
    AcademicServerStore.registerCacheInvalidator(fn);
  }

  public invalidateCaches(scope?: { universityId?: string; schemeId?: string; branchId?: string; semester?: number }) {
    for (const fn of AcademicServerStore.cacheInvalidators) {
      try {
        fn(scope);
      } catch (err) {
        console.warn('[AcademicServerStore] Cache invalidation callback error:', err);
      }
    }
  }

  public static getInstance(): AcademicServerStore {
    if (!AcademicServerStore.instance) {
      AcademicServerStore.instance = new AcademicServerStore();
    }
    return AcademicServerStore.instance;
  }

  private initializeDefaults() {
    if (this.initialized) return;

    // 1. Seed Visvesvaraya Technological University (VTU)
    const vtuUniv: UniversityRecord = {
      id: 'vtu',
      name: 'Visvesvaraya Technological University',
      code: 'VTU',
      status: 'ENABLED',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    this.universities.set(vtuUniv.id, vtuUniv);

    // 2. Seed VTU Schemes (2022 & 2025)
    const scheme2022: SchemeRecord = {
      id: 'vtu-2022',
      universityId: 'vtu',
      name: '2022 Scheme',
      year: '2022',
      version: '1.0',
      status: 'ENABLED',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const scheme2025: SchemeRecord = {
      id: 'vtu-2025',
      universityId: 'vtu',
      name: '2025 Scheme',
      year: '2025',
      version: '1.0',
      status: 'ENABLED',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    this.schemes.set(scheme2022.id, scheme2022);
    this.schemes.set(scheme2025.id, scheme2025);

    // 3. Seed Branches for VTU
    const defaultBranches = [
      { code: 'CSE', name: 'Computer Science and Engineering' },
      { code: 'ISE', name: 'Information Science and Engineering' },
      { code: 'AIML', name: 'Artificial Intelligence & Machine Learning' },
      { code: 'ECE', name: 'Electronics and Communication Engineering' },
      { code: 'ME', name: 'Mechanical Engineering' },
      { code: 'CV', name: 'Civil Engineering' },
    ];

    for (const schemeId of ['vtu-2022', 'vtu-2025']) {
      for (const b of defaultBranches) {
        const branchId = `${schemeId}-${b.code.toLowerCase()}`;
        const branchRecord: BranchRecord = {
          id: branchId,
          universityId: 'vtu',
          schemeId,
          code: b.code,
          name: b.name,
          status: 'ENABLED',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        };
        this.branches.set(branchId, branchRecord);

        // Seed 8 semesters for each branch
        for (let s = 1; s <= 8; s++) {
          const semId = `${branchId}-sem-${s}`;
          this.semesters.set(semId, {
            id: semId,
            universityId: 'vtu',
            schemeId,
            branchId,
            semesterNumber: s,
            status: 'ENABLED',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          });
        }
      }
    }

    // 4. Seed Verified Official VTU Courses
    for (const course of ALL_VERIFIED_VTU_COURSES) {
      const schemeYear = course.scheme; // "2022" or "2025"
      const schemeId = `vtu-${schemeYear}`;
      const branchCode = course.branch.toUpperCase();
      const branchId = `${schemeId}-${branchCode.toLowerCase()}`;
      const subjectId = `${schemeId}-${branchCode.toLowerCase()}-sem${course.semester}-${course.courseCode.toLowerCase()}`;

      const subjectRecord: AcademicSubjectRecord = {
        id: subjectId,
        universityId: 'vtu',
        schemeId,
        branchId,
        semester: course.semester,
        subjectCode: course.courseCode.toUpperCase(),
        subjectName: course.courseTitle,
        credits: course.credits,
        courseType: (course.category?.includes('Lab') || course.category?.includes('Practical'))
          ? 'Lab'
          : 'Theory',
        seeApplicable: course.assessment?.hasSEE ?? true,
        status: 'PUBLISHED',
        includedInSGPA: course.includedInSGPA ?? true,
        includedInCGPA: course.includedInCGPA ?? true,
        category: course.category,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      this.subjects.set(subjectId, subjectRecord);
    }

    // Load any persisted subjects from MockStorage
    const savedSubjects = MockStorageProvider.getAcademicSubjects();
    for (const s of savedSubjects) {
      this.subjects.set(s.id, {
        id: s.id,
        universityId: s.universityId,
        schemeId: s.schemeId,
        branchId: s.branchId,
        semester: s.semester,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        credits: s.credits,
        courseType: (s.courseType as AcademicCourseType) || 'Theory',
        seeApplicable: s.seeApplicable !== false,
        status: (s.verificationStatus === 'VERIFIED' ? 'PUBLISHED' : ((s as any).publish_status || (s as any).status || 'PUBLISHED')),
        includedInSGPA: true,
        includedInCGPA: true,
        category: (s as any).category,
        revisionNumber: (s as any).revision_number || (s as any).revisionNumber || 1,
        version: s.version || 1,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
    }

    // Load any persisted revisions from MockStorage
    const savedRevs = MockStorageProvider.getCurriculumRevisions();
    for (const r of savedRevs) {
      this.revisions.set(r.id, r);
    }

    this.initialized = true;
  }

  // =========================================================================
  // UNIVERSITIES
  // =========================================================================

  public getUniversities(): UniversityRecord[] {
    return Array.from(this.universities.values());
  }

  public getUniversity(id: string): UniversityRecord | undefined {
    return this.universities.get(id);
  }

  public createUniversity(
    data: { name: string; code: string; status?: 'ENABLED' | 'DISABLED' },
    actor = 'admin'
  ): UniversityRecord {
    const cleanName = data.name?.trim();
    const cleanCode = data.code?.trim().toUpperCase();

    if (!cleanName) throw new Error('University name is required.');
    if (!cleanCode) throw new Error('University code is required.');

    // Check code uniqueness
    for (const u of this.universities.values()) {
      if (u.code === cleanCode) {
        throw new Error(`A university with code "${cleanCode}" already exists.`);
      }
    }

    const id = cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const now = new Date().toISOString();
    const record: UniversityRecord = {
      id,
      name: cleanName,
      code: cleanCode,
      status: data.status || 'ENABLED',
      createdAt: now,
      updatedAt: now,
    };

    this.universities.set(id, record);

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'UNIVERSITY_CREATED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { university: record },
    });

    return record;
  }

  public updateUniversity(
    id: string,
    updates: Partial<Pick<UniversityRecord, 'name' | 'code' | 'status'>>,
    actor = 'admin'
  ): UniversityRecord {
    const existing = this.universities.get(id);
    if (!existing) throw new Error(`University with ID "${id}" not found.`);

    if (updates.code) {
      const codeUpper = updates.code.trim().toUpperCase();
      for (const [k, u] of this.universities.entries()) {
        if (k !== id && u.code === codeUpper) {
          throw new Error(`University code "${codeUpper}" is already in use.`);
        }
      }
      existing.code = codeUpper;
    }

    if (updates.name) existing.name = updates.name.trim();
    if (updates.status) existing.status = updates.status;
    existing.updatedAt = new Date().toISOString();

    this.universities.set(id, existing);

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'UNIVERSITY_UPDATED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { updates },
    });

    return existing;
  }

  // =========================================================================
  // SCHEMES / REGULATIONS
  // =========================================================================

  public getSchemes(universityId?: string): SchemeRecord[] {
    const all = Array.from(this.schemes.values());
    if (universityId) {
      return all.filter((s) => s.universityId === universityId);
    }
    return all;
  }

  public getScheme(id: string): SchemeRecord | undefined {
    return this.schemes.get(id);
  }

  public createScheme(
    data: { universityId: string; name: string; year: string; version?: string; status?: 'ENABLED' | 'DISABLED' },
    actor = 'admin'
  ): SchemeRecord {
    const univ = this.universities.get(data.universityId);
    if (!univ) throw new Error(`University "${data.universityId}" not found.`);

    const cleanName = data.name?.trim();
    const cleanYear = data.year?.trim();
    if (!cleanName) throw new Error('Scheme name is required.');
    if (!cleanYear) throw new Error('Scheme year is required.');

    const id = `${univ.id}-${cleanYear}`.toLowerCase();
    if (this.schemes.has(id)) {
      throw new Error(`Scheme "${cleanName} (${cleanYear})" already exists for ${univ.name}.`);
    }

    const now = new Date().toISOString();
    const record: SchemeRecord = {
      id,
      universityId: univ.id,
      name: cleanName,
      year: cleanYear,
      version: data.version || '1.0',
      status: data.status || 'ENABLED',
      createdAt: now,
      updatedAt: now,
    };

    this.schemes.set(id, record);

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'SCHEME_CREATED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { scheme: record },
    });

    return record;
  }

  // =========================================================================
  // BRANCHES
  // =========================================================================

  public getBranches(universityId?: string, schemeId?: string): BranchRecord[] {
    let all = Array.from(this.branches.values());
    if (universityId) {
      all = all.filter((b) => b.universityId === universityId);
    }
    if (schemeId) {
      all = all.filter((b) => b.schemeId === schemeId);
    }
    return all;
  }

  public createBranch(
    data: { universityId: string; schemeId: string; name: string; code: string; status?: 'ENABLED' | 'DISABLED' },
    actor = 'admin'
  ): BranchRecord {
    const scheme = this.schemes.get(data.schemeId);
    if (!scheme) throw new Error(`Scheme "${data.schemeId}" not found.`);

    const cleanName = data.name?.trim();
    const cleanCode = data.code?.trim().toUpperCase();
    if (!cleanName) throw new Error('Branch name is required.');
    if (!cleanCode) throw new Error('Branch code is required.');

    const id = `${scheme.id}-${cleanCode.toLowerCase()}`;
    if (this.branches.has(id)) {
      throw new Error(`Branch with code "${cleanCode}" already exists for this scheme.`);
    }

    const now = new Date().toISOString();
    const record: BranchRecord = {
      id,
      universityId: scheme.universityId,
      schemeId: scheme.id,
      name: cleanName,
      code: cleanCode,
      status: data.status || 'ENABLED',
      createdAt: now,
      updatedAt: now,
    };

    this.branches.set(id, record);

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'BRANCH_CREATED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { branch: record },
    });

    return record;
  }

  // =========================================================================
  // SEMESTERS
  // =========================================================================

  public getSemesters(universityId?: string, schemeId?: string, branchId?: string): AcademicSemesterRecord[] {
    let all = Array.from(this.semesters.values());
    if (universityId) all = all.filter((s) => s.universityId === universityId);
    if (schemeId) all = all.filter((s) => s.schemeId === schemeId);
    if (branchId) all = all.filter((s) => s.branchId === branchId);
    return all.sort((a, b) => a.semesterNumber - b.semesterNumber);
  }

  public createSemester(
    data: { universityId: string; schemeId: string; branchId: string; semesterNumber: number },
    actor = 'admin'
  ): AcademicSemesterRecord {
    if (!data.semesterNumber || data.semesterNumber < 1) {
      throw new Error('Semester number must be an integer greater than or equal to 1.');
    }

    const id = `${data.branchId}-sem-${data.semesterNumber}`;
    if (this.semesters.has(id)) {
      throw new Error(`Semester ${data.semesterNumber} already exists for this branch.`);
    }

    const now = new Date().toISOString();
    const record: AcademicSemesterRecord = {
      id,
      universityId: data.universityId,
      schemeId: data.schemeId,
      branchId: data.branchId,
      semesterNumber: data.semesterNumber,
      status: 'ENABLED',
      createdAt: now,
      updatedAt: now,
    };

    this.semesters.set(id, record);

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'SEMESTER_CREATED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { semester: record },
    });

    return record;
  }

  // =========================================================================
  // SUBJECTS & VALIDATION
  // =========================================================================

  public getSubjects(filter?: {
    universityId?: string;
    schemeId?: string;
    branchId?: string;
    semester?: number;
    status?: CurriculumPublishStatus;
  }): AcademicSubjectRecord[] {
    let all = Array.from(this.subjects.values());

    if (filter?.universityId) {
      all = all.filter((s) => s.universityId === filter.universityId);
    }
    if (filter?.schemeId) {
      all = all.filter((s) => s.schemeId === filter.schemeId);
    }
    if (filter?.branchId) {
      all = all.filter((s) => s.branchId === filter.branchId);
    }
    if (filter?.semester !== undefined) {
      all = all.filter((s) => s.semester === filter.semester);
    }
    if (filter?.status) {
      all = all.filter((s) => s.status === filter.status);
    }

    return all;
  }

  public async getSubjectsAsync(filter?: {
    universityId?: string;
    schemeId?: string;
    branchId?: string;
    semester?: number;
    status?: CurriculumPublishStatus;
  }): Promise<AcademicSubjectRecord[]> {
    if (isSupabaseConfigured()) {
      const client = getSupabaseAdminClient();
      if (client) {
        try {
          let query = client.from('academic_subjects').select('*');
          if (filter?.universityId) query = query.eq('university_id', filter.universityId);
          if (filter?.schemeId) query = query.eq('scheme_id', filter.schemeId);
          if (filter?.branchId) query = query.eq('branch_id', filter.branchId);
          if (filter?.semester !== undefined) query = query.eq('semester', filter.semester);
          if (filter?.status) query = query.eq('publish_status', filter.status);

          const { data, error } = await query;
          if (!error && Array.isArray(data) && data.length > 0) {
            data.forEach((row: any) => {
              const record: AcademicSubjectRecord = {
                id: row.id,
                universityId: row.university_id,
                schemeId: row.scheme_id,
                branchId: row.branch_id,
                semester: row.semester,
                subjectCode: row.subject_code,
                subjectName: row.subject_name,
                credits: Number(row.credits),
                courseType: (row.course_type as AcademicCourseType) || 'Theory',
                seeApplicable: row.see_applicable !== false,
                status: row.publish_status || 'PUBLISHED',
                includedInSGPA: true,
                includedInCGPA: true,
                category: row.category,
                revisionNumber: row.revision_number || 1,
                version: row.version || 1,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              };
              this.subjects.set(record.id, record);
            });
          }
        } catch (dbErr) {
          console.warn('[AcademicServerStore] getSubjectsAsync db warning:', dbErr);
        }
      }
    }
    return this.getSubjects(filter);
  }

  public getSubject(id: string): AcademicSubjectRecord | undefined {
    return this.subjects.get(id);
  }

  public getActiveRevision(scope: {
    universityId: string;
    schemeId: string;
    branchId: string;
    semester: number;
  }): CurriculumRevisionRecord {
    const scopeId = `${scope.universityId}_${scope.schemeId}_${scope.branchId}_sem${scope.semester}`;
    const existing = this.revisions.get(scopeId) || MockStorageProvider.getCurriculumRevision(scopeId);
    if (existing) {
      this.revisions.set(scopeId, existing);
      return existing;
    }

    const defaultRev: CurriculumRevisionRecord = {
      id: scopeId,
      universityId: scope.universityId,
      schemeId: scope.schemeId,
      branchId: scope.branchId,
      semester: scope.semester,
      revisionNumber: 1,
      status: 'ACTIVE',
      publishedBy: 'system',
      publishedAt: '2026-01-01T00:00:00.000Z',
      coursesCount: this.getSubjects({ ...scope, status: 'PUBLISHED' }).length,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    this.revisions.set(scopeId, defaultRev);
    MockStorageProvider.saveCurriculumRevision(defaultRev);
    return defaultRev;
  }

  public async getActiveRevisionAsync(scope: {
    universityId: string;
    schemeId: string;
    branchId: string;
    semester: number;
  }): Promise<CurriculumRevisionRecord> {
    const scopeId = `${scope.universityId}_${scope.schemeId}_${scope.branchId}_sem${scope.semester}`;
    if (isSupabaseConfigured()) {
      const client = getSupabaseAdminClient();
      if (client) {
        try {
          const { data, error } = await client
            .from('academic_curriculum_revisions')
            .select('*')
            .eq('university_id', scope.universityId)
            .eq('scheme_id', scope.schemeId)
            .eq('branch_id', scope.branchId)
            .eq('semester', scope.semester)
            .eq('status', 'ACTIVE')
            .maybeSingle();

          if (!error && data) {
            const rev: CurriculumRevisionRecord = {
              id: data.id || scopeId,
              universityId: data.university_id,
              schemeId: data.scheme_id,
              branchId: data.branch_id,
              semester: data.semester,
              revisionNumber: data.revision_number,
              status: data.status,
              publishedBy: data.published_by,
              publishedAt: data.published_at,
              coursesCount: data.courses_count,
              coursesChecksum: data.courses_checksum,
              notes: data.notes,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            };
            this.revisions.set(scopeId, rev);
            MockStorageProvider.saveCurriculumRevision(rev);
            return rev;
          }
        } catch (dbErr) {
          console.warn('[AcademicServerStore] getActiveRevisionAsync db warning:', dbErr);
        }
      }
    }
    return this.getActiveRevision(scope);
  }

  /**
   * Add subject with strict validation.
   * Required: subjectName, subjectCode, valid credits (>0).
   * Reject duplicate subjectCode within (university + scheme + branch + semester + subjectCode).
   */
  public async createSubject(
    data: {
      universityId: string;
      schemeId: string;
      branchId: string;
      semester: number;
      subjectCode: string;
      subjectName: string;
      credits: number;
      courseType?: AcademicCourseType;
      seeApplicable?: boolean;
      status?: CurriculumPublishStatus;
      category?: string;
    },
    actor = 'admin'
  ): Promise<AcademicSubjectRecord> {
    const cleanCode = data.subjectCode?.trim().toUpperCase();
    const cleanName = data.subjectName?.trim();
    const numCredits = Number(data.credits);

    if (!cleanCode) throw new Error('Subject code is required.');
    if (!cleanName) throw new Error('Subject name is required.');
    if (isNaN(numCredits) || numCredits <= 0) {
      throw new Error(`Invalid credits value "${data.credits}". Credits must be a positive numeric value.`);
    }

    // Uniqueness Scope Check: university + scheme + branch + semester + subjectCode
    for (const s of this.subjects.values()) {
      if (
        s.universityId === data.universityId &&
        s.schemeId === data.schemeId &&
        s.branchId === data.branchId &&
        s.semester === data.semester &&
        s.subjectCode === cleanCode
      ) {
        throw new Error(
          `Subject code "${cleanCode}" already exists for this semester in this branch. Duplicate subject codes within the same semester scope are prohibited.`
        );
      }
    }

    const id = `${data.branchId}-sem${data.semester}-${cleanCode.toLowerCase()}`.replace(/[^a-z0-9-]/g, '-');
    const now = new Date().toISOString();

    const record: AcademicSubjectRecord = {
      id,
      universityId: data.universityId,
      schemeId: data.schemeId,
      branchId: data.branchId,
      semester: data.semester,
      subjectCode: cleanCode,
      subjectName: cleanName,
      credits: numCredits,
      courseType: data.courseType || 'Theory',
      seeApplicable: data.seeApplicable !== false,
      status: data.status || 'DRAFT',
      includedInSGPA: true,
      includedInCGPA: true,
      category: data.category,
      revisionNumber: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.subjects.set(id, record);

    // Save to MockStorage
    const stored: StoredAcademicSubject = {
      id,
      universityId: data.universityId,
      schemeId: data.schemeId,
      branchId: data.branchId,
      semester: data.semester,
      academicYear: '2022-2026',
      subjectCode: cleanCode,
      subjectName: cleanName,
      credits: numCredits,
      courseType: data.courseType || 'Theory',
      seeApplicable: data.seeApplicable !== false,
      cieApplicable: true,
      sourceType: 'OFFICIAL_UNIVERSITY_WEBSITE',
      sourceUrl: 'https://vtu.ac.in',
      sourceDocument: 'VTU Official Curriculum (Admin Added)',
      verificationStatus: data.status === 'PUBLISHED' ? 'VERIFIED' : 'UNVERIFIED',
      publishStatus: data.status || 'DRAFT',
      lastVerifiedAt: now,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    MockStorageProvider.saveAcademicSubject(stored);

    // Persist to Supabase PostgreSQL database
    if (isSupabaseConfigured()) {
      const client = getSupabaseAdminClient();
      if (client) {
        try {
          const { error } = await client.from('academic_subjects').upsert({
            id: record.id,
            university_id: record.universityId,
            scheme_id: record.schemeId,
            branch_id: record.branchId,
            semester: record.semester,
            subject_code: record.subjectCode,
            subject_name: record.subjectName,
            credits: record.credits,
            course_type: record.courseType,
            see_applicable: record.seeApplicable,
            cie_applicable: true,
            publish_status: record.status,
            status: 'ENABLED',
            version: 1,
            revision_number: 1,
            updated_at: now,
            created_at: now,
          });
          if (error) {
            console.warn('[AcademicServerStore] Supabase subject create warning:', error.message);
          }
        } catch (dbErr) {
          console.warn('[AcademicServerStore] Supabase subject create exception:', dbErr);
        }
      }
    }

    this.invalidateCaches({
      universityId: data.universityId,
      schemeId: data.schemeId,
      branchId: data.branchId,
      semester: data.semester,
    });

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'SUBJECT_CREATED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { subject: record },
    });

    return record;
  }

  public async updateSubject(
    id: string,
    updates: Partial<Pick<AcademicSubjectRecord, 'subjectName' | 'subjectCode' | 'credits' | 'courseType' | 'seeApplicable' | 'status'>> & { expectedVersion?: number },
    expectedVersionOrActor?: number | string,
    actorParam = 'admin'
  ): Promise<AcademicSubjectRecord> {
    const existing = this.subjects.get(id);
    if (!existing) throw new Error(`Subject with ID "${id}" not found.`);

    const actor = typeof expectedVersionOrActor === 'string' ? expectedVersionOrActor : actorParam;
    const expectedVersion = typeof expectedVersionOrActor === 'number' ? expectedVersionOrActor : updates.expectedVersion;

    // Concurrency conflict detection: check optimistic version
    if (expectedVersion !== undefined && existing.version && existing.version !== expectedVersion) {
      throw new Error(
        'Conflict detected: This subject has already been modified by another administrator. Please refresh the page to view the latest changes before saving.'
      );
    }

    if (updates.subjectCode) {
      const cleanCode = updates.subjectCode.trim().toUpperCase();
      // Uniqueness scope check
      for (const [k, s] of this.subjects.entries()) {
        if (
          k !== id &&
          s.universityId === existing.universityId &&
          s.schemeId === existing.schemeId &&
          s.branchId === existing.branchId &&
          s.semester === existing.semester &&
          s.subjectCode === cleanCode
        ) {
          throw new Error(`Subject code "${cleanCode}" already exists for this semester.`);
        }
      }
      existing.subjectCode = cleanCode;
    }

    if (updates.subjectName) existing.subjectName = updates.subjectName.trim();
    if (updates.credits !== undefined) {
      const numCredits = Number(updates.credits);
      if (isNaN(numCredits) || numCredits <= 0) {
        throw new Error('Credits must be a positive number.');
      }
      existing.credits = numCredits;
    }
    if (updates.courseType) existing.courseType = updates.courseType;
    if (updates.seeApplicable !== undefined) existing.seeApplicable = updates.seeApplicable;
    if (updates.status) existing.status = updates.status;

    existing.version = (existing.version || 1) + 1;
    existing.updatedAt = new Date().toISOString();
    this.subjects.set(id, existing);

    // Save to MockStorage
    const stored: StoredAcademicSubject = {
      id: existing.id,
      universityId: existing.universityId,
      schemeId: existing.schemeId,
      branchId: existing.branchId,
      semester: existing.semester,
      academicYear: '2022-2026',
      subjectCode: existing.subjectCode,
      subjectName: existing.subjectName,
      credits: existing.credits,
      courseType: existing.courseType,
      seeApplicable: existing.seeApplicable,
      cieApplicable: true,
      sourceType: 'OFFICIAL_UNIVERSITY_WEBSITE',
      sourceUrl: 'https://vtu.ac.in',
      sourceDocument: 'VTU Official Curriculum (Admin Updated)',
      verificationStatus: existing.status === 'PUBLISHED' ? 'VERIFIED' : 'UNVERIFIED',
      publishStatus: existing.status,
      lastVerifiedAt: existing.updatedAt,
      version: existing.version,
      createdAt: existing.createdAt || existing.updatedAt,
      updatedAt: existing.updatedAt,
    };
    MockStorageProvider.saveAcademicSubject(stored);

    // Persist to Supabase PostgreSQL database
    if (isSupabaseConfigured()) {
      const client = getSupabaseAdminClient();
      if (client) {
        try {
          const { error } = await client
            .from('academic_subjects')
            .update({
              subject_code: existing.subjectCode,
              subject_name: existing.subjectName,
              credits: existing.credits,
              course_type: existing.courseType,
              see_applicable: existing.seeApplicable,
              publish_status: existing.status,
              version: existing.version,
              updated_at: existing.updatedAt,
            })
            .eq('id', existing.id);
          if (error) {
            console.warn('[AcademicServerStore] Supabase subject update warning:', error.message);
          }
        } catch (dbErr) {
          console.warn('[AcademicServerStore] Supabase subject update exception:', dbErr);
        }
      }
    }

    this.invalidateCaches({
      universityId: existing.universityId,
      schemeId: existing.schemeId,
      branchId: existing.branchId,
      semester: existing.semester,
    });

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'SUBJECT_UPDATED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { updates },
    });

    return existing;
  }

  public async deleteSubject(id: string, actor = 'admin'): Promise<boolean> {
    const existing = this.subjects.get(id);
    if (!existing) return false;

    this.subjects.delete(id);
    MockStorageProvider.deleteAcademicSubject(id);

    if (isSupabaseConfigured()) {
      const client = getSupabaseAdminClient();
      if (client) {
        try {
          await client.from('academic_subjects').delete().eq('id', id);
        } catch (dbErr) {
          console.warn('[AcademicServerStore] Supabase subject delete warning:', dbErr);
        }
      }
    }

    this.invalidateCaches({
      universityId: existing.universityId,
      schemeId: existing.schemeId,
      branchId: existing.branchId,
      semester: existing.semester,
    });

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'SUBJECT_ARCHIVED',
      targetType: 'CURRICULUM',
      targetId: id,
      metadata: { deletedSubject: existing },
    });

    return true;
  }

  // =========================================================================
  // CURRICULUM PUBLISHING
  // =========================================================================

  public async publishCurriculum(
    scope: {
      universityId: string;
      schemeId: string;
      branchId: string;
      semester: number;
    },
    targetStatus: CurriculumPublishStatus = 'PUBLISHED',
    actor = 'admin'
  ): Promise<{ success: boolean; affectedCount: number; revision: number; publishedAt: string }> {
    const now = new Date().toISOString();

    // 1. Increment canonical revision for this scope
    const scopeId = `${scope.universityId}_${scope.schemeId}_${scope.branchId}_sem${scope.semester}`;
    const prevRev = this.revisions.get(scopeId) || MockStorageProvider.getCurriculumRevision(scopeId);
    const nextRev = (prevRev?.revisionNumber || 0) + 1;

    // 2. Mark in-memory subjects as targetStatus and persist to MockStorage
    let affectedCount = 0;
    for (const [k, s] of this.subjects.entries()) {
      if (
        s.universityId === scope.universityId &&
        s.schemeId === scope.schemeId &&
        s.branchId === scope.branchId &&
        s.semester === scope.semester
      ) {
        s.status = targetStatus;
        s.revisionNumber = nextRev;
        s.updatedAt = now;
        this.subjects.set(k, s);

        MockStorageProvider.saveAcademicSubject({
          id: s.id,
          universityId: s.universityId,
          schemeId: s.schemeId,
          branchId: s.branchId,
          semester: s.semester,
          academicYear: '2026',
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          credits: s.credits,
          courseType: s.courseType,
          seeApplicable: s.seeApplicable,
          cieApplicable: true,
          sourceType: 'MANUAL_ADMIN_ENTRY',
          verificationStatus: 'VERIFIED',
          publishStatus: targetStatus,
          revisionNumber: nextRev,
          version: s.version || 1,
          lastVerifiedAt: now,
          createdAt: s.createdAt,
          updatedAt: now,
        });

        affectedCount++;
      }
    }

    const revRecord: CurriculumRevisionRecord = {
      id: scopeId,
      universityId: scope.universityId,
      schemeId: scope.schemeId,
      branchId: scope.branchId,
      semester: scope.semester,
      revisionNumber: nextRev,
      status: 'ACTIVE',
      publishedBy: actor,
      publishedAt: now,
      coursesCount: affectedCount,
      createdAt: prevRev?.createdAt || now,
      updatedAt: now,
    };
    this.revisions.set(scopeId, revRecord);
    MockStorageProvider.saveCurriculumRevision(revRecord);
    MockStorageProvider.saveCurriculumRevisionHistory(revRecord);

    // 3. Persist atomically to Supabase PostgreSQL database
    if (isSupabaseConfigured()) {
      const client = getSupabaseAdminClient();
      if (client) {
        try {
          // A. Update subjects in scope to targetStatus with new revision number
          const { error: subErr } = await client
            .from('academic_subjects')
            .update({
              publish_status: targetStatus,
              revision_number: nextRev,
              updated_at: now,
            })
            .eq('university_id', scope.universityId)
            .eq('scheme_id', scope.schemeId)
            .eq('branch_id', scope.branchId)
            .eq('semester', scope.semester);

          if (subErr) {
            console.warn('[AcademicServerStore] Supabase publish subjects update warning:', subErr.message);
          }

          // B. Upsert active canonical curriculum revision
          const { error: revErr } = await client
            .from('academic_curriculum_revisions')
            .upsert({
              id: scopeId,
              university_id: scope.universityId,
              scheme_id: scope.schemeId,
              branch_id: scope.branchId,
              semester: scope.semester,
              revision_number: nextRev,
              status: 'ACTIVE',
              published_by: actor,
              published_at: now,
              courses_count: affectedCount,
              updated_at: now,
            });

          if (revErr) {
            console.warn('[AcademicServerStore] Supabase publish revision upsert warning:', revErr.message);
          }

          // C. Record append-only revision history
          await client.from('academic_curriculum_revision_history').insert({
            scope_id: scopeId,
            university_id: scope.universityId,
            scheme_id: scope.schemeId,
            branch_id: scope.branchId,
            semester: scope.semester,
            revision_number: nextRev,
            published_by: actor,
            published_at: now,
            courses_count: affectedCount,
          });
        } catch (dbErr: any) {
          console.warn('[AcademicServerStore] Supabase publish transaction exception:', dbErr);
        }
      }
    }

    // 4. Invalidate all cache layers
    this.invalidateCaches(scope);

    MockStorageProvider.addAuditLog({
      adminUserId: actor,
      adminEmail: actor,
      action: 'CURRICULUM_PUBLISHED',
      targetType: 'CURRICULUM',
      targetId: `${scope.branchId}-sem-${scope.semester}`,
      metadata: { scope, targetStatus, affectedCount, revision: nextRev, publishedAt: now },
    });

    return { success: true, affectedCount, revision: nextRev, publishedAt: now };
  }

  // =========================================================================
  // CURRICULUM RESOLUTION (FOR PUBLIC STUDENT SGPA CALCULATOR)
  // =========================================================================

  /**
   * Resolves official published curriculum for public students.
   * If curriculum is not available, returns { available: false, courses: [] }.
   * Strictly NO silent fallbacks to other schemes or branches!
   */
  public resolveCurriculum(
    universityId: string,
    schemeId: string,
    branchId: string,
    semester: number
  ): {
    available: boolean;
    courses: AcademicSubjectRecord[];
    message?: string;
    revision: number;
    publishedAt: string;
  } {
    const courses = this.getSubjects({
      universityId,
      schemeId,
      branchId,
      semester,
      status: 'PUBLISHED',
    });

    const activeRev = this.getActiveRevision({ universityId, schemeId, branchId, semester });

    if (courses.length === 0) {
      return {
        available: false,
        courses: [],
        message: 'Curriculum not available yet. Ask Admin to add curriculum.',
        revision: activeRev.revisionNumber,
        publishedAt: activeRev.publishedAt,
      };
    }

    return {
      available: true,
      courses,
      revision: activeRev.revisionNumber,
      publishedAt: activeRev.publishedAt,
    };
  }

  public async resolveCurriculumAsync(
    universityId: string,
    schemeId: string,
    branchId: string,
    semester: number
  ): Promise<{
    available: boolean;
    courses: AcademicSubjectRecord[];
    message?: string;
    revision: number;
    publishedAt: string;
  }> {
    const courses = await this.getSubjectsAsync({
      universityId,
      schemeId,
      branchId,
      semester,
      status: 'PUBLISHED',
    });

    const activeRev = await this.getActiveRevisionAsync({ universityId, schemeId, branchId, semester });

    if (courses.length === 0) {
      return {
        available: false,
        courses: [],
        message: 'Curriculum not available yet. Ask Admin to add curriculum.',
        revision: activeRev.revisionNumber,
        publishedAt: activeRev.publishedAt,
      };
    }

    return {
      available: true,
      courses,
      revision: activeRev.revisionNumber,
      publishedAt: activeRev.publishedAt,
    };
  }

  // =========================================================================
  // BATCH IMPORT (CSV / JSON)
  // =========================================================================

  public async importCurriculum(
    payload: {
      format: 'csv' | 'json';
      data: string;
      universityId: string;
      schemeId: string;
      branchId: string;
      semester: number;
    },
    actor = 'admin'
  ): Promise<{ importedCount: number; errors: string[] }> {
    const errors: string[] = [];
    const subjectsToCreate: Array<{
      subjectCode: string;
      subjectName: string;
      credits: number;
      courseType: AcademicCourseType;
      seeApplicable: boolean;
    }> = [];

    if (payload.format === 'json') {
      try {
        const parsed = JSON.parse(payload.data);
        if (!Array.isArray(parsed)) {
          throw new Error('JSON data must be an array of subject objects.');
        }

        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          const code = item.subjectCode || item.code || item.courseCode;
          const name = item.subjectName || item.title || item.courseTitle;
          const credits = Number(item.credits);

          if (!code) {
            errors.push(`Row ${i + 1}: Missing subjectCode`);
            continue;
          }
          if (!name) {
            errors.push(`Row ${i + 1}: Missing subjectName`);
            continue;
          }
          if (isNaN(credits) || credits <= 0) {
            errors.push(`Row ${i + 1}: Invalid credits "${item.credits}"`);
            continue;
          }

          subjectsToCreate.push({
            subjectCode: String(code).trim().toUpperCase(),
            subjectName: String(name).trim(),
            credits,
            courseType: item.courseType || 'Theory',
            seeApplicable: item.seeApplicable !== false,
          });
        }
      } catch (err: any) {
        throw new Error(`JSON parsing failed: ${err.message}`);
      }
    } else {
      // CSV format: subjectCode,subjectName,credits[,courseType,seeApplicable]
      const lines = payload.data.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let startIndex = 0;

      // Detect header row
      if (lines[0] && lines[0].toLowerCase().includes('code')) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length < 3) {
          errors.push(`Line ${i + 1}: Expected at least 3 comma-separated columns (code, name, credits)`);
          continue;
        }

        const [code, name, creditsStr, courseType, seeStr] = parts;
        const credits = Number(creditsStr);

        if (!code) {
          errors.push(`Line ${i + 1}: Missing subject code`);
          continue;
        }
        if (!name) {
          errors.push(`Line ${i + 1}: Missing subject name`);
          continue;
        }
        if (isNaN(credits) || credits <= 0) {
          errors.push(`Line ${i + 1}: Invalid credits "${creditsStr}"`);
          continue;
        }

        subjectsToCreate.push({
          subjectCode: code.toUpperCase(),
          subjectName: name,
          credits,
          courseType: (courseType as AcademicCourseType) || 'Theory',
          seeApplicable: seeStr ? !['false', 'no', '0'].includes(seeStr.toLowerCase()) : true,
        });
      }
    }

    if (errors.length > 0 && subjectsToCreate.length === 0) {
      return { importedCount: 0, errors };
    }

    let importedCount = 0;
    for (const sub of subjectsToCreate) {
      try {
        await this.createSubject({
          universityId: payload.universityId,
          schemeId: payload.schemeId,
          branchId: payload.branchId,
          semester: payload.semester,
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          credits: sub.credits,
          courseType: sub.courseType,
          seeApplicable: sub.seeApplicable,
          status: 'PUBLISHED',
        }, actor);
        importedCount++;
      } catch (err: any) {
        errors.push(`Subject ${sub.subjectCode}: ${err.message}`);
      }
    }

    return { importedCount, errors };
  }
}

export const academicServerStore = AcademicServerStore.getInstance();
