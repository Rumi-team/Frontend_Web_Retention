import { NextRequest, NextResponse } from "next/server";
import { createRetentionLayerClient } from "@/lib/supabase";
import { createRumiAppClient } from "@/lib/supabase/rumi-app";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createRetentionLayerClient();

  // Fetch contact
  const { data: contact, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Fetch invite history
  const { data: invites } = await supabase
    .from("crm_invites")
    .select("*")
    .eq("contact_id", id)
    .order("sent_at", { ascending: true });

  // Fetch session details from Rumi_App if signed up
  let sessions: {
    session_started_at: string;
    duration_minutes: number | null;
    transformation_level: number | null;
  }[] = [];

  if (contact.signed_up_at) {
    const rumiApp = createRumiAppClient();
    let providerUserId: string | null = null;

    // Try email match first — need provider_user_id for session lookups
    // Contact may have comma-separated emails
    if (contact.email) {
      const emailAddrs = contact.email.split(",").map((e: string) => e.trim()).filter(Boolean);
      const { data: identityRows } = await rumiApp
        .from("user_identities")
        .select("user_id,provider_user_id")
        .in("email", emailAddrs)
        .limit(1);
      if (identityRows && identityRows.length > 0) {
        providerUserId = identityRows[0].provider_user_id;
      }
    }

    // Fallback: access_code redemption → user_id → provider_user_id
    if (!providerUserId && contact.access_code) {
      const { data: codeRow } = await supabase
        .from("access_codes")
        .select("id")
        .eq("code", contact.access_code)
        .single();
      if (codeRow) {
        const { data: redemption } = await supabase
          .from("access_code_redemptions")
          .select("user_id")
          .eq("code_id", codeRow.id)
          .single();
        if (redemption) {
          const { data: identity } = await rumiApp
            .from("user_identities")
            .select("provider_user_id")
            .eq("user_id", redemption.user_id)
            .limit(1)
            .single();
          if (identity) providerUserId = identity.provider_user_id;
        }
      }
    }

    if (providerUserId) {
      const { data: evals } = await rumiApp
        .from("session_evaluations")
        .select(
          "session_duration_minutes,transformation_level,created_at"
        )
        .eq("provider_user_id", providerUserId)
        .order("created_at", { ascending: true });

      if (evals) {
        sessions = evals.map((e) => ({
          session_started_at: e.created_at,
          duration_minutes: e.session_duration_minutes,
          transformation_level: e.transformation_level,
        }));
      }
    }
  }

  // Build timeline
  const timeline: {
    date: string;
    type: string;
    detail: string;
  }[] = [];

  for (const inv of invites || []) {
    timeline.push({
      date: inv.sent_at,
      type: "invite",
      detail: `Invited via ${inv.channel}${inv.status === "failed" ? " (failed)" : ""}`,
    });
  }

  if (contact.signed_up_at) {
    timeline.push({
      date: contact.signed_up_at,
      type: "signup",
      detail: "Signed up at rumi.team",
    });
  }

  for (const s of sessions) {
    const mins = s.duration_minutes ? `${s.duration_minutes} min` : "unknown duration";
    const transform = s.transformation_level
      ? `, transformation: ${s.transformation_level}/10`
      : "";
    timeline.push({
      date: s.session_started_at,
      type: "session",
      detail: `Session — ${mins}${transform}`,
    });
  }

  timeline.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return NextResponse.json({
    contact,
    invites: invites || [],
    sessions,
    timeline,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createRetentionLayerClient();

  // Delete invites first (FK constraint)
  await supabase.from("crm_invites").delete().eq("contact_id", id);

  const { error } = await supabase
    .from("crm_contacts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, email, phone, batch_name, notes } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Email or phone is required" },
      { status: 400 }
    );
  }

  // Validate each comma-separated email
  if (email) {
    const emails = email.split(",").map((e: string) => e.trim()).filter(Boolean);
    for (const addr of emails) {
      if (!EMAIL_REGEX.test(addr)) {
        return NextResponse.json(
          { error: `Invalid email: ${addr}` },
          { status: 400 }
        );
      }
    }
  }

  const supabase = createRetentionLayerClient();

  const { data, error } = await supabase
    .from("crm_contacts")
    .update({
      name,
      email: email || null,
      phone: phone || null,
      batch_name: batch_name || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}
