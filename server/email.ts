import { Resend } from "resend";
import type { GetEmailResponseSuccess, ListEmail } from "resend";
import { pool } from "./db";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const resend = new Resend(
  IS_PRODUCTION ? process.env.RESEND_API_KEY_PROD : process.env.RESEND_API_KEY
);

const FROM_EMAIL = IS_PRODUCTION ? "noreply@guardiangroup.ai" : "onboarding@resend.dev";
const FROM_NAME = "Guardian Group";

const DEV_EMAIL_OVERRIDE = "mark@guardiangroup.co.uk";
const CLIENT_FORWARD_EMAIL = "mark@guardiangroup.co.uk";

// ─── Email settings cache ─────────────────────────────────────────────────────
// Loaded from the email_settings DB table; refreshed every 60 s so UI changes
// take effect quickly without hitting the DB on every outbound email.

type CachedSettings = {
  sendAll: boolean;
  allowedRoles: string[];
  allowedEmails: string[];
  allowedDomains: string[];
  catchAllAddress: string | null;
} | null;

let _settingsCache: CachedSettings = undefined as any; // undefined = never loaded
let _settingsCacheAt = 0;
const SETTINGS_CACHE_TTL = 60_000;

async function loadEmailSettings(): Promise<CachedSettings> {
  try {
    const now = Date.now();
    if (_settingsCache !== undefined && now - _settingsCacheAt < SETTINGS_CACHE_TTL) {
      return _settingsCache;
    }
    const res = await pool.query<{
      send_all: boolean;
      allowed_roles: string[] | null;
      allowed_emails: string[] | null;
      allowed_domains: string[] | null;
      catch_all_address: string | null;
    }>("SELECT send_all, allowed_roles, allowed_emails, allowed_domains, catch_all_address FROM email_settings LIMIT 1");
    const row = res.rows[0];
    _settingsCache = row ? {
      sendAll: row.send_all,
      allowedRoles: row.allowed_roles ?? [],
      allowedEmails: row.allowed_emails ?? [],
      allowedDomains: row.allowed_domains ?? [],
      catchAllAddress: row.catch_all_address,
    } : null;
    _settingsCacheAt = now;
    return _settingsCache;
  } catch {
    return null; // fallback to legacy hardcoded behaviour
  }
}

/** Call this after saving email settings so the next email uses fresh settings. */
export function invalidateEmailSettingsCache() {
  _settingsCache = undefined as any;
  _settingsCacheAt = 0;
}

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function resolveRecipient(to: string, role?: string): Promise<string> {
  const settings = await loadEmailSettings();

  if (settings) {
    // Send-all mode: real email for everyone
    if (settings.sendAll) return to;

    const toLC = to.toLowerCase();

    // Role allow-list
    if (role && settings.allowedRoles.includes(role)) return to;

    // Email address allow-list
    if (settings.allowedEmails.some(e => e.toLowerCase() === toLC)) return to;

    // Domain allow-list (stored with or without leading @)
    const domain = toLC.split("@")[1];
    if (domain && settings.allowedDomains.some(d => d.toLowerCase().replace(/^@/, "") === domain)) return to;

    // Catch-all fallback
    const fallback = settings.catchAllAddress || DEV_EMAIL_OVERRIDE;
    console.log(`[EMAIL ROUTING] ${to} (role: ${role ?? "none"}) → redirected to ${fallback}`);
    return fallback;
  }

  // No settings row — use legacy hardcoded behaviour
  if (!IS_PRODUCTION) {
    console.log(`[DEV MODE] Redirecting email from ${to} to ${DEV_EMAIL_OVERRIDE}`);
    return DEV_EMAIL_OVERRIDE;
  }
  if (role === "consultant" || role === "developer") {
    return to;
  }
  console.log(`[PROD] Client email from ${to} forwarded to ${CLIENT_FORWARD_EMAIL}`);
  return CLIENT_FORWARD_EMAIL;
}

// ---------------------------------------------------------------------------
// Email logo
// Place your logo file at:  client/public/email-assets/logo.png
// (PNG, JPG or SVG — any format browsers can display inline)
// The file is served as a static asset and embedded in every outgoing email.
// ---------------------------------------------------------------------------
const APP_BASE_URL = process.env.APP_BASE_URL ||
  (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : "");
