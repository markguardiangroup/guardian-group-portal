import { Resend } from "resend";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const resend = new Resend(
  IS_PRODUCTION ? process.env.RESEND_API_KEY_PROD : process.env.RESEND_API_KEY
);

const FROM_EMAIL = IS_PRODUCTION ? "noreply@guardiangroup.ai" : "onboarding@resend.dev";
const FROM_NAME = "Guardian Group";

const DEV_EMAIL_OVERRIDE = "mark@guardiangroup.co.uk";
const CLIENT_FORWARD_EMAIL = "mark@guardiangroup.co.uk";

function resolveRecipient(to: string, role?: string): string {
  if (!IS_PRODUCTION) {
    console.log(`[DEV MODE] Redirecting email from ${to} to ${DEV_EMAIL_OVERRIDE}`);
    return DEV_EMAIL_OVERRIDE;
  }
  if (role === "consultant" || role === "admin") {
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
  const recipient = resolveRecipient(to, role);

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
          <h2 style="color: #1e293b; font-size: 20px;">Welcome, ${fullName}!</h2>
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
  const recipient = resolveRecipient(to, role);

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
            Hello ${fullName}, we received a request to reset your password. 
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
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  uploadedBy: string;
  portalUrl: string;
  documentUrl: string;
  role?: string;
}) {
  const recipient = resolveRecipient(to, role);

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
            Hello ${fullName}, a new document has been uploaded that requires your review and approval.
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${documentTitle}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${siteName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Uploaded by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${uploadedBy}</td>
              </tr>
            </table>
          </div>
          
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

export async function sendClientSignOffEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  clientName,
  documentUrl,
  noConsultantAssigned,
  role,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  clientName: string;
  documentUrl: string;
  noConsultantAssigned?: boolean;
  role?: string;
}) {
  const recipient = resolveRecipient(to, role);

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
            Hello ${fullName}, a document has been signed off by the client and is now awaiting final approval.
          </p>
          ${noConsultantWarning}
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Document:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${documentTitle}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Site:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${siteName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Signed off by:</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${clientName}</td>
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
