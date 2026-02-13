import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "onboarding@resend.dev";
const FROM_NAME = "Guardian Group";

const TEST_EMAIL_OVERRIDE = "mark@guardiangroup.co.uk";

export async function sendInvitationEmail({
  to,
  fullName,
  inviteUrl,
  expiresAt,
}: {
  to: string;
  fullName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const expiryText = `${Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))} hours`;

  const recipient = TEST_EMAIL_OVERRIDE || to;
  if (TEST_EMAIL_OVERRIDE) {
    console.log(`[TEST MODE] Redirecting email from ${to} to ${TEST_EMAIL_OVERRIDE}`);
  }

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: "You've been invited to Guardian Group Compliance Portal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <h1 style="color: #1e40af; margin: 0; font-size: 24px;">Guardian Group</h1>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
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

  console.log(`Invitation email sent to ${to}, id: ${data?.id}`);
  return data;
}

export async function sendPasswordResetEmail({
  to,
  fullName,
  resetUrl,
  expiresAt,
}: {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresAt: Date;
}) {
  const expiryText = `${Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))} hour(s)`;

  const recipient = TEST_EMAIL_OVERRIDE || to;
  if (TEST_EMAIL_OVERRIDE) {
    console.log(`[TEST MODE] Redirecting password reset email from ${to} to ${TEST_EMAIL_OVERRIDE}`);
  }

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: "Reset Your Password - Guardian Group Compliance Portal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <h1 style="color: #1e40af; margin: 0; font-size: 24px;">Guardian Group</h1>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
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

  console.log(`Password reset email sent to ${to}, id: ${data?.id}`);
  return data;
}

export async function sendDocumentApprovalEmail({
  to,
  fullName,
  documentTitle,
  siteName,
  uploadedBy,
  portalUrl,
}: {
  to: string;
  fullName: string;
  documentTitle: string;
  siteName: string;
  uploadedBy: string;
  portalUrl: string;
}) {
  const recipient = TEST_EMAIL_OVERRIDE || to;
  if (TEST_EMAIL_OVERRIDE) {
    console.log(`[TEST MODE] Redirecting approval email from ${to} to ${TEST_EMAIL_OVERRIDE}`);
  }

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [recipient],
    subject: `Document Requires Your Approval - ${documentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1e40af;">
          <h1 style="color: #1e40af; margin: 0; font-size: 24px;">Guardian Group</h1>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Health & Safety Compliance Portal</p>
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
            <a href="${portalUrl}" 
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

  console.log(`Document approval email sent to ${to}, id: ${data?.id}`);
  return data;
}
