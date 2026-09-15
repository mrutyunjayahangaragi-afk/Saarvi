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
https://saarvi.app`;

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
                  <td>
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">SAARVI</span>
                    <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">Study. Work. Grow.</div>
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
                <a href="https://saarvi.app" style="color: #2563eb; text-decoration: none; font-weight: 600;">Saarvi</a> &mdash; Private by design &bull; Fast by design
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                https://saarvi.app
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
    const displayName = fullName ? fullName.trim() : "Student";
    const subject = "Welcome to Saarvi — Study. Work. Grow.";
    const text = `Hi ${displayName},

Welcome to Saarvi! Your account has been verified and is ready.

Saarvi is built private by design, fast by design, and simple by design:
- Academic Tracker: VTU / engineering semester GPA calculations, CIE & SEE forecasting, and attendance recovery.
- Resume Builder 2.0: Single-column ATS Classic LaTeX format, live A4 preview, clickable PDF links, and job description matcher.
- Mock Interview 2.0: MCQ and live video proctored practice with real company questions.
- Saarvi Copilot: Your private, local-first academic and career companion.

Get started now at: https://saarvi.app/student/dashboard

Saarvi — Private by design • Fast by design • Simple by design
https://saarvi.app`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Saarvi</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.04);" border="0" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9; background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">SAARVI</span>
                    <div style="font-size: 12px; font-weight: 600; color: #2563eb; margin-top: 2px;">Study. Work. Grow.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                Welcome aboard, ${displayName}!
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Your account is confirmed and ready. Saarvi is your private-by-design workspace engineered to accelerate your studies and career journey without compromise.
              </p>

              <!-- Highlights list -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                  What you can do right now:
                </div>
                <div style="font-size: 13px; color: #334155; margin-bottom: 10px; line-height: 1.5;">
                  🎓 <strong>Academic Tracker:</strong> Verified VTU / engineering SGPA/CGPA calculations, CIE & SEE forecasting, and attendance recovery plans.
                </div>
                <div style="font-size: 13px; color: #334155; margin-bottom: 10px; line-height: 1.5;">
                  📄 <strong>Resume Builder 2.0:</strong> Single-column ATS Classic LaTeX format, live preview, clickable links, and job description matcher.
                </div>
                <div style="font-size: 13px; color: #334155; margin-bottom: 10px; line-height: 1.5;">
                  🎙️ <strong>Mock Interview 2.0:</strong> Proctored MCQ tests and live WebRTC video simulations with real company questions.
                </div>
                <div style="font-size: 13px; color: #334155; line-height: 1.5;">
                  🤖 <strong>Saarvi Copilot:</strong> Grounded academic guidance, local-first notes, and zero personal data leakage.
                </div>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0 20px 0;">
                <a href="https://saarvi.app/student/dashboard" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                  Open Student Dashboard &rarr;
                </a>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
                Zero telemetry on documents. All confidential workspace data remains local to your device.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                <a href="https://saarvi.app" style="color: #2563eb; text-decoration: none; font-weight: 600;">Saarvi</a> &mdash; Private by design &bull; Fast by design &bull; Simple by design
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                https://saarvi.app
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
