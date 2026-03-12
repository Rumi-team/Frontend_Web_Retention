import { NextRequest, NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";
import { reportReward } from "@/lib/retention/client";

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createRetentionDataClient();

  // Load active policy config for attribution window
  let attributionWindowHours = 48;
  let rewardWeights: Record<string, number> = {
    session_return_24h: 1.0,
    session_return_72h: 0.5,
    engagement: 0.4,
    message_response: 0.2,
    opt_out: -1.0,
  };

  try {
    const { data: config } = await supabase
      .schema("retention")
      .from("policy_config")
      .select("config_json")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (config?.config_json) {
      if (config.config_json.attribution_window_hours) {
        attributionWindowHours = config.config_json.attribution_window_hours;
      }
      if (config.config_json.reward_weights) {
        rewardWeights = config.config_json.reward_weights;
      }
    }
  } catch {
    // Use defaults
  }

  let positiveRewards = 0;
  let negativeRewards = 0;

  // Find decisions older than attribution window without rewards
  const cutoff = new Date(
    Date.now() - attributionWindowHours * 60 * 60 * 1000
  ).toISOString();
  const { data: oldDecisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select("id,provider_user_id,action_chosen,created_at")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(500);

  for (const dec of oldDecisions || []) {
    // Check if reward already exists
    const { count } = await supabase
      .schema("retention")
      .from("rewards")
      .select("id", { count: "exact", head: true })
      .eq("decision_id", dec.id);

    if ((count || 0) > 0) continue;

    // Check for session return within attribution window
    const windowEnd = new Date(
      new Date(dec.created_at).getTime() + attributionWindowHours * 60 * 60 * 1000
    ).toISOString();

    const { count: sessionCount } = await supabase
      .schema("retention")
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("provider_user_id", dec.provider_user_id)
      .eq("event_type", "session_start")
      .gt("timestamp", dec.created_at)
      .lt("timestamp", windowEnd);

    // Check for engagement events
    const { count: engagementCount } = await supabase
      .schema("retention")
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("provider_user_id", dec.provider_user_id)
      .in("event_type", ["page_view", "library_open"])
      .gt("timestamp", dec.created_at)
      .lt("timestamp", windowEnd);

    // Compute weighted reward
    let reward = 0;
    let rewardType = "no_return_7d";

    if ((sessionCount || 0) > 0) {
      // Determine if 24h or 72h return
      const twentyFourHLater = new Date(
        new Date(dec.created_at).getTime() + 24 * 60 * 60 * 1000
      ).toISOString();
      const { count: earlyCount } = await supabase
        .schema("retention")
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("provider_user_id", dec.provider_user_id)
        .eq("event_type", "session_start")
        .gt("timestamp", dec.created_at)
        .lt("timestamp", twentyFourHLater);

      if ((earlyCount || 0) > 0) {
        reward += rewardWeights.session_return_24h || 1.0;
        rewardType = "session_return_24h";
      } else {
        reward += rewardWeights.session_return_72h || 0.5;
        rewardType = "session_return_72h";
      }
    }

    if ((engagementCount || 0) > 0) {
      reward += rewardWeights.engagement || 0.4;
    }

    // Clamp
    reward = Math.max(-1, Math.min(1, reward));

    await reportReward(
      dec.id,
      dec.provider_user_id,
      rewardType,
      reward
    );

    if (reward > 0) {
      positiveRewards++;
    } else {
      negativeRewards++;
    }
  }

  return NextResponse.json({
    status: "ok",
    positive_rewards: positiveRewards,
    negative_rewards: negativeRewards,
    attribution_window_hours: attributionWindowHours,
  });
}
