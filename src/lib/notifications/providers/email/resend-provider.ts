import { DeliveryResult, ReminderEmailMessage } from '@/types/notifications';
import {
  NotificationEmailProvider,
  TransactionalEmailOptions,
  EmailProviderHealth,
} from './types';

export interface ResendProviderOptions {
  apiKey?: string;
  fromEmail?: string;
  mockDeliveryInTest?: boolean;
}

export class ResendEmailProvider implements NotificationEmailProvider {
  public readonly id = 'resend';
  public readonly name = 'Resend Transactional API';

  private apiKey: string | undefined;
  private fromEmail: string;
  private mockDeliveryInTest: boolean;

  constructor(options?: ResendProviderOptions) {
    this.apiKey = options?.apiKey ?? process.env.RESEND_API_KEY;
    this.fromEmail = options?.fromEmail ?? process.env.EMAIL_FROM ?? 'Saarvi Planning <reminders@saarvi.in>';
    this.mockDeliveryInTest = options?.mockDeliveryInTest ?? (process.env.NODE_ENV === 'test');
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey) || this.mockDeliveryInTest;
  }

  public setMockDelivery(enabled: boolean): void {
    this.mockDeliveryInTest = enabled;
  }

  public async checkHealth(): Promise<EmailProviderHealth> {
    if (!this.isConfigured()) {
      return {
        status: 'CONFIG_MISSING',
        configured: false,
        provider: this.name,
        message: 'Resend API key missing (RESEND_API_KEY not set).',
      };
    }

    return {
      status: 'OPERATIONAL',
      configured: true,
      provider: this.name,
      message: 'Resend API configured.',
    };
  }

  public async sendTransactionalEmail(options: TransactionalEmailOptions): Promise<DeliveryResult> {
    const timestamp = new Date().toISOString();

    if (!options.to || !options.to.includes('@')) {
      return {
        success: false,
        channel: 'email',
        status: 'FAILED',
        error: 'Invalid recipient email address.',
        timestamp,
      };
    }

    if (this.apiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: [options.to],
            subject: options.subject,
            text: options.text,
            html: options.html,
            headers: options.idempotencyKey
              ? {
                  'X-Entity-Ref-ID': options.idempotencyKey,
                }
              : undefined,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          return {
            success: false,
            channel: 'email',
            status: 'FAILED',
            error: errData?.message || `HTTP ${response.status} failed to dispatch email.`,
            timestamp,
          };
        }

        const data = await response.json();
        return {
          success: true,
          channel: 'email',
          status: 'SENT',
          providerMessageId: data?.id || `email_${Date.now()}`,
          timestamp,
        };
      } catch (err) {
        return {
          success: false,
          channel: 'email',
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'Network error dispatching email.',
          timestamp,
        };
      }
    }

    if (this.mockDeliveryInTest) {
      return {
        success: true,
        channel: 'email',
        status: 'SENT',
        providerMessageId: `mock_resend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp,
      };
    }

    return {
      success: false,
      channel: 'email',
      status: 'NOT_CONFIGURED',
      error: 'Resend API is not configured. RESEND_API_KEY is required.',
      timestamp,
    };
  }

  public async sendReminder(message: ReminderEmailMessage): Promise<DeliveryResult> {
    const sanitizedSubject = message.subject || `Saarvi reminder: ${message.eventTitle}`;
    const sanitizedText =
      message.bodyText ||
      `Your ${message.eventType.replace(/_/g, ' ')} "${message.eventTitle}" is scheduled for ${message.scheduledDate}${
        message.scheduledTime ? ` at ${message.scheduledTime}` : ''
      } (${message.timezone}).\n\nSent by Saarvi Smart Planning.`;

    return this.sendTransactionalEmail({
      to: message.toEmail,
      subject: sanitizedSubject,
      text: sanitizedText,
      idempotencyKey: message.idempotencyKey,
    });
  }
}
