import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!_client) _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return _client;
}

interface SendSmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

// Premium rate prefixes to block
const BLOCKED_PREFIXES = [
  "+1900", "+1976", "+44870", "+44871", "+44872", "+44873",
  "+44090", "+44091", "+44098",
];

export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!E164_REGEX.test(phone)) {
    return { valid: false, error: "Phone must be E.164 format (e.g. +14155551234)" };
  }
  for (const prefix of BLOCKED_PREFIXES) {
    if (phone.startsWith(prefix)) {
      return { valid: false, error: "Premium-rate numbers are not allowed" };
    }
  }
  return { valid: true };
}

export async function sendInviteSms(
  to: string,
  name: string,
  accessCode: string
): Promise<SendSmsResult> {
  const validation = validatePhone(to);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const message = await getClient().messages.create({
      body: `Hey ${name}! You're invited to try Rumi, an AI coaching companion. Your code: ${accessCode}. Start here: https://rumi.team/login?ref=${accessCode}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    return { success: true, sid: message.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Twilio error";
    return { success: false, error: message };
  }
}

export async function sendNudgeSms(
  to: string,
  name: string
): Promise<SendSmsResult> {
  const validation = validatePhone(to);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const msg = await getClient().messages.create({
      body: `Hey ${name}, your Rumi coaching session is waiting! It takes 10 min and it's free: https://rumi.team/rumi`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    return { success: true, sid: msg.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Twilio error";
    return { success: false, error: message };
  }
}
