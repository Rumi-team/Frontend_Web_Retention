import { NextRequest, NextResponse } from "next/server";
import { createRetentionLayerClient } from "@/lib/supabase";
import { sendInviteEmail, sendNudgeEmail } from "@/lib/crm/resend";
import { sendInviteSms, sendNudgeSms } from "@/lib/crm/twilio";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { contact_id, channel, type = "invite" } = await req.json();

  if (!contact_id || !channel) {
    return NextResponse.json(
      { error: "contact_id and channel are required" },
      { status: 400 }
    );
  }

  if (!["email", "sms"].includes(channel)) {
    return NextResponse.json(
      { error: "channel must be 'email' or 'sms'" },
      { status: 400 }
    );
  }

  const supabase = createRetentionLayerClient();

  // Fetch contact
  const { data: contact, error: fetchError } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", contact_id)
    .single();

  if (fetchError || !contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Validate contact has the right field for this channel
  if (channel === "email" && !contact.email) {
    return NextResponse.json(
      { error: "Contact has no email address" },
      { status: 400 }
    );
  }
  if (channel === "sms" && !contact.phone) {
    return NextResponse.json(
      { error: "Contact has no phone number" },
      { status: 400 }
    );
  }

  // Send via appropriate channel
  let sendResult: { success: boolean; error?: string };
  let messageBody: string;

  if (type === "nudge") {
    if (channel === "email") {
      sendResult = await sendNudgeEmail(contact.email, contact.name);
      messageBody = `Nudge email to ${contact.email}`;
    } else {
      sendResult = await sendNudgeSms(contact.phone, contact.name);
      messageBody = `Nudge SMS to ${contact.phone}`;
    }
  } else {
    if (channel === "email") {
      sendResult = await sendInviteEmail(
        contact.email,
        contact.name,
        contact.access_code
      );
      messageBody = `Invite email to ${contact.email}`;
    } else {
      sendResult = await sendInviteSms(
        contact.phone,
        contact.name,
        contact.access_code
      );
      messageBody = `Invite SMS to ${contact.phone}`;
    }
  }

  // Write audit trail
  await supabase.from("crm_invites").insert({
    contact_id,
    channel,
    status: sendResult.success ? "sent" : "failed",
    message: messageBody,
    error: sendResult.error || null,
  });

  // Update invited_at on first invite
  if (sendResult.success && !contact.invited_at && type === "invite") {
    await supabase
      .from("crm_contacts")
      .update({ invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", contact_id);
  }

  return NextResponse.json({
    success: sendResult.success,
    error: sendResult.error || null,
    channel,
    type,
  });
}
