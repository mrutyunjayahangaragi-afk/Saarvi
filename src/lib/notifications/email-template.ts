/**
 * Saarvi Professional Responsive Email Template Engine 4.0
 * Study. Work. Grow.
 */

export interface SaarviEmailOptions {
  title: string;
  subtitle?: string;
  body: string;
  category: string;
  ctaText?: string;
  ctaUrl?: string;
  actionLabel?: string;
  actionUrl?: string;
  recipientEmail?: string;
  recipientName?: string;
}

/**
 * Sanitizes an email subject line against header injection (\r, \n) and excessive length.
 */
export function sanitizeEmailSubject(rawSubject: string): string {
  if (!rawSubject) return 'Saarvi Platform Notification';
  // Strip control characters and line breaks
  const cleaned = rawSubject.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  // Safe truncate to 150 characters
  return cleaned.slice(0, 150) || 'Saarvi Platform Notification';
}

/**
 * Generates an accessible, responsive HTML email string compatible with Outlook, Apple Mail, Gmail.
 */
export function generateSaarviEmailHtml(options: SaarviEmailOptions): string {
  const { title, subtitle, body, category, recipientName } = options;
  const ctaText = options.ctaText || options.actionLabel;
  const ctaUrl = options.ctaUrl || options.actionUrl;
  const safeTitle = escapeHtml(title);
  const safeSubtitle = subtitle ? escapeHtml(subtitle) : '';
  const safeCategory = escapeHtml((category || 'ANNOUNCEMENT').replace(/_/g, ' ').toUpperCase());
  const greeting = recipientName ? `Hello ${escapeHtml(recipientName)},` : 'Hello,';

  // Format body text with paragraphs
  const formattedBody = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #334155;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  // Primary CTA Button block
  let ctaBlock = '';
  if (ctaText && ctaUrl) {
    const safeCtaText = escapeHtml(ctaText);
    const safeCtaUrl = escapeHtml(ctaUrl.startsWith('http') ? ctaUrl : `https://saarvi.in${ctaUrl.startsWith('/') ? '' : '/'}${ctaUrl}`);
    ctaBlock = `
      <div style="margin: 28px 0 24px; text-align: left;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeCtaUrl}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%" stroke="f" fillcolor="#2563eb">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${safeCtaText}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; text-align: center; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
          ${safeCtaText} &rarr;
        </a>
        <!--<![endif]-->
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container-table { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .content-cell { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px 48px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="container-table" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- HEADER -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      Saarvi<span style="color: #60a5fa;">.</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; border-radius: 20px; background-color: rgba(96, 165, 250, 0.15); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.3);">
                      ${safeCategory}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTENT BODY -->
          <tr>
            <td class="content-cell" style="padding: 36px 32px 28px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; line-height: 30px; color: #0f172a;">
                ${safeTitle}
              </h1>
              ${safeSubtitle ? `<p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #64748b;">${safeSubtitle}</p>` : '<div style="margin-bottom: 20px;"></div>'}

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #334155; font-weight: 500;">
                ${greeting}
              </p>

              ${formattedBody}

              ${category === 'FEATURE_UPDATE' && (title.includes('Jobs') || title.includes('Career') || title.includes('Internships')) ? `
                <div style="margin: 24px 0 20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding: 14px 16px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;">
                        <strong style="color: #1e40af; font-size: 13px; letter-spacing: 0.5px;">💼 JOBS</strong>
                        <p style="margin: 4px 0 0; font-size: 13px; line-height: 20px; color: #334155;">
                          Explore relevant employment opportunities that fit your search.
                        </p>
                      </td>
                    </tr>
                    <tr><td style="height: 10px;"></td></tr>
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px;">
                        <strong style="color: #0f766e; font-size: 13px; letter-spacing: 0.5px;">🎓 INTERNSHIPS</strong>
                        <p style="margin: 4px 0 0; font-size: 13px; line-height: 20px; color: #334155;">
                          Discover opportunities for students and early-career applicants.
                        </p>
                      </td>
                    </tr>
                    <tr><td style="height: 10px;"></td></tr>
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px;">
                        <strong style="color: #6d28d9; font-size: 13px; letter-spacing: 0.5px;">⚡ TRAINING</strong>
                        <p style="margin: 4px 0 0; font-size: 13px; line-height: 20px; color: #334155;">
                          Find learning and career-development opportunities.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top: 18px; padding: 12px 16px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px;">
                    <span style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Search by:</span>
                    <span style="font-size: 12px; color: #2563eb; font-weight: 600; margin-left: 6px;">Role &bull; Branch &bull; Domain &bull; Location &bull; Work Mode</span>
                  </div>
                </div>
              ` : ''}

              ${ctaBlock}

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 22px; color: #64748b;">
                Best regards,<br/>
                <strong style="color: #334155;">The Saarvi Team</strong>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #475569;">
                Saarvi &bull; Study. Work. Grow.
              </p>
              <p style="margin: 0 0 12px; font-size: 12px; line-height: 18px; color: #94a3b8;">
                Empowering students, freshers, and professionals with verified career opportunities and smart tools.
              </p>
              <div style="font-size: 11px; color: #94a3b8;">
                <a href="https://saarvi.in/privacy" target="_blank" style="color: #64748b; text-decoration: underline; margin: 0 6px;">Privacy Policy</a> &bull;
                <a href="https://saarvi.in/terms" target="_blank" style="color: #64748b; text-decoration: underline; margin: 0 6px;">Terms of Service</a> &bull;
                <a href="https://saarvi.in/notifications/preferences" target="_blank" style="color: #64748b; text-decoration: underline; margin: 0 6px;">Preferences</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates an accessible plain-text fallback for email clients that do not render HTML.
 */
export function generateSaarviEmailPlainText(options: SaarviEmailOptions): string {
  const { title, subtitle, body } = options;
  const category = options.category || 'ANNOUNCEMENT';
  const ctaText = options.ctaText || options.actionLabel;
  const ctaUrl = options.ctaUrl || options.actionUrl;
  const lines: string[] = [
    `SAARVI [${category.toUpperCase()}]`,
    '========================================',
    title,
  ];

  if (subtitle) {
    lines.push(subtitle);
  }
  lines.push('----------------------------------------');
  if (options.recipientName) {
    lines.push(`Hello ${options.recipientName},`);
    lines.push('');
  }
  lines.push(body);

  if (ctaText && ctaUrl) {
    const fullUrl = ctaUrl.startsWith('http') ? ctaUrl : `https://saarvi.in${ctaUrl.startsWith('/') ? '' : '/'}${ctaUrl}`;
    lines.push('');
    lines.push(`${ctaText}: ${fullUrl}`);
  }

  lines.push('');
  lines.push('========================================');
  lines.push('Saarvi — Study. Work. Grow.');
  lines.push('Manage Preferences: https://saarvi.in/notifications/preferences');

  return lines.join('\n');
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { generateSaarviEmailHtml as buildSaarviEmailHtml };
export { generateSaarviEmailPlainText as buildSaarviEmailPlainText };

