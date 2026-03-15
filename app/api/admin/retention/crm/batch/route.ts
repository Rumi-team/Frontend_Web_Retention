import { NextRequest, NextResponse } from "next/server";
import { createRetentionLayerClient } from "@/lib/supabase";
import { sendInviteEmail } from "@/lib/crm/resend";

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
  const { contact_ids } = await req.json();

  if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
    return NextResponse.json(
      { error: "contact_ids array is required" },
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

  const { data: contacts, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .in("id", contact_ids);

  if (error || !contacts) {
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }

  const results: { contact_id: string; name: string; success: boolean; error?: string }[] = [];

  const tasks = contacts.map((contact) => async () => {
    if (!contact.email) {
      results.push({
        contact_id: contact.id,
        name: contact.name,
        success: false,
        error: "No email address",
      });
      return;
    }

    // Idempotency: skip if already sent in the last hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: recentInvite } = await supabase
      .from("crm_invites")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("channel", "email")
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

    const sendResult = await sendInviteEmail(
      contact.email,
      contact.name,
      contact.access_code
    );

    await supabase.from("crm_invites").insert({
      contact_id: contact.id,
      channel: "email",
      status: sendResult.success ? "sent" : "failed",
      message: `Batch invite email to ${contact.email}`,
      error: sendResult.error || null,
    });

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
