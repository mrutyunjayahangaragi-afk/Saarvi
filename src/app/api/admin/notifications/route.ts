import { NextResponse } from 'next/server';
import { notificationServerStore } from '@/lib/notifications/server-store';
import { providerFactory } from '@/lib/notifications/providers/provider-factory';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Server-Authoritative Admin Authorization Check
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Administrative privileges required.' },
        { status: 403 }
      );
    }

    const emailProvider = providerFactory.getEmailProvider();
    const whatsAppProvider = providerFactory.getWhatsAppProvider();

    let emailHealth = {
      status: emailProvider.isConfigured() ? 'OPERATIONAL' : 'NOT_CONFIGURED',
      configured: emailProvider.isConfigured(),
      message: emailProvider.isConfigured() ? 'Operational' : 'Not Configured',
    };

    if (typeof emailProvider.checkHealth === 'function') {
      try {
        const health = await emailProvider.checkHealth();
        emailHealth = {
          status: health.status,
          configured: health.configured,
          message: health.message || (health.configured ? 'Operational' : 'Not Configured'),
        };
      } catch {
        // Fail-safe fallback
      }
    }

    const metrics = notificationServerStore.getAdminAggregateMetrics();

    return NextResponse.json({
      success: true,
      providers: {
        email: {
          id: emailProvider.id,
          name: emailProvider.name,
          configured: emailHealth.configured,
          status: emailHealth.status,
          message: emailHealth.message,
        },
        whatsapp: {
          id: whatsAppProvider.id,
          name: whatsAppProvider.name,
          configured: whatsAppProvider.isConfigured(),
          status: whatsAppProvider.isConfigured() ? 'OPERATIONAL' : 'NOT_CONFIGURED',
        },
      },
      metrics,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error fetching admin notification metrics.' },
      { status: 500 }
    );
  }
}
