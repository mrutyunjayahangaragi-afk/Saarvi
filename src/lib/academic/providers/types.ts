/**
 * Saarvi Authoritative Academic Subject Provider Architecture
 * Enforces strict source priority, institution-scoping, and conflict review.
 */

export type AcademicSourceType =
  | 'OFFICIAL_UNIVERSITY_WEBSITE'
  | 'OFFICIAL_CURRICULUM_PDF'
  | 'OFFICIAL_UNIVERSITY_API'
  | 'VERIFIED_ACADEMIC_DATASET'
  | 'MANUAL_ADMIN_ENTRY';

export type AcademicVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'DISPUTED'
  | 'CONFLICT_REQUIRES_REVIEW'
  | 'REJECTED';

export interface AcademicScope {
  universityId: string;
  schemeId: string;
  branchId: string;
  semester: number;
  academicYear?: string;
  institutionId?: string;
}

export interface AuthoritativeSubject {
  id: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  semester: number;
  branch: string;
  scheme: string;
  university: string;
  academicYear: string;
  sourceType: AcademicSourceType;
  sourceUrl?: string;
  sourceDocument?: string;
  lastVerifiedAt: string;
  verificationStatus: AcademicVerificationStatus;
  courseType?: 'Theory' | 'Lab' | 'Practical' | 'Project' | 'Activity' | 'Other';
  seeApplicable?: boolean;
  cieApplicable?: boolean;
  conflictDetails?: {
    conflictingSources: Array<{
      source: string;
      subjectName?: string;
      credits?: number;
      timestamp: string;
    }>;
  };
  auditHistory?: Array<{
    timestamp: string;
    action: string;
    actor: string;
    changes: Record<string, { old: any; new: any }>;
  }>;
}

export interface AcademicSubjectProvider {
  readonly priority: number; // 1 (highest) to 4 (lowest)
  readonly providerName: string;
  readonly sourceType: AcademicSourceType;

  searchSubjects(scope: AcademicScope, query?: string): Promise<AuthoritativeSubject[]>;
  getSubject(scope: AcademicScope, subjectCode: string): Promise<AuthoritativeSubject | null>;
}
