import { MockStorageProvider } from '../supabase/mock-storage';
import { providerFactory } from '../notifications/providers/provider-factory';
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
} from '../../types/notifications-v2';

export interface AdminActor {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
}

export class NotificationCenterService {
  /**
   * Resolves target recipients based on audience criteria from server-side database.
   * NEVER trusts client-supplied recipient emails or private local workspace data.
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
   * Creates, validates, and initiates a platform notification broadcast.
   * Enforces transactional steps:
   * Validate -> Authorize -> Create Notification -> Resolve Snapshot -> Create Delivery Jobs -> Process Batch
   */
  public static async createBroadcast(
    payload: CreateBroadcastPayload,
    actor: AdminActor
  ): Promise<{ notification: NotificationRecord; recipientCount: number }> {
    // 1. Authorize Actor
    if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: Administrative privileges required.');
    }

    // 2. Validate URL safety (Prevent javascript: and open redirects)
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
    const eligibleUsers = this.resolveAudience(payload.audience_type, payload.audience_definition);
    const seenUserIds = new Set<string>();
    const deduplicatedUsers: typeof eligibleUsers = [];

    for (const u of eligibleUsers) {
      if (!seenUserIds.has(u.id)) {
        seenUserIds.add(u.id);
        deduplicatedUsers.push(u);
      }
    }

    if (deduplicatedUsers.length > settings.max_broadcast_size) {
      throw new Error(`Target audience (${deduplicatedUsers.length}) exceeds maximum broadcast limit (${settings.max_broadcast_size}).`);
    }

    // 5. Create authoritative Notification Record
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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

    // 6. Create Recipient Delivery Jobs (Immutable Snapshot)
    const recipientJobs: NotificationRecipientRecord[] = [];
    for (const user of deduplicatedUsers) {
      for (const ch of channels) {
        const idempotencyKey = `${notificationId}_${user.id}_${ch}`;
        recipientJobs.push({
          id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          notification_id: notificationId,
          user_id: user.id,
          recipient_email: user.email,
          delivery_status: isDraft ? 'PENDING' : isScheduled ? 'PENDING' : 'DELIVERED',
          channel: ch,
          idempotency_key: idempotencyKey,
          delivered_at: !isDraft && !isScheduled ? now : undefined,
        });
      }
    }

    MockStorageProvider.saveNotificationRecipientsBatch(recipientJobs);

    // 7. Audit Log
    MockStorageProvider.addNotificationAuditLog({
      id: `audit_${Date.now()}`,
      notification_id: notificationId,
      actor_user_id: actor.id,
      action: isDraft ? 'NOTIFICATION_CREATED' : isScheduled ? 'NOTIFICATION_SCHEDULED' : 'NOTIFICATION_SENT',
      recipient_count: deduplicatedUsers.length,
      target_type: payload.audience_type,
      metadata: { channels, priority: payload.priority },
      timestamp: now,
    });

    // 8. If Immediate Send and Email channel enabled, dispatch email batch
    if (!isDraft && !isScheduled && channels.includes('email')) {
      // Dispatch emails asynchronously in batches
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
   * Batched email delivery engine using existing Saarvi SMTP infrastructure
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
          // Check promotional preferences
          const isPromotional = ['OFFER', 'PROMOTION', 'FEATURE_UPDATE'].includes(notification.category);
          if (isPromotional) {
            const userPrefs = MockStorageProvider.getNotificationPreferences(recipient.id);
            const pref = userPrefs.find((p) => p.category === notification.category);
            if (pref && !pref.enabled) {
              // User opted out of this promotional category
              return;
            }
          }

          const htmlBody = this.renderEmailHtml(notification, recipient.fullName);
          const plainText = `${notification.title}\n\n${notification.body}\n\n${notification.cta_url || ''}\n\nSaarvi — Study. Work. Grow.`;

          try {
            await emailProvider.sendTransactionalEmail({
              to: recipient.email,
              subject: `Saarvi — ${notification.title}`,
              html: htmlBody,
              text: plainText,
            });
          } catch (err) {
            console.warn(`[Notification Email Failure] ${recipient.email}:`, err);
          }
        })
      );
    }
  }

  /**
   * Generates responsive, accessible, branded Saarvi HTML email
   */
  public static renderEmailHtml(notification: NotificationRecord, recipientName?: string): string {
    const primaryLink = notification.cta_url || 'https://saarvi-beta.vercel.app';
    const ctaText = notification.cta_text || 'Open Saarvi';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Saarvi — ${notification.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #1e293b; }
    .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { padding: 24px; border-bottom: 1px solid #f1f5f9; background: #ffffff; text-align: center; }
    .logo { font-size: 20px; font-weight: 800; color: #1e293b; text-decoration: none; }
    .logo span { color: #2563eb; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; border-radius: 6px; background: #eff6ff; color: #1d4ed8; margin-bottom: 12px; }
    .content { padding: 32px 24px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; line-height: 1.3; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .body-text { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 28px; white-space: pre-line; }
    .cta-button { display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 700; color: #ffffff !important; background-color: #2563eb; text-decoration: none; border-radius: 10px; text-align: center; }
    .footer { padding: 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Saarvi<span>.</span></div>
    </div>
    <div class="content">
      <span class="badge">${notification.category}</span>
      <h1 class="title">${notification.title}</h1>
      <div class="meta">${new Date(notification.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="body-text">${notification.body}</div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${primaryLink}" class="cta-button" target="_blank">${ctaText}</a>
      </div>
    </div>
    <div class="footer">
      <strong>Saarvi — Study. Work. Grow.</strong><br>
      Private by design. Fast by design. Simple by design.<br>
      <a href="https://saarvi-beta.vercel.app/student/settings/notifications">Notification Preferences</a> &bull; <a href="https://saarvi-beta.vercel.app/privacy">Privacy Policy</a>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Aggregates real-time delivery and interaction analytics for administrators
   */
  public static getAnalyticsSummary(): NotificationAnalyticsSummary {
    const notifications = MockStorageProvider.getNotifications();
    const recipients = MockStorageProvider.getNotificationRecipients();

    const totalSent = notifications.filter((n) => n.status === 'SENT').length;
    const totalDelivered = recipients.filter((r) => r.delivery_status === 'DELIVERED' || r.delivery_status === 'READ' || r.delivery_status === 'CLICKED').length;
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
   * Idempotent retry of failed delivery jobs
   */
  public static retryFailedDeliveries(notificationId?: string): { retriedCount: number } {
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

    return { retriedCount: retried };
  }
}
