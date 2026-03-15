import { NextRequest, NextResponse } from "next/server";
import { createRetentionLayerClient } from "@/lib/supabase";
import { sendInviteEmail } from "@/lib/crm/resend";
import { sendInviteSms } from "@/lib/crm/twilio";

export const dynamic = "force-dynamic";

const CONCURRENCY = 5;

async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

export async function POST(req: NextRequest) {
  const { contact_ids, channel } = await req.json();

  if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
    return NextResponse.json(
      { error: "contact_ids array is required" },
      { status: 400 }
    );
  }
  if (!["email", "sms"].includes(channel)) {
    return NextResponse.json(
      { error: "channel must be 'email' or 'sms'" },
      { status: 400 }
    );
  }
  if (contact_ids.length > 100) {
    return NextResponse.json(
      { error: "Max 100 contacts per batch" },
      { status: 400 }
    );
  }

  const supabase = createRetentionLayerClient();

  // Fetch all contacts
  const { data: contacts, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .in("id", contact_ids);

  if (error || !contacts) {
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }

  const results: { contact_id: string; name: string; success: boolean; error?: string }[] = [];

  const tasks = contacts.map((contact) => async () => {
    // Idempotency: skip if already sent in the last hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: recentInvite } = await supabase
      .from("crm_invites")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("channel", channel)
      .eq("status", "sent")
      .gte("sent_at", oneHourAgo)
      .limit(1);

    if (recentInvite && recentInvite.length > 0) {
      results.push({
        contact_id: contact.id,
        name: contact.name,
        success: true,
        error: "Already sent within the last hour (skipped)",
      });
      return;
    }

    // Validate contact has the right field
    if (channel === "email" && !contact.email) {
      results.push({
        contact_id: contact.id,
        name: contact.name,
        success: false,
        error: "No email address",
      });
      return;
    }
    if (channel === "sms" && !contact.phone) {
      results.push({
        contact_id: contact.id,
        name: contact.name,
        success: false,
        error: "No phone number",
      });
      return;
    }

    // Send
    const sendResult =
      channel === "email"
        ? await sendInviteEmail(contact.email, contact.name, contact.access_code)
        : await sendInviteSms(contact.phone, contact.name, contact.access_code);

    // Audit trail
    await supabase.from("crm_invites").insert({
      contact_id: contact.id,
      channel,
      status: sendResult.success ? "sent" : "failed",
      message: `Batch invite ${channel} to ${channel === "email" ? contact.email : contact.phone}`,
      error: sendResult.error || null,
    });

    // Update invited_at
    if (sendResult.success && !contact.invited_at) {
      await supabase
        .from("crm_contacts")
        .update({ invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", contact.id);
    }

    results.push({
      contact_id: contact.id,
      name: contact.name,
      success: sendResult.success,
      error: sendResult.error,
    });
  });

  await pLimit(tasks, CONCURRENCY);

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({ sent, failed, total: results.length, results });
}
