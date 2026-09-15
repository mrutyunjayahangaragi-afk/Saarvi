import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { CANONICAL_TOOL_REGISTRY, CANONICAL_TOOL_CATEGORIES } from '@/lib/tools/tool-registry';
import { getDefaultToolAccessMode, ToolAccessMode } from '@/lib/tools/access-control';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tools
 * Lists all canonical tools with merged database overrides and access configurations.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'VIEW');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    let dbOverridesMap = new Map<string, any>();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data: dbOverrides } = await supabase.from('tool_overrides').select('*');
        if (dbOverrides) {
          dbOverrides.forEach((row: any) => {
            dbOverridesMap.set(row.id, row);
          });
        }
      }
    } else {
      const localOverrides = MockStorageProvider.getToolOverrides();
      Object.entries(localOverrides).forEach(([id, cfg]) => {
        dbOverridesMap.set(id, cfg);
      });
    }

    const mergedTools = CANONICAL_TOOL_REGISTRY.map((t) => {
      const override = dbOverridesMap.get(t.key) || dbOverridesMap.get(t.featureFlagKey);
      const defaultMode = getDefaultToolAccessMode(t.key);
      const accessMode: ToolAccessMode =
        override?.access_mode || override?.accessMode || defaultMode;

      const requiresAuth =
        override?.requires_auth !== undefined
          ? Boolean(override.requires_auth)
          : override?.requiresAuth !== undefined
          ? Boolean(override.requiresAuth)
          : accessMode === 'AUTH_REQUIRED' || accessMode === 'PRO';

      const requiresPro =
        override?.requires_pro !== undefined
          ? Boolean(override.requires_pro)
          : override?.requiresPro !== undefined
          ? Boolean(override.requiresPro)
          : accessMode === 'PRO';

      const status = (override?.status || t.status.toUpperCase()).toUpperCase();
      const isEnabled = status === 'AVAILABLE' || status === 'BETA';
      const publicVisible =
        override?.public_visible !== undefined
          ? Boolean(override.public_visible)
          : override?.hidden !== undefined
          ? !override.hidden
          : true;

      return {
        id: t.key,
        name: t.name,
        category: t.category,
        route: t.route,
        icon: t.icon,
        description: t.description,
        status,
        isEnabled,
        accessMode,
        requiresAuth,
        requiresPro,
        publicVisible,
        updatedAt: override?.updated_at || override?.updatedAt,
        updatedBy: override?.updated_by || override?.updatedBy,
      };
    });

    return NextResponse.json({
      success: true,
      tools: mergedTools,
      categories: CANONICAL_TOOL_CATEGORIES,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Failed to fetch tool configuration records.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tools
 * Modifies tool status, access mode, requiresAuth, and requiresPro with audit logging.
 */
export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const {
      toolId,
      status,
      requiresAuth,
      requiresPro,
      accessMode,
      publicVisible,
    } = body;

    if (!toolId || typeof toolId !== 'string') {
      return NextResponse.json({ error: 'Tool ID is required.' }, { status: 400 });
    }

    const cleanToolId = toolId.toLowerCase().trim();
    const actor = authResult.user;
    const now = new Date().toISOString();

    const canonical = CANONICAL_TOOL_REGISTRY.find(
      (t) => t.key === cleanToolId || t.featureFlagKey === cleanToolId
    );

    // Derive proper access mode
    let derivedAccessMode: ToolAccessMode = accessMode || 'PUBLIC_FREE';
    if (requiresPro) {
      derivedAccessMode = 'PRO';
    } else if (requiresAuth && derivedAccessMode === 'PUBLIC_FREE') {
      derivedAccessMode = 'AUTH_REQUIRED';
    } else if (status === 'DISABLED') {
      derivedAccessMode = 'DISABLED';
    }

    const targetStatus = (status || (derivedAccessMode === 'DISABLED' ? 'DISABLED' : 'AVAILABLE')).toUpperCase();

    // Persist to Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Fetch old record for audit logging
        const { data: oldRow } = await supabase
          .from('tool_overrides')
          .select('*')
          .eq('id', cleanToolId)
          .maybeSingle();

        const payload: any = {
          id: cleanToolId,
          name: canonical?.name || cleanToolId,
          category: canonical?.category || 'pdf',
          status: targetStatus,
          requires_auth: Boolean(requiresAuth),
          requires_pro: Boolean(requiresPro),
          access_mode: derivedAccessMode,
          public_visible: publicVisible !== undefined ? Boolean(publicVisible) : true,
          updated_at: now,
          updated_by: actor.email,
        };

        const { error: upsertErr } = await supabase.from('tool_overrides').upsert(payload);
        if (upsertErr) {
          // If columns don't exist yet, try basic columns
          await supabase.from('tool_overrides').upsert({
            id: cleanToolId,
            name: canonical?.name || cleanToolId,
            status: targetStatus,
            requires_auth: Boolean(requiresAuth),
            requires_pro: Boolean(requiresPro),
            updated_at: now,
            updated_by: actor.email,
          });
        }

        // Record audit log
        await supabase.from('audit_logs').insert({
          admin_user_id: actor.id,
          admin_email: actor.email,
          action: `TOOL_ACCESS_UPDATED`,
          target_type: 'TOOL',
          target_id: cleanToolId,
          metadata: {
            before: oldRow || { status: canonical?.status || 'available' },
            after: payload,
          },
          timestamp: now,
        });
      }
    } else {
      // Mock / offline mode
      MockStorageProvider.saveToolOverride({
        id: cleanToolId,
        status: targetStatus as any,
        requiresAuth: Boolean(requiresAuth),
        requiresPro: Boolean(requiresPro),
        accessMode: derivedAccessMode as any,
        hidden: publicVisible === false,
        updatedAt: now,
        updatedBy: actor.email,
      });

      MockStorageProvider.addAuditLog({
        adminUserId: actor.id,
        adminEmail: actor.email,
        action: 'TOOL_ACCESS_UPDATED',
        targetType: 'TOOL',
        targetId: cleanToolId,
        metadata: {
          status: targetStatus,
          requiresAuth: Boolean(requiresAuth),
          requiresPro: Boolean(requiresPro),
          accessMode: derivedAccessMode,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Updated access controls for ${canonical?.name || cleanToolId}.`,
      tool: {
        id: cleanToolId,
        status: targetStatus,
        accessMode: derivedAccessMode,
        requiresAuth: Boolean(requiresAuth),
        requiresPro: Boolean(requiresPro),
        publicVisible: publicVisible !== undefined ? Boolean(publicVisible) : true,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Failed to update tool access configuration.' },
      { status: 500 }
    );
  }
}
