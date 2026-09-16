import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'VIEW');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const allUsers = MockStorageProvider.listAllUsers();

    let filtered = allUsers;
    if (query.length > 0) {
      filtered = allUsers.filter(
        (u) =>
          u.id.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.fullName.toLowerCase().includes(query)
      );
    }

    // Only return safe public account metadata — NEVER private workspace contents
    const safeUsers = filtered.slice(0, limit).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      plan: u.plan || 'FREE',
      status: u.status,
    }));

    return NextResponse.json({
      success: true,
      total: filtered.length,
      users: safeUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to search users.' }, { status: 500 });
  }
}
