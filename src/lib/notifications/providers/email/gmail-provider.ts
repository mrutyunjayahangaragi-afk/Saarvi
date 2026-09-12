import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { DeliveryResult, ReminderEmailMessage } from '@/types/notifications';
import {
  NotificationEmailProvider,
  TransactionalEmailOptions,
  EmailProviderHealth,
} from './types';

export interface GmailProviderOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromEmail?: string;
  fromName?: string;
  transporter?: Transporter;
  mockDeliveryInTest?: boolean;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export class GmailSmtpEmailProvider implements NotificationEmailProvider {
  public readonly id = 'gmail';
  public readonly name = 'Gmail SMTP';

  private host: string;
  private port: number;
  private secure: boolean;
  private user: string | undefined;
  private pass: string | undefined;
  private fromEmail: string | undefined;
  private fromName: string;
  private transporter: Transporter | null = null;
  private mockDeliveryInTest: boolean;

  constructor(options?: GmailProviderOptions) {
    this.host = options?.host ?? process.env.SMTP_HOST ?? 'smtp.gmail.com';
    this.port = options?.port ?? (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465);
    this.secure =
      options?.secure ??
      (process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : this.port === 465);
    this.user = options?.user ?? process.env.SMTP_USER;
    this.pass = options?.pass ?? process.env.SMTP_PASS;
    this.fromEmail = options?.fromEmail ?? process.env.EMAIL_FROM_EMAIL ?? this.user;
    this.fromName = options?.fromName ?? process.env.EMAIL_FROM_NAME ?? 'Saarvi';
    this.mockDeliveryInTest = options?.mockDeliveryInTest ?? false;

    if (options?.transporter) {
      this.transporter = options.transporter;
    }
  }

  public isConfigured(): boolean {
    if (this.transporter && !this.mockDeliveryInTest) {
      return true;
    }
    return Boolean(this.user && this.pass);
  }

  public setMockDelivery(enabled: boolean): void {
    this.mockDeliveryInTest = enabled;
  }

  public setTransporter(transporter: Transporter | null): void {
    this.transporter = transporter;
  }

  public getFromAddress(): string {
    const email = this.fromEmail || this.user || 'no-reply@saarvi.app';
    const cleanEmail = email.replace(/[\r\n]/g, '').trim();
    const cleanName = this.fromName.replace(/[\r\n]/g, '').trim();
    return `"${cleanName}" <${cleanEmail}>`;
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    if (!this.user || !this.pass) {
      throw new Error('Gmail SMTP credentials missing. SMTP_USER and SMTP_PASS are required.');
    }

    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.user,
        pass: this.pass,
      },
      tls: {
        // Enforce safe TLS defaults
        rejectUnauthorized: true,
      },
    });

    return this.transporter;
  }

  /**
   * Safe server-side connection health verification.
   * Never exposes credentials or internal stack traces.
   */
  public async checkHealth(): Promise<EmailProviderHealth> {
    if (!this.isConfigured()) {
      return {
        status: 'CONFIG_MISSING',
        configured: false,
        provider: this.name,
        host: this.host,
        port: this.port,
        message: 'Gmail SMTP credentials missing. Please set SMTP_USER and SMTP_PASS in server environment.',
      };
    }

    try {
      const transporter = this.getTransporter();
      if (typeof transporter.verify === 'function') {
        await transporter.verify();
      }
      return {
        status: 'OPERATIONAL',
        configured: true,
        provider: this.name,
        host: this.host,
        port: this.port,
        message: 'Gmail SMTP server connection verified and operational.',
      };
    } catch (err) {
      const sanitized = this.sanitizeErrorMessage(err);
      return {
        status: 'CONNECTION_FAILURE',
        configured: true,
        provider: this.name,
        host: this.host,
        port: this.port,
        message: sanitized,
      };
    }
  }

  /**
   * Sends a transactional email using Gmail SMTP.
   */
  public async sendTransactionalEmail(options: TransactionalEmailOptions): Promise<DeliveryResult> {
    const timestamp = new Date().toISOString();

    // 1. Recipient Validation & CRLF Injection Defense
    if (!options.to || typeof options.to !== 'string') {
      return {
        success: false,
        channel: 'email',
        status: 'FAILED',
        error: 'Invalid recipient email address.',
        timestamp,
      };
    }

    // Disallow carriage return or newline characters (Header Injection Prevention)
    if (/[\r\n]/.test(options.to)) {
      return {
        success: false,
        channel: 'email',
        status: 'FAILED',
        error: 'Invalid recipient email format: carriage return or newline detected.',
        timestamp,
      };
    }

    const cleanTo = options.to.trim();
    if (!EMAIL_REGEX.test(cleanTo)) {
      return {
        success: false,
        channel: 'email',
        status: 'FAILED',
        error: 'Invalid recipient email address format.',
        timestamp,
      };
    }

    // 2. Subject Header Injection Defense
    if (options.subject && /[\r\n]/.test(options.subject)) {
      return {
        success: false,
        channel: 'email',
        status: 'FAILED',
        error: 'Invalid email subject: carriage return or newline detected.',
        timestamp,
      };
    }

    const cleanSubject = (options.subject || 'Notification from Saarvi').trim();

    // 3. Configuration Check
    if (!this.isConfigured()) {
      if (this.mockDeliveryInTest) {
        return {
          success: true,
          channel: 'email',
          status: 'SENT',
          providerMessageId: `mock_gmail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp,
        };
      }

      return {
        success: false,
        channel: 'email',
        status: 'NOT_CONFIGURED',
        error: 'Gmail SMTP is not configured. Missing SMTP_USER or SMTP_PASS.',
        timestamp,
      };
    }

    // 4. Dispatch Email via Transporter
    try {
      const transporter = this.getTransporter();
      const mailOptions = {
        from: this.getFromAddress(), // Enforces fixed configured sender address
        to: cleanTo,
        subject: cleanSubject,
        text: options.text || '',
        html: options.html,
        headers: options.idempotencyKey
          ? {
              'X-Entity-Ref-ID': options.idempotencyKey,
            }
          : undefined,
      };

      const info = await transporter.sendMail(mailOptions);

      if (!info || (!info.messageId && !info.accepted)) {
        return {
          success: false,
          channel: 'email',
          status: 'FAILED',
          error: 'SMTP server did not accept message delivery.',
          timestamp,
        };
      }

      return {
        success: true,
        channel: 'email',
        status: 'SENT',
        providerMessageId: info.messageId || `gmail_${Date.now()}`,
        timestamp,
      };
    } catch (err) {
      const sanitized = this.sanitizeErrorMessage(err);
      return {
        success: false,
        channel: 'email',
        status: 'FAILED',
        error: sanitized,
        timestamp,
      };
    }
  }

  /**
   * Sends an academic / planning reminder email.
   */
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

  /**
   * Sanitizes error message to guarantee credentials (e.g. SMTP_PASS) never leak.
   */
  private sanitizeErrorMessage(err: unknown): string {
    if (!err) return 'Unknown SMTP error.';
    const raw = err instanceof Error ? err.message : String(err);

    // Redact password if present in raw error string
    let sanitized = raw;
    if (this.pass) {
      sanitized = sanitized.split(this.pass).join('[REDACTED]');
    }
    if (this.user) {
      sanitized = sanitized.split(this.user).join('[USER]');
    }

    // Generic credential / token pattern redaction
    sanitized = sanitized
      .replace(/password\s*[:=]\s*[^\s,;]+/gi, 'password=[REDACTED]')
      .replace(/auth\s*[:=]\s*[^\s,;]+/gi, 'auth=[REDACTED]')
      .replace(/key\s*[:=]\s*[^\s,;]+/gi, 'key=[REDACTED]');

    return sanitized || 'SMTP transmission failure.';
  }
}