const LOGO_URL = APP_BASE_URL
  ? `${APP_BASE_URL}/email-assets/logo.jpg`
  : "https://guardiangroup.co.uk/wp-content/uploads/2021/04/Guardian-Group-Logo-Retina.png";

export async function sendInvitationEmail({
  to,
  fullName,
  inviteUrl,
  expiresAt,
  role,
}: {
  to: string;
  fullName: string;
  inviteUrl: string;
  expiresAt: Date;
  role?: string;
}) {
  const expiryText = `${Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))} hours`;
  const recipient = await resolveRecipient(to, role);

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: "You've been invited to Guardian Group Compliance Portal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px;">Welcome, ${escHtml(fullName)}!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            You have been invited to join the Guardian Group Compliance Portal. 
            Please click the button below to set up your password and activate your account.
          </p>
          
          <div style="text-align: center; padding: 24px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px; 
                      text-decoration: none; border-radius: 6px; font-size: 16px; 
                      font-weight: 600; display: inline-block;">
              Set Up Your Account
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            This invitation link will expire in <strong>${expiryText}</strong>. 
            If the button doesn't work, copy and paste the following URL into your browser:
          </p>
          <p style="color: #1e40af; font-size: 13px; word-break: break-all;">
            ${inviteUrl}
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group. 
            If you did not expect this invitation, please ignore this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }

  console.log(`Invitation email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

export async function sendPasswordResetEmail({
  to,
  fullName,
  resetUrl,
  expiresAt,
  role,
}: {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresAt: Date;
  role?: string;
}) {
  const expiryText = `${Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))} hour(s)`;
  const recipient = await resolveRecipient(to, role);

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: "Reset Your Password - Guardian Group Compliance Portal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)}, we received a request to reset your password. 
            Click the button below to choose a new password.
          </p>
          
          <div style="text-align: center; padding: 24px 0;">
            <a href="${resetUrl}" 
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px; 
                      text-decoration: none; border-radius: 6px; font-size: 16px; 
                      font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            This link will expire in <strong>${expiryText}</strong>. 
            If the button doesn't work, copy and paste the following URL into your browser:
          </p>
          <p style="color: #1e40af; font-size: 13px; word-break: break-all;">
            ${resetUrl}
          </p>
          
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin-top: 20px;">
            <p style="color: #92400e; font-size: 13px; margin: 0;">
              If you did not request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
          </div>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group. 
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }

  console.log(`Password reset email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

export async function sendDocumentApprovalEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  uploadedBy,
  portalUrl,
  documentUrl,
  role,
  changeNote,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  uploadedBy: string;
  portalUrl: string;
  documentUrl: string;
  role?: string;
  changeNote?: string | null;
}) {
  const recipient = await resolveRecipient(to, role);

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: `Document Requires Your Approval - ${documentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px;">Document Approval Required</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)}, a new document has been uploaded that requires your review and approval.
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(documentTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Uploaded by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(uploadedBy)}</td>
              </tr>
            </table>
          </div>

          ${changeNote && changeNote.trim() ? `
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; color: #92400e; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;">Comment from ${escHtml(uploadedBy)}</p>
            <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escHtml(changeNote.trim())}</p>
          </div>
          ` : ''}
          
          <div style="text-align: center; padding: 24px 0;">
            <a href="${documentUrl}?email=${encodeURIComponent(to)}" 
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px; 
                      text-decoration: none; border-radius: 6px; font-size: 16px; 
                      font-weight: 600; display: inline-block;">
              Review Document
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Please log in to the portal to review and approve this document.
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group. 
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send document approval email:", error);
    throw new Error(`Failed to send document approval email: ${error.message}`);
  }

  console.log(`Document approval email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

