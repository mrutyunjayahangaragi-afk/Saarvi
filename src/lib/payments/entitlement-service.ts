/**
 * Server-Authoritative Entitlement Management Service
 *
 * Implements Prompt Section 22:
 * - Grants Pro access upon confirmed Cashfree payment
 * - Enforces Cumulative Extension Policy:
 *   If user already has active Pro (e.g. expires 2026-10-20),
 *   new purchase adds +30 days (expires 2026-11-19).
 * - Avoids conflicting active entitlement records.
 * - Synchronizes profiles.plan = 'pro' in Supabase.
 */

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export interface GrantEntitlementParams {
  userId: string;
  planId: string;
  durationDays?: number; // default 30 days
  source?: string; // 'CASHFREE'
  transactionId?: string | null;
}

export interface EntitlementResult {
  id: string;
  userId: string;
  feature: string;
  planId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  startsAt: string;
  endsAt: string;
  isExtended: boolean;
  daysRemaining: number;
}

export async function grantOrExtendProEntitlement({
  userId,
  planId,
  durationDays = 30,
  source = 'CASHFREE',
  transactionId = null,
}: GrantEntitlementParams): Promise<EntitlementResult> {
  const supabase = getSupabaseAdminClient();
  const now = new Date();

  if (!isSupabaseConfigured() || !supabase) {
    // Local memory fallback for environments without live Supabase
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return {
      id: `ent_local_${Date.now()}`,
      userId,
      feature: 'pro',
      planId,
      status: 'ACTIVE',
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      isExtended: false,
      daysRemaining: durationDays,
    };
  }

  // 1. Check for existing active Pro entitlement
  const { data: existing } = await supabase
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .gt('ends_at', now.toISOString())
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let baseDate = now;
  let isExtended = false;
  let startsAt = now;

  if (existing && new Date(existing.ends_at) > now) {
    // Cumulative Extension Policy: Add durationDays to existing expiry
    baseDate = new Date(existing.ends_at);
    isExtended = true;
    startsAt = new Date(existing.starts_at);
  }

  const endsAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  let resultId = '';

  if (isExtended && existing) {
    // Update existing active entitlement without creating conflicting records
    const { data: updated } = await supabase
      .from('entitlements')
      .update({
        ends_at: endsAt.toISOString(),
        payment_transaction_id: transactionId || existing.payment_transaction_id,
        updated_at: now.toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .single();

    resultId = updated?.id || existing.id;
  } else {
    // Create fresh active entitlement
    const { data: inserted, error: insertError } = await supabase
      .from('entitlements')
      .insert({
        user_id: userId,
        feature: 'pro',
        plan_id: planId,
        status: 'ACTIVE',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        source,
        payment_transaction_id: transactionId,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Entitlement Grant Error]:', insertError);
      throw new Error(`Failed to provision entitlement: ${insertError.message}`);
    }

    resultId = inserted?.id || `ent_${Date.now()}`;
  }

  // Synchronize user profile
  try {
    await supabase
      .from('profiles')
      .update({
        plan: 'pro',
        updated_at: now.toISOString(),
      })
      .eq('id', userId);
  } catch (err) {
    console.warn('[Profile Plan Sync Warning]:', err);
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    id: resultId,
    userId,
    feature: 'pro',
    planId,
    status: 'ACTIVE',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    isExtended,
    daysRemaining,
  };
}

export async function getActiveProEntitlement(userId: string): Promise<{
  isPro: boolean;
  entitlement: EntitlementResult | null;
}> {
  const supabase = getSupabaseAdminClient();
  const now = new Date();

  if (!isSupabaseConfigured() || !supabase) {
    return { isPro: false, entitlement: null };
  }

  const { data: activeEnt } = await supabase
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .gt('ends_at', now.toISOString())
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeEnt) {
    return { isPro: false, entitlement: null };
  }

  const endsAt = new Date(activeEnt.ends_at);
  const daysRemaining = Math.max(
    0,
    Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    isPro: true,
    entitlement: {
      id: activeEnt.id,
      userId: activeEnt.user_id,
      feature: activeEnt.feature || 'pro',
      planId: activeEnt.plan_id || 'pro_30_days',
      status: activeEnt.status,
      startsAt: activeEnt.starts_at,
      endsAt: activeEnt.ends_at,
      isExtended: false,
      daysRemaining,
    },
  };
}
