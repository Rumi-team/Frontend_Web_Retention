import { NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  // Auth handled by middleware
  const supabase = createRetentionDataClient();

  // Query retention data directly from Supabase (Rumi_App)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [decisionsRes, eventsRes, rewardsRes, flagsRes] = await Promise.all([
    supabase
      .schema("retention")
      .from("decisions")
      .select("id,action_chosen,was_exploration,created_at", { count: "exact" })
      .gte("created_at", thirtyDaysAgo),
    supabase
      .schema("retention")
      .from("events")
      .select("id", { count: "exact" })
      .gte("timestamp", thirtyDaysAgo),
    supabase
      .schema("retention")
      .from("rewards")
      .select("reward_value", { count: "exact" })
      .gte("timestamp", thirtyDaysAgo),
    supabase
      .schema("retention")
      .from("flag_assignments")
      .select("variant"),
  ]);

  const decisions = decisionsRes.data || [];
  const totalDecisions = decisionsRes.count || 0;
  const totalEvents = eventsRes.count || 0;
  const rewards = rewardsRes.data || [];
  const totalRewards = rewardsRes.count || 0;
  const flags = flagsRes.data || [];

  // Compute action distribution
  const actionDist: Record<string, number> = {};
  let explorationCount = 0;
  const decisionsByDay: Record<string, number> = {};
  for (const d of decisions) {
    actionDist[d.action_chosen] = (actionDist[d.action_chosen] || 0) + 1;
    if (d.was_exploration) explorationCount++;
    const day = d.created_at?.slice(0, 10);
    if (day) decisionsByDay[day] = (decisionsByDay[day] || 0) + 1;
  }

  // Compute avg reward
  const rewardsByDay: Record<string, number> = {};
  let rewardSum = 0;
  for (const r of rewards) {
    rewardSum += r.reward_value || 0;
  }

  // A/B split
  const abSplit: Record<string, number> = { control: 0, treatment: 0 };
  for (const f of flags) {
    if (f.variant === "control") abSplit.control++;
    else if (f.variant === "treatment") abSplit.treatment++;
  }

  // Cold start count: users with fewer than 5 decisions
  const { data: coldStartData } = await supabase
    .schema("retention")
    .from("decisions")
    .select("provider_user_id")
    .gte("created_at", thirtyDaysAgo);

  const userDCounts: Record<string, number> = {};
  for (const d of coldStartData || []) {
    userDCounts[d.provider_user_id] = (userDCounts[d.provider_user_id] || 0) + 1;
  }
  const coldStartCount = Object.values(userDCounts).filter((c) => c < 5).length;

  // Compute incremental lift from control_matches
  const { data: liftData } = await supabase
    .schema("retention")
    .from("control_matches")
    .select("incremental_lift")
    .not("incremental_lift", "is", null);

  const avgLift = liftData && liftData.length > 0
    ? liftData.reduce((s, r) => s + (r.incremental_lift || 0), 0) / liftData.length
    : 0;

  // Compute rewards_by_day
  const { data: rewardRows } = await supabase
    .schema("retention")
    .from("rewards")
    .select("reward_value,timestamp")
    .gte("timestamp", thirtyDaysAgo);

  for (const r of rewardRows || []) {
    const day = r.timestamp?.slice(0, 10);
    if (day) rewardsByDay[day] = (rewardsByDay[day] || 0) + (r.reward_value || 0);
  }

  const metrics = {
    total_decisions: totalDecisions,
    total_events: totalEvents,
    total_rewards: totalRewards,
    avg_reward: totalRewards > 0 ? rewardSum / totalRewards : 0,
    exploration_rate: totalDecisions > 0 ? explorationCount / totalDecisions : 0,
    action_distribution: actionDist,
    ab_split: abSplit,
    time_series: {
      decisions_by_day: decisionsByDay,
      rewards_by_day: rewardsByDay,
    },
    dimension_distributions: {},
    rl_health: {
      cold_start_count: coldStartCount,
      avg_incremental_lift: Math.round(avgLift * 1000) / 1000,
    },
  };

  // Get recent decisions
  const { data: recentDecisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select(
      "id,provider_user_id,action_chosen,action_payload,was_exploration,policy_version,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    metrics: metrics || {},
    recent_decisions: recentDecisions || [],
  });
}
