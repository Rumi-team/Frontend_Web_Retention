import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendInviteEmail(
  to: string,
  name: string,
  accessCode: string
): Promise<SendEmailResult> {
  try {
    const { data, error } = await getResend().emails.send({
      from: "Rumi <noreply@rumi.team>",
      to,
      subject: `${name}, your Rumi coaching session is ready`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>Hey ${escapeHtml(name)},</p>
          <p>You've been invited to try Rumi — an AI coaching companion that helps you grow.</p>
          <p>Your access code: <strong>${escapeHtml(accessCode)}</strong></p>
          <p>
            <a href="https://rumi.team/login?ref=${encodeURIComponent(accessCode)}"
               style="display:inline-block;padding:12px 24px;background:#facc15;color:#000;text-decoration:none;border-radius:8px;font-weight:600;">
              Start Your First Session
            </a>
          </p>
          <p style="color:#888;font-size:13px;">This invite is just for you. It takes about 10 minutes.</p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Resend error";
    return { success: false, error: message };
  }
}

export async function sendNudgeEmail(
  to: string,
  name: string
): Promise<SendEmailResult> {
  try {
    const { data, error } = await getResend().emails.send({
      from: "Rumi <noreply@rumi.team>",
      to,
      subject: `Your Rumi session is waiting, ${escapeHtml(name)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>Hey ${escapeHtml(name)},</p>
          <p>You signed up for Rumi but haven't had a coaching session yet.
             It only takes 10 minutes and it's free.</p>
          <p>
            <a href="https://rumi.team/rumi"
               style="display:inline-block;padding:12px 24px;background:#facc15;color:#000;text-decoration:none;border-radius:8px;font-weight:600;">
              Start Your First Session
            </a>
          </p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Resend error";
    return { success: false, error: message };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
