import { NextRequest, NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";
import { requestDecision } from "@/lib/retention/client";

const MAX_USERS_PER_RUN = 50;

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createRetentionDataClient();

  // Get active users (session in last 30 days), most at-risk first
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: users } = await supabase
    .from("session_evaluations")
    .select("provider_user_id")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true })
    .limit(MAX_USERS_PER_RUN);

  if (!users?.length) {
    return NextResponse.json({ status: "no_users", processed: 0 });
  }

  const uniqueUsers = [...new Set(users.map((u) => u.provider_user_id))];
  let processed = 0;
  let errors = 0;
  let freqCapSkipped = 0;
  let flagSkipped = 0;

  // Load A/B flag treatment assignments for retention_bandit_v1
  const { data: flagAssignments } = await supabase
    .schema("retention")
    .from("flag_assignments")
    .select("provider_user_id, variant")
    .eq("flag_name", "retention_bandit_v1")
    .in("provider_user_id", uniqueUsers);

  const treatmentSet = new Set(
    (flagAssignments || [])
      .filter((a) => a.variant === "treatment")
      .map((a) => a.provider_user_id)
  );

  // Pre-check frequency cap: count decisions per user in last 7 days
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: recentDecisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select("provider_user_id")
    .neq("action_chosen", "no_action")
    .gte("created_at", sevenDaysAgo);

  const decisionCounts: Record<string, number> = {};
  for (const d of recentDecisions || []) {
    decisionCounts[d.provider_user_id] =
      (decisionCounts[d.provider_user_id] || 0) + 1;
  }

  // Load active policy config for frequency cap
  let maxPerWeek = 3;
  try {
    const { data: config } = await supabase
      .schema("retention")
      .from("policy_config")
      .select("config_json")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (config?.config_json?.frequency_cap?.max_per_week) {
      maxPerWeek = config.config_json.frequency_cap.max_per_week;
    }
  } catch {
    // Use default
  }

  for (const userId of uniqueUsers) {
    // Only process treatment-arm users
    if (!treatmentSet.has(userId)) {
      flagSkipped++;
      continue;
    }

    // Frequency cap pre-check
    if ((decisionCounts[userId] || 0) >= maxPerWeek) {
      freqCapSkipped++;
      continue;
    }

    try {
      const decision = await requestDecision(userId, "daily_check");
      if (decision && decision.action !== "no_action") {
        const payload = decision.action_payload || {};
        if (payload.execution_model === "outreach") {
          // Insert into scheduled_reminders for OpenClaw cron to deliver
          await supabase.from("scheduled_reminders").insert({
            provider_user_id: userId,
            channel: payload.channel || "email",
            message: payload.message_template || "",
            scheduled_at: new Date(
              Date.now() +
                (payload.timing_offset_hours || 4) * 60 * 60 * 1000
            ).toISOString(),
            status: "pending",
          });
        }
      }
      processed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    status: "ok",
    processed,
    errors,
    freq_cap_skipped: freqCapSkipped,
    flag_skipped: flagSkipped,
  });
}
