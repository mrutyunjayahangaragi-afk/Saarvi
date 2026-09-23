import fs from 'fs';
import path from 'path';
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
    const email = this.fromEmail || this.user || 'no-reply@saarvi.in';
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
      const logoPath = path.join(process.cwd(), 'public/brand/saarvi-mark.png');
      const attachments = fs.existsSync(logoPath)
        ? [
            {
              filename: 'saarvi-mark.png',
              path: logoPath,
              cid: 'saarvi-logo-mark',
            },
          ]
        : [];

      const mailOptions: any = {
        from: this.getFromAddress(), // Enforces fixed configured sender address
        to: cleanTo,
        subject: cleanSubject,
        text: options.text || '',
        html: options.html,
        attachments,
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
   * Resolves the production or deployment base URL for emails.
   */
  private getAppBaseUrl(): string {
    const rawUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://saarvi.app');
    return rawUrl.replace(/\/+$/, '');
  }

  /**
   * Resolves the logo source for emails: inline CID if local image exists, otherwise public URL.
   */
  private getLogoSrc(): string {
    const logoPath = path.join(process.cwd(), 'public/brand/saarvi-mark.png');
    if (fs.existsSync(logoPath)) {
      return 'cid:saarvi-logo-mark';
    }
    return `${this.getAppBaseUrl()}/brand/saarvi-mark.png`;
  }

  /**
   * Sends an authentication email verification OTP with professional Saarvi branding.
   * Strictly adheres to Phase 23 guidelines: no marketing fluff, clear 10m expiry, monospace code.
   */
  public async sendAuthVerificationEmail(params: {
    to: string;
    fullName?: string;
    otpCode: string;
    expiryMinutes?: number;
  }): Promise<DeliveryResult> {
    const { to, fullName, otpCode, expiryMinutes = 10 } = params;
    const cleanName = fullName?.trim() ? ` ${fullName.trim()}` : '';
    const subject = 'Verify your Saarvi account';
    const appBaseUrl = this.getAppBaseUrl();
    const logoSrc = this.getLogoSrc();

    const text = `SAARVI
Study. Work. Grow.
------------------------------------------------
Verify your email address

Hello${cleanName},

Use this verification code to continue creating your Saarvi account:

        ${otpCode}

This code expires in ${expiryMinutes} minutes.

If you did not request a Saarvi account, you can ignore this email.

------------------------------------------------
Saarvi
${appBaseUrl}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Saarvi account</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);" border="0" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px; width: 40px;">
                    <img src="${logoSrc}" alt="Saarvi — Study. Work. Grow." width="36" height="36" style="display: block; border: 0; border-radius: 8px;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">SAARVI</span>
                    <div style="font-size: 11px; font-weight: 500; color: #2563eb; margin-top: 2px;">Study. Work. Grow.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                Verify your email address
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                Use this verification code to continue creating your Saarvi account:
              </p>
              <!-- Monospace OTP Box -->
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px 24px; text-align: center; margin: 24px 0;">
                <span style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1d4ed8; display: inline-block;">${otpCode}</span>
              </div>
              <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 500; color: #64748b;">
                This code expires in <strong>${expiryMinutes} minutes</strong>.
              </p>
              <p style="margin: 0 0 0 0; font-size: 12px; color: #94a3b8;">
                If you did not request a Saarvi account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                <a href="${appBaseUrl}" style="color: #2563eb; text-decoration: none; font-weight: 600;">Saarvi</a> &mdash; Private by design &bull; Fast by design
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                ${appBaseUrl}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendTransactionalEmail({
      to,
      subject,
      text,
      html,
    });
  }

  /**
   * Sends a registration success welcome email after user verification.
   * Strictly adheres to Saarvi Production Welcome Email specification.
   */
  public async sendRegistrationSuccessEmail({
    to,
    fullName,
    idempotencyKey,
  }: {
    to: string;
    fullName?: string;
    idempotencyKey?: string;
  }): Promise<DeliveryResult> {
    const rawName = fullName?.trim() || to.split('@')[0] || 'there';
    // Safe HTML escaping
    const safeDisplayName = rawName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const appBaseUrl = this.getAppBaseUrl();
    const logoSrc = this.getLogoSrc();

    const subject = "Welcome to Saarvi — Your account is ready!";
    const text = `Welcome to Saarvi!

Hi ${rawName},

Your Saarvi account has been successfully created.
Welcome to Saarvi — Study. Work. Grow.

Saarvi brings useful tools for study, productivity, documents, career preparation and professional growth together in one place.

What you can do with Saarvi:
- Document & Image Tools: Convert, organize and work with supported files.
- Student Tools: Academic and productivity tools for everyday study.
- Career Tools: Resume, ATS, interview and career preparation tools.
- Mock Interviews: Practice interview questions and improve your preparation.

Open Saarvi: ${appBaseUrl}/dashboard

Privacy by Design:
Saarvi is designed with privacy in mind. Supported tools process files locally in the browser whenever practical, without unnecessary uploads or automatic cloud synchronization.

Saarvi
Study. Work. Grow.
saarvinotifications@gmail.com
${appBaseUrl}

© 2026 Saarvi. All rights reserved.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Saarvi</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    You successfully registered with Saarvi. Study. Work. Grow.
  </div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);" border="0" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; border-bottom: 1px solid #f1f5f9; background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px;">
                    <img src="${logoSrc}" alt="Saarvi — Study. Work. Grow." width="44" height="44" style="display: block; border: 0; border-radius: 10px;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; line-height: 1.1;">Saarvi</div>
                    <div style="font-size: 12px; font-weight: 600; color: #2563eb; margin-top: 2px;">Study. Work. Grow.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.25;">
                Welcome to Saarvi!
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; font-weight: 500;">
                Hi ${safeDisplayName},
              </p>
              <p style="margin: 0 0 14px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Your Saarvi account has been successfully created.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                <strong>Welcome to Saarvi — Study. Work. Grow.</strong><br>
                Saarvi brings useful tools for study, productivity, documents, career preparation and professional growth together in one place.
              </p>

              <!-- Feature Section -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <div style="font-size: 13px; font-weight: 700; color: #0f172a;">📄 Document &amp; Image Tools</div>
                      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Convert, organize and work with supported files.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <div style="font-size: 13px; font-weight: 700; color: #0f172a;">🎓 Student Tools</div>
                      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Academic and productivity tools for everyday study.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <div style="font-size: 13px; font-weight: 700; color: #0f172a;">💼 Career Tools</div>
                      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Resume, ATS, interview and career preparation tools.</div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div style="font-size: 13px; font-weight: 700; color: #0f172a;">🎙️ Mock Interviews</div>
                      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Practice interview questions and improve your preparation.</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Primary CTA -->
              <div style="text-align: center; margin: 32px 0 24px 0;">
                <a href="${appBaseUrl}/dashboard" style="background-color: #2563eb; color: #ffffff; padding: 14px 36px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">
                  Open Saarvi &rarr;
                </a>
              </div>

              <!-- Privacy Section -->
              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                  🔒 Privacy by Design
                </div>
                <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
                  Saarvi is designed with privacy in mind. Supported tools process files locally in the browser whenever practical, without unnecessary uploads or automatic cloud synchronization.
                </div>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <div style="font-size: 12px; font-weight: 700; color: #0f172a;">Saarvi</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Study. Work. Grow.</div>
              <div style="margin: 10px 0; font-size: 11px; color: #64748b;">
                <a href="mailto:saarvinotifications@gmail.com" style="color: #2563eb; text-decoration: none;">saarvinotifications@gmail.com</a> &bull; 
                <a href="${appBaseUrl}" style="color: #2563eb; text-decoration: none;">${appBaseUrl}</a>
              </div>
              <div style="font-size: 11px; color: #94a3b8;">
                &copy; 2026 Saarvi. All rights reserved.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendTransactionalEmail({
      to,
      subject,
      text,
      html,
      idempotencyKey,
    });
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
