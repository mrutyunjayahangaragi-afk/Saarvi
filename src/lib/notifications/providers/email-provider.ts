import { DeliveryResult, ReminderEmailMessage } from '@/types/notifications';
import {
  NotificationEmailProvider,
  TransactionalEmailOptions,
  EmailProviderHealth,
} from './email/types';
import { GmailSmtpEmailProvider } from './email/gmail-provider';
import { ResendEmailProvider } from './email/resend-provider';

export * from './email/types';
export { GmailSmtpEmailProvider } from './email/gmail-provider';
export { ResendEmailProvider } from './email/resend-provider';

export interface TransactionalEmailProviderOptions {
  provider?: 'gmail' | 'resend';
  apiKey?: string;
  fromEmail?: string;
  mockDeliveryInTest?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

/**
 * Unified Transactional Email Provider Facade.
 *
 * Automatically delegates to GmailSmtpEmailProvider or ResendEmailProvider
 * based on configuration (EMAIL_PROVIDER env var, SMTP credentials, or explicit options).
 */
export class TransactionalEmailProvider implements NotificationEmailProvider {
  private activeProvider: NotificationEmailProvider;
  private gmailProvider: GmailSmtpEmailProvider;
  private resendProvider: ResendEmailProvider;

  constructor(options?: TransactionalEmailProviderOptions) {
    this.gmailProvider = new GmailSmtpEmailProvider({
      user: options?.smtpUser,
      pass: options?.smtpPass,
      host: options?.smtpHost,
      port: options?.smtpPort,
      secure: options?.smtpSecure,
      fromEmail: options?.fromEmail,
      mockDeliveryInTest: options?.mockDeliveryInTest,
    });

    this.resendProvider = new ResendEmailProvider({
      apiKey: options?.apiKey,
      fromEmail: options?.fromEmail,
      mockDeliveryInTest: options?.mockDeliveryInTest,
    });

    // Provider Selection Strategy
    const configuredProvider = options?.provider || process.env.EMAIL_PROVIDER;

    if (configuredProvider === 'resend') {
      this.activeProvider = this.resendProvider;
    } else if (configuredProvider === 'gmail') {
      this.activeProvider = this.gmailProvider;
    } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Default to Gmail if SMTP credentials present
      this.activeProvider = this.gmailProvider;
    } else if (process.env.RESEND_API_KEY) {
      // Fallback to Resend if RESEND_API_KEY present
      this.activeProvider = this.resendProvider;
    } else {
      // Default to Gmail SMTP
      this.activeProvider = this.gmailProvider;
    }
  }

  public get id(): string {
    return this.activeProvider.id;
  }

  public get name(): string {
    return this.activeProvider.name;
  }

  public getActiveProvider(): NotificationEmailProvider {
    return this.activeProvider;
  }

  public setActiveProvider(provider: 'gmail' | 'resend' | NotificationEmailProvider): void {
    if (typeof provider === 'string') {
      this.activeProvider = provider === 'resend' ? this.resendProvider : this.gmailProvider;
    } else {
      this.activeProvider = provider;
    }
  }

  public isConfigured(): boolean {
    return this.activeProvider.isConfigured();
  }

  public setMockDelivery(enabled: boolean): void {
    if ('setMockDelivery' in this.gmailProvider) {
      this.gmailProvider.setMockDelivery(enabled);
    }
    if ('setMockDelivery' in this.resendProvider) {
      this.resendProvider.setMockDelivery(enabled);
    }
  }

  public async checkHealth(): Promise<EmailProviderHealth> {
    if (this.activeProvider.checkHealth) {
      return this.activeProvider.checkHealth();
    }
    return {
      status: this.isConfigured() ? 'OPERATIONAL' : 'CONFIG_MISSING',
      configured: this.isConfigured(),
      provider: this.name,
      message: this.isConfigured() ? 'Provider operational.' : 'Provider unconfigured.',
    };
  }

  public async sendTransactionalEmail(options: TransactionalEmailOptions): Promise<DeliveryResult> {
    return this.activeProvider.sendTransactionalEmail(options);
  }

  public async sendReminder(message: ReminderEmailMessage): Promise<DeliveryResult> {
    return this.activeProvider.sendReminder(message);
  }
}
