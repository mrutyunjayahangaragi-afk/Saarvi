import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { subjectAuthorityService } from '@/lib/academic/services/subject-authority-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const auth = await getAuthenticatedAdmin(request, 'VIEW');
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('academic_subject_conflicts')
            .select('*')
            .eq('resolution_status', status)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            return NextResponse.json({ success: true, conflicts: data });
          }
        } catch (dbErr) {
          console.warn('[AdminAcademicConflicts] Supabase fallback:', dbErr);
        }
      }
    }

    const conflicts = MockStorageProvider.getAcademicSubjectConflicts({ status });
    return NextResponse.json({ success: true, conflicts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve subject conflicts';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const auth = await getAuthenticatedAdmin(request, 'MANAGE');
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { action, conflictId, resolution, notes, correction } = body;

    if (action === 'RESOLVE_CONFLICT') {
      if (!conflictId || !resolution) {
        return NextResponse.json(
          { error: 'Missing conflictId or resolution (RESOLVED or REJECTED)' },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          try {
            await supabase
              .from('academic_subject_conflicts')
              .update({
                resolution_status: resolution,
                resolved_by: auth.user.email,
                resolved_at: new Date().toISOString(),
                admin_notes: notes || null,
              })
              .eq('id', conflictId);
          } catch (dbErr) {
            console.warn('[AdminAcademicConflicts] DB update fallback:', dbErr);
          }
        }
      }

      MockStorageProvider.resolveAcademicSubjectConflict(
        conflictId,
        resolution,
        auth.user.email,
        notes
      );

      MockStorageProvider.recordAcademicAuditLog({
        action: 'CONFLICT_RESOLVED',
        subjectCode: conflictId,
        actor: auth.user.email,
        details: { conflictId, resolution, notes },
      });

      return NextResponse.json({ success: true, message: `Conflict marked ${resolution}` });
    }

    if (action === 'CORRECT_SUBJECT') {
      if (!correction || !correction.subjectCode || !correction.scope) {
        return NextResponse.json(
          { error: 'Missing correction details: scope, subjectCode, newSubjectName, newCredits, officialSourceUrl' },
          { status: 400 }
        );
      }

      const res = await subjectAuthorityService.adminCorrectSubject({
        scope: correction.scope,
        subjectCode: correction.subjectCode,
        newSubjectName: correction.newSubjectName,
        newCredits: Number(correction.newCredits),
        officialSourceUrl: correction.officialSourceUrl,
        officialDocument: correction.officialDocument || 'Admin Verified Document',
        actorEmail: auth.user.email,
        notes: correction.notes,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      // If a conflictId was linked, mark it resolved
      if (conflictId) {
        MockStorageProvider.resolveAcademicSubjectConflict(
          conflictId,
          'RESOLVED',
          auth.user.email,
          `Resolved via manual correction by ${auth.user.email}`
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Subject metadata successfully corrected and audit-logged.',
        subject: res.subject,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process academic conflict action';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
