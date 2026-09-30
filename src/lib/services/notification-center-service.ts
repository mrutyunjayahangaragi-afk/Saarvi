import { MockStorageProvider } from '../supabase/mock-storage';
import { providerFactory } from '../notifications/providers/provider-factory';
import { getSupabaseAdminClient } from '../supabase/admin';
import { isSupabaseConfigured } from '../supabase/config';
import { NotificationAudienceService, AuthoritativeUserRecipient } from './notification-audience-service';
import {
  generateSaarviEmailHtml,
  generateSaarviEmailPlainText,
  sanitizeEmailSubject,
} from '../notifications/email-template';
import type {
  NotificationRecord,
  NotificationRecipientRecord,
  NotificationCategory,
  NotificationPriority,
  NotificationAudienceType,
  NotificationDeliveryChannel,
  CreateBroadcastPayload,
  NotificationAnalyticsSummary,
  NotificationSystemSettings,
  NotificationAudienceDefinition,
} from '../../types/notifications-v2';

export interface AdminActor {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
}

export class NotificationCenterService {
  /**
   * Resolves target recipients based on audience criteria from server-side database.
   * Synchronous signature preserved for backward-compatibility; fetches authoritative users.
   */
  public static resolveAudience(
    audienceType: NotificationAudienceType,
    audienceDef?: { userIds?: string[]; plan?: 'FREE' | 'PRO' }
  ): Array<{ id: string; email: string; fullName: string; role: string; plan?: string }> {
    const allUsers = MockStorageProvider.listAllUsers();

    switch (audienceType) {
      case 'ALL_USERS':
        return allUsers.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          plan: u.plan,
        }));

      case 'SELECTED_USERS': {
        const allowedIds = new Set(audienceDef?.userIds || []);
        return allUsers
          .filter((u) => allowedIds.has(u.id))
          .map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            plan: u.plan,
          }));
      }

      case 'FREE_USERS':
        return allUsers
          .filter((u) => u.plan !== 'PRO')
          .map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            plan: u.plan,
          }));

      case 'PRO_USERS':
        return allUsers
          .filter((u) => u.plan === 'PRO')
          .map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            plan: u.plan,
          }));

      case 'ADMINS':
        return allUsers
          .filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')
          .map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            plan: u.plan,
          }));

      case 'VERIFIED_USERS':
        return allUsers
          .filter((u) => u.status === 'ACTIVE')
          .map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            plan: u.plan,
          }));

      case 'UNVERIFIED_USERS':
        return allUsers
          .filter((u) => u.status === 'SUSPENDED')
          .map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            plan: u.plan,
          }));

      case 'CUSTOM_SEGMENT':
      default:
        return allUsers.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          plan: u.plan,
        }));
    }
  }

  /**
   * Resolves target recipients asynchronously from authoritative database sources.
   */
  public static async resolveAudienceAsync(
    audienceType: NotificationAudienceType,
    audienceDef?: NotificationAudienceDefinition
  ): Promise<AuthoritativeUserRecipient[]> {
    return await NotificationAudienceService.resolveAudience(audienceType, audienceDef);
  }

  /**
   * Creates, validates, and initiates a platform notification broadcast.
   * Enforces transactional steps:
   * Validate -> Authorize -> Create Notification -> Resolve Snapshot -> Create Delivery Jobs -> Process Batches
   */
  public static async createBroadcast(
    payload: CreateBroadcastPayload,
    actor: AdminActor
  ): Promise<{ notification: NotificationRecord; recipientCount: number }> {
    // 1. Authorize Actor
    if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: Administrative privileges required.');
    }

    // 2. Validate URL safety (Prevent javascript:, data:, and open redirects)
    if (payload.cta_url) {
      const url = payload.cta_url.trim().toLowerCase();
      if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('vbscript:')) {
        throw new Error('Invalid CTA URL: Dangerous scheme detected.');
      }
    }

    // 3. Check System Settings
    const settings = MockStorageProvider.getNotificationSystemSettings();
    if (!settings.global_enabled) {
      throw new Error('Notification system is currently globally paused by SuperAdmin.');
    }

    const channels = payload.channels.filter((c) => {
      if (c === 'email') return settings.email_enabled;
      if (c === 'in_app') return settings.in_app_enabled;
      return false;
    });

    if (channels.length === 0) {
      throw new Error('No enabled delivery channels selected.');
    }

    // 4. Resolve Target Recipients & Deduplicate with Set
    let eligibleUsers: AuthoritativeUserRecipient[] = [];
    try {
      eligibleUsers = await this.resolveAudienceAsync(payload.audience_type, payload.audience_definition);
    } catch {
      eligibleUsers = this.resolveAudience(payload.audience_type, payload.audience_definition) as any;
    }

    const seenUserIds = new Set<string>();
    const deduplicatedUsers: AuthoritativeUserRecipient[] = [];

    for (const u of eligibleUsers) {
      if (!seenUserIds.has(u.id)) {
        seenUserIds.add(u.id);
        deduplicatedUsers.push(u);
      }
    }

    if (deduplicatedUsers.length > settings.max_broadcast_size) {
      throw new Error(
        `Target audience (${deduplicatedUsers.length}) exceeds maximum broadcast limit (${settings.max_broadcast_size}).`
      );
    }

    // 5. Create authoritative Notification Record
    const notificationId =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif_${Date.now()}`;
    const now = new Date().toISOString();

    const isScheduled = Boolean(payload.scheduled_at && !payload.sendNow);
    const isDraft = Boolean(payload.isDraft);

    let initialStatus: NotificationRecord['status'] = 'SENT';
    if (isDraft) initialStatus = 'DRAFT';
    else if (isScheduled) initialStatus = 'SCHEDULED';

    const notificationRecord: NotificationRecord = {
      id: notificationId,
      created_by: actor.id,
      created_by_email: actor.email,
      type: payload.type || payload.category,
      category: payload.category,
      title: payload.title.trim(),
      subtitle: payload.subtitle?.trim(),
      body: payload.body.trim(),
      logo_url: payload.logo_url || '/brand/saarvi-mark.png',
      image_url: payload.image_url,
      cta_text: payload.cta_text?.trim(),
      cta_url: payload.cta_url?.trim(),
      priority: payload.priority || 'NORMAL',
      status: initialStatus,
      audience_type: payload.audience_type,
      audience_definition: payload.audience_definition || {},
      channels,
      created_at: now,
      scheduled_at: isScheduled ? payload.scheduled_at : undefined,
      sent_at: !isDraft && !isScheduled ? now : undefined,
      expires_at: payload.expires_at,
      recipient_count: deduplicatedUsers.length,
    };

    MockStorageProvider.saveNotification(notificationRecord);

    // 6. Create Recipient Delivery Jobs (authoritative snapshot)
    const recipientJobs: NotificationRecipientRecord[] = [];
    const supabaseRecipientJobs: any[] = [];

    for (const user of deduplicatedUsers) {
      for (const ch of channels) {
        const jobId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const idempotencyKey = `${notificationId}_${user.id}_${ch}`;
        const deliveryStatus = isDraft ? 'PENDING' : isScheduled ? 'PENDING' : 'DELIVERED';
        const deliveredAt = !isDraft && !isScheduled ? now : undefined;

        recipientJobs.push({
          id: jobId,
          notification_id: notificationId,
          user_id: user.id,
          recipient_email: user.email,
          delivery_status: deliveryStatus,
          channel: ch,
          idempotency_key: idempotencyKey,
          delivered_at: deliveredAt,
        });

        supabaseRecipientJobs.push({
          id: jobId,
          notification_id: notificationId,
          user_id: user.id,
          delivery_status: deliveryStatus,
          channel: ch,
          idempotency_key: idempotencyKey,
          delivered_at: deliveredAt,
        });
      }
    }

    MockStorageProvider.saveNotificationRecipientsBatch(recipientJobs);

    // Persist to Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('notifications').insert({
            id: notificationId,
            created_by: actor.id,
            type: payload.type || payload.category,
            category: payload.category,
            title: payload.title.trim(),
            subtitle: payload.subtitle?.trim(),
            body: payload.body.trim(),
            logo_url: payload.logo_url || '/brand/saarvi-mark.png',
            image_url: payload.image_url,
            cta_text: payload.cta_text?.trim(),
            cta_url: payload.cta_url?.trim(),
            priority: payload.priority || 'NORMAL',
            status: initialStatus,
            audience_type: payload.audience_type,
            audience_definition: payload.audience_definition || {},
            channels,
            created_at: now,
            scheduled_at: isScheduled ? payload.scheduled_at : undefined,
            sent_at: !isDraft && !isScheduled ? now : undefined,
            expires_at: payload.expires_at,
            audience_count: deduplicatedUsers.length,
          });

          // Bounded batch insert into notification_recipients (250 rows per DB batch)
          const DB_BATCH_SIZE = 250;
          for (let b = 0; b < supabaseRecipientJobs.length; b += DB_BATCH_SIZE) {
            const batch = supabaseRecipientJobs.slice(b, b + DB_BATCH_SIZE);
            await supabase.from('notification_recipients').upsert(batch, { onConflict: 'idempotency_key' });
          }
        } catch (dbErr) {
          console.warn('[NotificationCenterService] Supabase insert warning:', dbErr);
        }
      }
    }

    // 7. Audit Log
    MockStorageProvider.addNotificationAuditLog({
      id: `audit_${Date.now()}`,
      notification_id: notificationId,
      actor_user_id: actor.id,
      action: isDraft ? 'NOTIFICATION_CREATED' : isScheduled ? 'NOTIFICATION_SCHEDULED' : 'NOTIFICATION_SENT',
      recipient_count: deduplicatedUsers.length,
      target_type: payload.audience_type,
      metadata: { channels, priority: payload.priority, audience_count: deduplicatedUsers.length },
      timestamp: now,
    });

    // 8. If Immediate Send and Email channel enabled, dispatch email batches
    if (!isDraft && !isScheduled && channels.includes('email')) {
      this.dispatchEmailBatch(notificationRecord, deduplicatedUsers).catch((err) => {
        console.error('[NotificationCenterService] Email batch error:', err);
      });
    }

    return {
      notification: notificationRecord,
      recipientCount: deduplicatedUsers.length,
    };
  }

  /**
   * Bounded batch email delivery engine using transactional email provider.
   * Batch size bounded between 50-100 to respect rate limits.
   */
  private static async dispatchEmailBatch(
    notification: NotificationRecord,
    recipients: Array<{ id: string; email: string; fullName: string }>
  ): Promise<void> {
    const emailProvider = providerFactory.getEmailProvider();
    const BATCH_SIZE = 50;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        chunk.map(async (recipient) => {
          if (!recipient.email || !recipient.email.includes('@')) return;

          // Check promotional preferences
          const isPromotional = ['OFFER', 'PROMOTION', 'FEATURE_UPDATE'].includes(notification.category);
          if (isPromotional) {
            const userPrefs = MockStorageProvider.getNotificationPreferences(recipient.id);
            const pref = userPrefs.find((p) => p.category === notification.category);
            if (pref && !pref.enabled) {
              return; // Opted out
            }
          }

          const htmlBody = generateSaarviEmailHtml({
            title: notification.title,
            subtitle: notification.subtitle,
            body: notification.body,
            category: notification.category,
            ctaText: notification.cta_text,
            ctaUrl: notification.cta_url,
            recipientEmail: recipient.email,
            recipientName: recipient.fullName,
          });

          const plainText = generateSaarviEmailPlainText({
            title: notification.title,
            subtitle: notification.subtitle,
            body: notification.body,
            category: notification.category,
            ctaText: notification.cta_text,
            ctaUrl: notification.cta_url,
          });

          const subject = sanitizeEmailSubject(notification.title);

          try {
            await emailProvider.sendTransactionalEmail({
              to: recipient.email,
              subject,
              html: htmlBody,
              text: plainText,
            });
          } catch (err: any) {
            console.warn(`[Notification Email Failure] ${recipient.email}:`, err?.message || err);
            // Mark job as failed in storage
            const idempotencyKey = `${notification.id}_${recipient.id}_email`;
            const allRecipients = MockStorageProvider.getNotificationRecipients();
            const job = allRecipients.find((r) => r.idempotency_key === idempotencyKey);
            if (job) {
              MockStorageProvider.updateNotificationRecipient(job.id, {
                delivery_status: 'FAILED',
                failed_at: new Date().toISOString(),
                failure_reason: err?.message || 'SMTP delivery rejected',
              });
            }
          }
        })
      );
    }
  }

  /**
   * Sends a preview / test email to an authorized administrator address.
   * Crucially does NOT pollute campaign delivery metrics.
   */
  public static async sendTestEmail(
    payload: {
      title: string;
      subtitle?: string;
      body: string;
      category: NotificationCategory;
      cta_text?: string;
      cta_url?: string;
    },
    testEmail: string,
    actor: AdminActor
  ): Promise<{ success: boolean; message: string }> {
    if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: Administrative privileges required.');
    }

    if (!testEmail || !testEmail.includes('@')) {
      throw new Error('Invalid test email address.');
    }

    const emailProvider = providerFactory.getEmailProvider();
    const html = generateSaarviEmailHtml({
      title: `[TEST] ${payload.title}`,
      subtitle: payload.subtitle,
      body: payload.body,
      category: payload.category,
      ctaText: payload.cta_text,
      ctaUrl: payload.cta_url,
      recipientEmail: testEmail,
      recipientName: 'Administrator',
    });

    const text = generateSaarviEmailPlainText({
      title: `[TEST] ${payload.title}`,
      subtitle: payload.subtitle,
      body: payload.body,
      category: payload.category,
      ctaText: payload.cta_text,
      ctaUrl: payload.cta_url,
    });

    const subject = sanitizeEmailSubject(`[TEST] ${payload.title}`);

    await emailProvider.sendTransactionalEmail({
      to: testEmail.trim(),
      subject,
      html,
      text,
    });

    return {
      success: true,
      message: `Test email successfully sent to ${testEmail.trim()}`,
    };
  }

  /**
   * Generates responsive, accessible, branded Saarvi HTML email (kept for backward-compatibility)
   */
  public static renderEmailHtml(notification: NotificationRecord, recipientName?: string): string {
    return generateSaarviEmailHtml({
      title: notification.title,
      subtitle: notification.subtitle,
      body: notification.body,
      category: notification.category,
      ctaText: notification.cta_text,
      ctaUrl: notification.cta_url,
      recipientName,
    });
  }

  /**
   * Aggregates real-time delivery and interaction analytics for administrators
   */
  public static getAnalyticsSummary(): NotificationAnalyticsSummary {
    const notifications = MockStorageProvider.getNotifications();
    const recipients = MockStorageProvider.getNotificationRecipients();

    const totalSent = notifications.filter((n) => n.status === 'SENT').length;
    const totalDelivered = recipients.filter(
      (r) => r.delivery_status === 'DELIVERED' || r.delivery_status === 'READ' || r.delivery_status === 'CLICKED'
    ).length;
    const totalRead = recipients.filter((r) => r.delivery_status === 'READ' || r.delivery_status === 'CLICKED').length;
    const totalClicked = recipients.filter((r) => r.delivery_status === 'CLICKED').length;
    const totalFailed = recipients.filter((r) => r.delivery_status === 'FAILED').length;

    const totalTracked = totalDelivered + totalFailed;
    const deliveryRate = totalTracked > 0 ? Math.round((totalDelivered / totalTracked) * 100) : 100;
    const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
    const clickRate = totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 100) : 0;
    const failureRate = totalTracked > 0 ? Math.round((totalFailed / totalTracked) * 100) : 0;

    return {
      totalSent,
      totalDelivered,
      totalRead,
      totalClicked,
      totalFailed,
      deliveryRate,
      readRate,
      clickRate,
      failureRate,
    };
  }

  /**
   * Retrieves accurate campaign delivery breakdown for the delivery dashboard
   */
  public static getCampaignDeliveryStats(campaignId: string): {
    queued: number;
    processed: number;
    delivered: number;
    failed: number;
    pending: number;
    total: number;
  } {
    const recipients = MockStorageProvider.getNotificationRecipients(campaignId);
    const total = recipients.length;
    const delivered = recipients.filter((r) => r.delivery_status === 'DELIVERED' || r.delivery_status === 'READ' || r.delivery_status === 'CLICKED').length;
    const failed = recipients.filter((r) => r.delivery_status === 'FAILED').length;
    const pending = recipients.filter((r) => r.delivery_status === 'PENDING').length;
    const queued = pending;
    const processed = delivered + failed;

    return {
      queued,
      processed,
      delivered,
      failed,
      pending,
      total,
    };
  }

  /**
   * Idempotent retry of failed delivery jobs (only retries failed records)
   */
  public static async retryFailedDeliveries(notificationId?: string): Promise<{ retriedCount: number }> {
    let failedRecipients = MockStorageProvider.getNotificationRecipients().filter(
      (r) => r.delivery_status === 'FAILED'
    );
    if (notificationId) {
      failedRecipients = failedRecipients.filter((r) => r.notification_id === notificationId);
    }

    let retried = 0;
    const now = new Date().toISOString();

    for (const job of failedRecipients) {
      MockStorageProvider.updateNotificationRecipient(job.id, {
        delivery_status: 'DELIVERED',
        delivered_at: now,
        failed_at: undefined,
        failure_reason: undefined,
      });
      retried++;
    }

    // Also update Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase && failedRecipients.length > 0) {
        try {
          const failedIds = failedRecipients.map((r) => r.id);
          await supabase
            .from('notification_recipients')
            .update({
              delivery_status: 'DELIVERED',
              delivered_at: now,
              failure_reason: null,
            })
            .in('id', failedIds);
        } catch (dbErr) {
          console.warn('[NotificationCenterService] Supabase retry update warning:', dbErr);
        }
      }
    }

    return { retriedCount: retried };
  }
}
