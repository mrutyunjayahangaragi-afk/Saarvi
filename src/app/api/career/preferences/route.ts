import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/auth-session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { CareerProfilePreferences } from '@/lib/career/career-profile-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ preferences: null });
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('career_preferences')
          .eq('id', authUser.id)
          .single();

        if (profile?.career_preferences) {
          return NextResponse.json({ preferences: profile.career_preferences });
        }
      }
    }

    return NextResponse.json({ preferences: null });
  } catch {
    return NextResponse.json({ preferences: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = (await req.json()) as CareerProfilePreferences;

    if (authUser && isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase
          .from('profiles')
          .update({
            career_preferences: {
              ...body,
              updatedAt: new Date().toISOString(),
            },
          })
          .eq('id', authUser.id);
      }
    }

    return NextResponse.json({
      success: true,
      preferences: body,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to save preferences.' },
      { status: 500 }
    );
  }
}