export async function sendDocumentApprovedEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  isMandatory,
  documentUrl,
  approvedBy,
  comments,
  role,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  isMandatory: boolean;
  documentUrl: string;
  approvedBy: string;
  comments?: string | null;
  role?: string;
}) {
  const recipient = await resolveRecipient(to, role);

  const subject = isMandatory
    ? `Document Now Compliant — ${documentTitle}`
    : `Document Approved — ${documentTitle}`;

  const headingText = isMandatory
    ? "Your Document is Now Compliant"
    : "Your Document Has Been Approved";

  const bodyText = isMandatory
    ? `Great news! <strong>${escHtml(documentTitle)}</strong> has been approved and your compliance requirement for this document has been fulfilled. Your site is one step closer to full compliance.`
    : `Great news! <strong>${escHtml(documentTitle)}</strong> has been reviewed and approved by your consultant. No further action is needed for this document at this time.`;

  const statusLabel = isMandatory ? "Compliant" : "Approved";
  const statusColour = "#16a34a";

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
        </div>

        <div style="padding: 30px 0;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #dcfce7; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; text-align: center;">✓</div>
          </div>

          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">${headingText}</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)},
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            ${bodyText}
          </p>

          ${comments ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #475569; font-size: 13px; font-weight: 600; margin: 0 0 6px 0;">Consultant comment:</p>
            <p style="color: #1e293b; font-size: 14px; margin: 0; line-height: 1.6;">${escHtml(comments)}</p>
          </div>` : ''}

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(documentTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Approved by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(approvedBy)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Status:</td>
                <td style="padding: 6px 0; color: ${statusColour}; font-size: 14px; font-weight: 600;">${statusLabel}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; padding: 24px 0;">
            <a href="${documentUrl}"
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;
                      font-weight: 600; display: inline-block;">
              View Document
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group.
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send document approved email:", error);
    throw new Error(`Failed to send document approved email: ${error.message}`);
  }

  console.log(`Document approved email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

export async function sendClientSignOffEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  clientName,
  documentUrl,
  noConsultantAssigned,
  comments,
  role,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  clientName: string;
  documentUrl: string;
  noConsultantAssigned?: boolean;
  comments?: string | null;
  role?: string;
}) {
  const recipient = await resolveRecipient(to, role);

  const noConsultantWarning = noConsultantAssigned ? `
          <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
              No Consultant Assigned
            </p>
            <p style="color: #b91c1c; font-size: 13px; margin: 8px 0 0 0; line-height: 1.5;">
              There is currently no consultant assigned to this site. Please assign a consultant to the site or action this document directly.
            </p>
          </div>` : '';

  const subjectPrefix = noConsultantAssigned ? 'Action Required: ' : '';

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: `${subjectPrefix}Client Sign-Off Complete - ${documentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px;">Client Sign-Off Complete</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)}, a document has been signed off by the client and is now awaiting final approval.
          </p>
          ${noConsultantWarning}
          ${comments ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #475569; font-size: 13px; font-weight: 600; margin: 0 0 6px 0;">Client comment:</p>
            <p style="color: #1e293b; font-size: 14px; margin: 0; line-height: 1.6;">${escHtml(comments)}</p>
          </div>` : ''}
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(documentTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Signed off by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(clientName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Status:</td>
                <td style="padding: 6px 0; color: #f59e0b; font-size: 14px; font-weight: 600;">Awaiting Final Approval</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; padding: 24px 0;">
            <a href="${documentUrl}?email=${encodeURIComponent(to)}" 
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px; 
                      text-decoration: none; border-radius: 6px; font-size: 16px; 
                      font-weight: 600; display: inline-block;">
              Review & Approve
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Please log in to the portal to review and give your final approval on this document.
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group. 
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send client sign-off email:", error);
    throw new Error(`Failed to send client sign-off email: ${error.message}`);
  }

  console.log(`Client sign-off email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Sign-Off Admin Notice (sent to the admin who initiated an on-behalf upload).
// Admins cannot give final approval, so this is an FYI: the client has signed
// off and the document is now with the consultant for their final approval.
// ---------------------------------------------------------------------------
export async function sendSignOffAdminNoticeEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  clientName,
  consultantName,
  documentUrl,
  comments,
  role,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  clientName: string;
  consultantName: string;
  documentUrl: string;
  comments?: string | null;
  role?: string;
}) {
  const recipient = await resolveRecipient(to, role);

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: `Client Sign-Off Complete - ${documentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px;">Client Sign-Off Complete</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)}, a document you uploaded has been signed off by the client and is now with ${escHtml(consultantName)} for their final approval. No action is required from you.
          </p>
          ${comments ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #475569; font-size: 13px; font-weight: 600; margin: 0 0 6px 0;">Client comment:</p>
            <p style="color: #1e293b; font-size: 14px; margin: 0; line-height: 1.6;">${escHtml(comments)}</p>
          </div>` : ''}
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 140px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(documentTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Signed off by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(clientName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Now with:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(consultantName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Status:</td>
                <td style="padding: 6px 0; color: #f59e0b; font-size: 14px; font-weight: 600;">Awaiting Consultant Approval</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group. 
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send sign-off admin notice email:", error);
    throw new Error(`Failed to send sign-off admin notice email: ${error.message}`);
  }

  console.log(`Sign-off admin notice email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Auto-Approved Notification (sent to consultant/admin when a document
// is automatically approved on client sign-off)
// ---------------------------------------------------------------------------
export async function sendAutoApprovedNotificationEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  clientName,
  documentUrl,
  comments,
  role,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  clientName: string;
  documentUrl: string;
  comments?: string | null;
  role?: string;
}) {
  const recipient = await resolveRecipient(to, role || "consultant");

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: `Document Auto-Approved — ${documentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health &amp; Safety Compliance Portal</p>
        </div>

        <div style="padding: 30px 0;">
          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px;">
            <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0;">No action required — this document has been automatically approved.</p>
          </div>

          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Document Auto-Approved</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)}, a document has been automatically approved after the client signed off. This document was configured to skip the manual consultant final-approval step.
          </p>

          ${comments ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #475569; font-size: 13px; font-weight: 600; margin: 0 0 6px 0;">Client comment:</p>
            <p style="color: #1e293b; font-size: 14px; margin: 0; line-height: 1.6;">${escHtml(comments)}</p>
          </div>` : ''}

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 130px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(documentTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Approved by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(clientName)} (client sign-off)</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Status:</td>
                <td style="padding: 6px 0; color: #16a34a; font-size: 14px; font-weight: 600;">Approved</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; padding: 24px 0;">
            <a href="${documentUrl}"
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;
                      font-weight: 600; display: inline-block;">
              View Document
            </a>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            You can view this document in the portal at any time. No further action is needed from you.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group.
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send auto-approved notification email:", error);
    throw new Error(`Failed to send auto-approved notification email: ${error.message}`);
  }

  console.log(`Auto-approved notification email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Cloud Upload Notification (sent when a file is uploaded to a shared folder)
// ---------------------------------------------------------------------------
export async function sendCloudUploadNotificationEmail({
  to,
  fullName,
  uploaderName,
  folderName,
  siteName,
  fileName,
  portalUrl,
  role,
  isNewFolder = false,
}: {
  to: string;
  fullName: string;
  uploaderName: string;
  folderName: string;
  siteName: string;
  fileName?: string;
  portalUrl: string;
  role?: string;
  isNewFolder?: boolean;
}) {
  const recipient = await resolveRecipient(to, role);
  const isClientUploader = role === "consultant" || role === "developer";

  const subject = isNewFolder
    ? `New Shared Folder — ${folderName}`
    : `New File Uploaded — ${folderName}`;

  const heading = isNewFolder
    ? "A new shared folder has been created for you"
    : isClientUploader
      ? "A client has uploaded a file to your shared folder"
      : "A new file has been uploaded to your shared folder";

  const body = isNewFolder
    ? `<strong>${escHtml(uploaderName)}</strong> has created a new shared folder <strong>${escHtml(folderName)}</strong> for you. Please log in to view it and upload any requested documents.`
    : isClientUploader
      ? `<strong>${escHtml(uploaderName)}</strong> (client) has uploaded a file to the folder <strong>${escHtml(folderName)}</strong>. Please log in to review it.`
      : `<strong>${escHtml(uploaderName)}</strong> has uploaded a new file to the folder <strong>${escHtml(folderName)}</strong>. Please log in to view it.`;

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health &amp; Safety Compliance Portal</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">${heading}</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)},
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            ${body}
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              ${!isNewFolder && fileName ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">File:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(fileName)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Folder:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(folderName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">${isNewFolder ? "Created by:" : "Uploaded by:"}</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(uploaderName)}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; padding: 24px 0;">
            <a href="${portalUrl}"
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;
                      font-weight: 600; display: inline-block;">
              View Shared Folder
            </a>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Note: to avoid excessive notifications, you will only receive one email per site per hour for cloud share uploads.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group.
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send cloud upload notification email:", error);
    throw new Error(`Failed to send cloud upload notification email: ${error.message}`);
  }

  console.log(`Cloud upload notification email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

// ---------------------------------------------------------------------------
// iShare Notification (consultant-to-consultant file transfer)
// ---------------------------------------------------------------------------
export async function sendIShareNotificationEmail({
  to,
  fullName,
  senderName,
  folderName,
  fileName,
  portalUrl,
  role,
  isNewFolder = false,
}: {
  to: string;
  fullName: string;
  senderName: string;
  folderName: string;
  fileName?: string;
  portalUrl: string;
  role?: string;
  isNewFolder?: boolean;
}) {
  const recipient = await resolveRecipient(to, role);

  const subject = isNewFolder
    ? `New iShare Folder — ${folderName}`
    : `New File on iShare — ${folderName}`;

  const heading = isNewFolder
    ? "A colleague has shared a new iShare folder with you"
    : "A new file has been added to a shared iShare folder";

  const body = isNewFolder
    ? `<strong>${escHtml(senderName)}</strong> has shared a new iShare folder <strong>${escHtml(folderName)}</strong> with you. Please log in to view it.`
    : `<strong>${escHtml(senderName)}</strong> has added a new file to the iShare folder <strong>${escHtml(folderName)}</strong>. Please log in to view it.`;

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health &amp; Safety Compliance Portal</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">${heading}</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)},
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            ${body}
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              ${!isNewFolder && fileName ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">File:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(fileName)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Folder:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(folderName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">${isNewFolder ? "Shared by:" : "Uploaded by:"}</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(senderName)}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; padding: 24px 0;">
            <a href="${portalUrl}"
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;
                      font-weight: 600; display: inline-block;">
              View iShare Folder
            </a>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Note: to avoid excessive notifications, you will only receive one email per folder per hour for iShare uploads.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group.
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send iShare notification email:", error);
    throw new Error(`Failed to send iShare notification email: ${error.message}`);
  }

  console.log(`iShare notification email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Changes Requested Notification
// ---------------------------------------------------------------------------
export async function sendChangesRequestedEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  requestedBy,
  comments,
  documentUrl,
  role,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  requestedBy: string;
  comments?: string | null;
  documentUrl: string;
  role?: string;
}) {
  const recipient = await resolveRecipient(to, role);

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: `Changes Required — ${documentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health &amp; Safety Compliance Portal</p>
        </div>

        <div style="padding: 30px 0;">
          <div style="background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px;">
            <p style="color: #9a3412; font-size: 14px; font-weight: 600; margin: 0;">Action required — changes have been requested on this document.</p>
          </div>

          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Changes Requested</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)}, changes have been requested on the following document. Please review the feedback and update accordingly.
          </p>

          ${comments ? `
          <div style="background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #9a3412; font-size: 13px; font-weight: 600; margin: 0 0 6px 0;">Feedback from ${escHtml(requestedBy)}:</p>
            <p style="color: #1e293b; font-size: 14px; margin: 0; line-height: 1.6;">${escHtml(comments)}</p>
          </div>` : ''}

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 130px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(documentTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Requested by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(requestedBy)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Status:</td>
                <td style="padding: 6px 0; color: #ea580c; font-size: 14px; font-weight: 600;">Changes Required</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; padding: 24px 0;">
            <a href="${documentUrl}"
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;
                      font-weight: 600; display: inline-block;">
              View Document
            </a>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Please log in to the portal to review the feedback and make the necessary changes.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group.
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send changes-requested email:", error);
    throw new Error(`Failed to send changes-requested email: ${error.message}`);
  }

  console.log(`Changes-requested email sent to ${to} (delivered to ${recipient}), id: ${data?.id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Resend Email Log helpers (used by Admin Reports)
// ---------------------------------------------------------------------------

export interface ResendEmailSummary {
  id: string;
  to: string[];
  fromAddress: string;
  subject: string;
  status: string;
  sentAt: string;
  lastEventAt: string | null;
}

export interface ResendEmailDetail extends ResendEmailSummary {
  replyTo: string[] | null;
  bcc: string[] | null;
  cc: string[] | null;
  events: { name: string; createdAt: string; reason?: string }[];
  errorReason?: string | null;
}

// Type guard helpers for safely accessing undocumented Resend API fields
function getString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function getStringOrFallback(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function getStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((i): i is string => typeof i === "string");
  return typeof v === "string" && v.length > 0 ? [v] : [];
}

function isRecordLike(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Read an undocumented field from a Resend API object.
 * We use `as unknown as Record<string, unknown>` specifically to access fields
 * that Resend returns but does not declare in their TypeScript definitions
 * (e.g. `last_event_at`, `events`). All values are accessed as `unknown`
 * and narrowed with type guards before use.
 */
function undoc(obj: GetEmailResponseSuccess | ListEmail, key: string): unknown {
  return (obj as unknown as Record<string, unknown>)[key];
}

/** Extract event reason from a Resend event data payload (undocumented, varies). */
function extractEventReason(rawEvent: Record<string, unknown>): string | null {
  const data = rawEvent["data"];
  if (isRecordLike(data)) {
    const bounce = data["bounce"];
    if (isRecordLike(bounce)) {
      const msg = getString(bounce["message"]);
      if (msg) return msg;
    }
    const reasonInData = getString(data["reason"]);
    if (reasonInData) return reasonInData;
    const errObj = data["error"];
    if (isRecordLike(errObj)) {
      const errMsg = getString(errObj["message"]);
      if (errMsg) return errMsg;
    }
  }
  const topReason = getString(rawEvent["reason"]);
  if (topReason) return topReason;
  const topError = rawEvent["error"];
  if (typeof topError === "string") return topError;
  return null;
}

export function getResendEnvironment(): "production" | "development" {
  return IS_PRODUCTION ? "production" : "development";
}

export async function listResendEmails({
  limit = 100,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}): Promise<{ data: ResendEmailSummary[]; error: string | null }> {
  try {
    const result = await resend.emails.list({ limit, offset });
    if (result.error) {
      return { data: [], error: result.error.message };
    }
    const emails: ListEmail[] = result.data?.data ?? [];
    const mapped: ResendEmailSummary[] = emails.map((e) => {
      const lastEventAt = undoc(e, "last_event_at");
      return {
        id: e.id,
        to: getStringArray(e.to),
        fromAddress: getStringOrFallback(e.from, ""),
        subject: getStringOrFallback(e.subject, "(no subject)"),
        status: getStringOrFallback(e.last_event, "unknown"),
        sentAt: getStringOrFallback(e.created_at, ""),
        lastEventAt: getString(lastEventAt) ?? getString(e.created_at),
      };
    });
    return { data: mapped, error: null };
  } catch (err: unknown) {
    return { data: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getResendEmail(id: string): Promise<{ data: ResendEmailDetail | null; error: string | null }> {
  try {
    const result = await resend.emails.get(id);
    if (result.error) {
      return { data: null, error: result.error.message };
    }
    const e = result.data;
    if (!e) return { data: null, error: "Email not found" };

    // `events` is returned by the Resend API but not in its official TS types
    const rawEvents = undoc(e, "events");
    const eventsInput = Array.isArray(rawEvents) ? rawEvents : [];

    const events: { name: string; createdAt: string; reason?: string }[] = eventsInput
      .filter(isRecordLike)
      .map((ev) => {
        const name = getStringOrFallback(ev["name"] ?? ev["type"], "unknown");
        const createdAt = getStringOrFallback(ev["created_at"] ?? ev["timestamp"], "");
        const reason = extractEventReason(ev);
        const eventEntry: { name: string; createdAt: string; reason?: string } = { name, createdAt };
        if (reason) eventEntry.reason = reason;
        return eventEntry;
      });

    // Surface the first bounce/complaint reason at the top level for easy display
    const failedEvent = events.find((ev) => {
      const n = ev.name.toLowerCase().replace(/^email_/, "");
      return (n === "bounced" || n === "complained") && ev.reason;
    });

    // `last_event_at` is undocumented — access via the same helper
    const lastEventAt = getString(undoc(e, "last_event_at")) ?? getString(e.created_at);

    const detail: ResendEmailDetail = {
      id: e.id,
      to: getStringArray(e.to),
      fromAddress: getStringOrFallback(e.from, ""),
      subject: getStringOrFallback(e.subject, "(no subject)"),
      status: getStringOrFallback(e.last_event, "unknown"),
      sentAt: getStringOrFallback(e.created_at, ""),
      lastEventAt,
      replyTo: Array.isArray(e.reply_to) ? e.reply_to : null,
      bcc: Array.isArray(e.bcc) ? e.bcc : null,
      cc: Array.isArray(e.cc) ? e.cc : null,
      events,
      errorReason: failedEvent?.reason ?? null,
    };
    return { data: detail, error: null };
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function sendIncidentNotificationEmail({
  to,
  fullName,
  companyName,
  siteName,
  incidentReference,
  incidentType,
  severity,
  incidentDate,
  portalUrl,
  role,
}: {
  to: string;
  fullName: string;
  companyName: string;
  siteName: string;
  incidentReference: string;
  incidentType: string;
  severity: string;
  incidentDate: Date;
  portalUrl: string;
  role?: string;
}) {
  const recipient = await resolveRecipient(to, role);

  const severityColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    critical:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", label: "Critical" },
    major:      { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412", label: "Major" },
    serious:    { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412", label: "Serious" },
    moderate:   { bg: "#fefce8", border: "#fde047", text: "#854d0e", label: "Moderate" },
    minor:      { bg: "#f0fdf4", border: "#86efac", text: "#166534", label: "Minor" },
    near_miss:  { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", label: "Near Miss" },
  };
  const sev = severityColors[severity.toLowerCase()] ?? { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", label: severity };

  const formattedDate = new Date(incidentDate).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: `New Incident Reported — ${incidentReference} (${companyName})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health &amp; Safety Compliance Portal</p>
        </div>

        <div style="padding: 30px 0;">
          <div style="background-color: #fef9c3; border-left: 4px solid #eab308; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px;">
            <p style="color: #854d0e; font-size: 14px; font-weight: 600; margin: 0;">Action may be required — a client has reported an incident.</p>
          </div>

          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">New Incident Reported</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello ${escHtml(fullName)}, one of your clients has just submitted an incident report. You may wish to get in touch to offer support and advice.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 130px;">Reference:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(incidentReference)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Company:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(companyName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Type:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(incidentType)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Date:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            No personal details about the individuals involved are included in this notification in accordance with GDPR. Please log in to the portal to view the full report.
          </p>

          <div style="text-align: center; padding: 24px 0;">
            <a href="${portalUrl}"
               style="background-color: #1e40af; color: #ffffff; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;
                      font-weight: 600; display: inline-block;">
              View in Portal
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group.
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send incident notification email:", error);
    throw new Error(`Failed to send incident notification email: ${error.message}`);
  }

  console.log(`Incident notification email sent to ${to} (delivered to ${recipient}) for ${incidentReference}, id: ${data?.id}`);
  return data;
}

export async function sendBookingEnquiryEmail({
  courseName,
  courseCode,
  siteName,
  companyName,
  requestedByName,
  requestedByEmail,
  message,
}: {
  courseName: string;
  courseCode: string;
  siteName: string;
  companyName: string;
  requestedByName: string;
  requestedByEmail: string;
  message?: string | null;
}) {
  const TO = "mark@guardiangroup.co.uk";

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [TO],
    subject: `New Booking Enquiry — ${courseName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <img src="${LOGO_URL}" alt="Guardian Group" style="max-height: 40px; max-width: 180px; width: auto; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">New Booking Enquiry</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            A client has submitted a booking enquiry for the following course:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 140px;">Course:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escHtml(courseName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Course Code:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(courseCode)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Company:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(companyName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(siteName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Requested by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(requestedByName)} (${escHtml(requestedByEmail)})</td>
              </tr>
              ${message ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; vertical-align: top;">Requirements:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${escHtml(message)}</td>
              </tr>` : ""}
            </table>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Please follow up with the client directly or log in to the portal to update the request status.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding: 16px 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated message from Guardian Group.
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send booking enquiry email:", error);
    throw new Error(`Failed to send booking enquiry email: ${error.message}`);
  }

  console.log(`Booking enquiry email sent for course "${courseName}" by ${requestedByEmail}, id: ${data?.id}`);
  return data;
}
