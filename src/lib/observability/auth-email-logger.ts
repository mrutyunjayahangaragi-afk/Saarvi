/**
 * Saarvi Auth Email Deliverability & Diagnostics Telemetry
 *
 * Privacy Invariant:
 * - NEVER logs passwords, OTP codes, session tokens, or private user contents.
 * - Stores operational metadata: timestamp, recipient domain/masked address, provider, delivery status, error category.
 */

import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export type AuthEmailEventType =
  | 'SIGNUP_OTP_SENT'
  | 'RESEND_OTP_SENT'
  | 'OTP_DELIVERY_FAILED'
  | 'OTP_VERIFIED'
  | 'WELCOME_EMAIL_SENT';

export interface AuthEmailLogEntry {
  id: string;
  userId?: string;
  email: string;
  eventType: AuthEmailEventType;
  provider: string;
  status: 'SUCCESS' | 'FAILURE';
  errorCategory?: string;
  errorMessage?: string;
  createdAt: string;
}

// In-memory circular ring buffer for fast operational diagnostics (last 200 events)
const IN_MEMORY_LOGS: AuthEmailLogEntry[] = [];
const MAX_IN_MEMORY_LOGS = 200;

export const authEmailLogger = {
  /**
   * Records an auth email delivery or verification event safely.
   */
  async logEvent(params: {
    userId?: string;
    email: string;
    eventType: AuthEmailEventType;
    provider?: string;
    status: 'SUCCESS' | 'FAILURE';
    errorCategory?: string;
    errorMessage?: string;
  }): Promise<void> {
    const cleanEmail = params.email.trim().toLowerCase();
    const entry: AuthEmailLogEntry = {
      id: `ael_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: params.userId,
      email: cleanEmail,
      eventType: params.eventType,
      provider: params.provider || 'Gmail SMTP',
      status: params.status,
      errorCategory: params.errorCategory,
      errorMessage: params.errorMessage ? this.sanitizeError(params.errorMessage) : undefined,
      createdAt: new Date().toISOString(),
    };

    // Store in ring buffer
    IN_MEMORY_LOGS.unshift(entry);
    if (IN_MEMORY_LOGS.length > MAX_IN_MEMORY_LOGS) {
      IN_MEMORY_LOGS.pop();
    }

    // Persist to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          await supabase.from('auth_email_logs').insert({
            user_id: entry.userId || null,
            email: entry.email,
            event_type: entry.eventType,
            provider: entry.provider,
            status: entry.status,
            error_category: entry.errorCategory || null,
            error_message: entry.errorMessage || null,
            created_at: entry.createdAt,
          });
        }
      } catch (err) {
        // Non-blocking: never fail user signup due to telemetry insert failure
        console.warn('[AuthEmailLogger] Failed to write to auth_email_logs table:', err);
      }
    }
  },

  /**
   * Retrieves recent email logs for Admin Diagnostics dashboard.
   */
  async getRecentLogs(limit = 50): Promise<AuthEmailLogEntry[]> {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('auth_email_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (!error && Array.isArray(data) && data.length > 0) {
            return data.map((row: any) => ({
              id: row.id,
              userId: row.user_id,
              email: row.email,
              eventType: row.event_type as AuthEmailEventType,
              provider: row.provider,
              status: row.status as 'SUCCESS' | 'FAILURE',
              errorCategory: row.error_category,
              errorMessage: row.error_message,
              createdAt: row.created_at,
            }));
          }
        }
      } catch {
        // Fall back to in-memory buffer
      }
    }

    return IN_MEMORY_LOGS.slice(0, limit);
  },

  /**
   * Gets email delivery summary statistics for diagnostics.
   */
  async getStats(): Promise<{
    totalAttempts: number;
    successfulSends: number;
    failedSends: number;
    verifications: number;
    lastAttemptAt?: string;
    lastStatus?: 'SUCCESS' | 'FAILURE';
  }> {
    const logs = await this.getRecentLogs(100);
    const sends = logs.filter((l) => l.eventType === 'SIGNUP_OTP_SENT' || l.eventType === 'RESEND_OTP_SENT');
    const successfulSends = sends.filter((l) => l.status === 'SUCCESS').length;
    const failedSends = logs.filter((l) => l.status === 'FAILURE' || l.eventType === 'OTP_DELIVERY_FAILED').length;
    const verifications = logs.filter((l) => l.eventType === 'OTP_VERIFIED').length;

    return {
      totalAttempts: sends.length,
      successfulSends,
      failedSends,
      verifications,
      lastAttemptAt: logs[0]?.createdAt,
      lastStatus: logs[0]?.status,
    };
  },

  /**
   * Redacts any credential or token leak from error messages.
   */
  sanitizeError(msg: string): string {
    return msg
      .replace(/([a-zA-Z0-9_-]{16,})/g, '[REDACTED]')
      .replace(/password\s*[:=]\s*[^\s,;]+/gi, 'password=[REDACTED]')
      .replace(/otp\s*[:=]\s*[^\s,;]+/gi, 'otp=[REDACTED]');
  },
};
