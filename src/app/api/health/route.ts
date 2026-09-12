// DocEase Phase 15: Public Health Check & Status Endpoint
// GET /api/health
// Provides lightweight operational health status without leaking secrets.

import { NextResponse } from 'next/server';
import { getSafeEnvironmentStatus } from '@/lib/config/env';
import { isSupabaseConfigured } from '@/lib/supabase/config';

import { providerFactory } from '@/lib/notifications/providers/provider-factory';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = performance.now();
  const envStatus = getSafeEnvironmentStatus();
  const dbConfigured = isSupabaseConfigured();
  const emailProvider = providerFactory.getEmailProvider();
  const whatsAppProvider = providerFactory.getWhatsAppProvider();

  const responsePayload = {
    status: 'ok',
    service: 'saarvi',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: envStatus.environment,
    checks: {
      application: 'healthy',
      database: dbConfigured ? 'supabase_configured' : 'local_resilient_store',
      auth: dbConfigured ? 'supabase_auth' : 'local_session',
      email: {
        provider: emailProvider.id,
        name: emailProvider.name,
        configured: emailProvider.isConfigured(),
        status: emailProvider.isConfigured() ? 'operational' : 'not_configured',
      },
      externalProviders: {
        billing: {
          provider: envStatus.billingProvider,
          configured: envStatus.isConfigured,
          plansConfigured: envStatus.hasPlansConfigured,
        },
        whatsapp: whatsAppProvider.isConfigured() ? 'operational' : 'optional_unconfigured',
        ai: Boolean(process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY)
          ? 'configured'
          : 'optional_disabled',
        ocr: Boolean(process.env.OCR_API_KEY || process.env.GEMINI_API_KEY) ? 'configured' : 'optional_disabled',
      },
    },
    latencyMs: Math.round(performance.now() - startTime),
  };

  return NextResponse.json(responsePayload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
