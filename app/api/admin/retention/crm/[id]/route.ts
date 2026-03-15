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

  if (contact.signed_up_at && contact.email) {
    const rumiApp = createRumiAppClient();

    // Find user_id from email
    const { data: identity } = await rumiApp
      .from("user_identities")
      .select("user_id")
      .eq("email", contact.email)
      .limit(1)
      .single();

    if (identity) {
      // Fetch session evaluations for timeline
      const { data: evals } = await rumiApp
        .from("session_evaluations")
        .select(
          "session_duration_minutes,transformation_level,created_at"
        )
        .eq("provider_user_id", identity.user_id)
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
