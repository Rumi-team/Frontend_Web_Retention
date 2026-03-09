import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { zTestTwoProportions } from "@/lib/retention/analytics";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all flag assignments
  const { data: flags } = await supabase
    .schema("retention")
    .from("flag_assignments")
    .select("provider_user_id,flag_name,variant,assigned_at");

  if (!flags?.length) {
    return NextResponse.json({ experiments: [], retention_curves: [] });
  }

  // Group by flag
  const flagGroups: Record<string, { control: string[]; treatment: string[] }> = {};
  for (const f of flags) {
    if (!flagGroups[f.flag_name]) flagGroups[f.flag_name] = { control: [], treatment: [] };
    if (f.variant === "control") flagGroups[f.flag_name].control.push(f.provider_user_id);
    else flagGroups[f.flag_name].treatment.push(f.provider_user_id);
  }

  // Get session events for retention calculation
  const { data: events } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start");

  const userSessions: Record<string, string[]> = {};
  for (const e of events || []) {
    if (!userSessions[e.provider_user_id]) userSessions[e.provider_user_id] = [];
    userSessions[e.provider_user_id].push(e.timestamp);
  }

  // Get rewards per user for avg reward comparison
  const { data: rewards } = await supabase
    .schema("retention")
    .from("rewards")
    .select("provider_user_id,reward_value");

  const userRewards: Record<string, number[]> = {};
  for (const r of rewards || []) {
    if (!userRewards[r.provider_user_id]) userRewards[r.provider_user_id] = [];
    userRewards[r.provider_user_id].push(r.reward_value);
  }

  // Get session metrics for guardrail: avg session duration
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: sessionMetrics } = await supabase
    .schema("retention")
    .from("session_metrics")
    .select("provider_user_id,avg_duration_seconds")
    .gte("date", sevenDaysAgo);

  const userAvgDuration: Record<string, number[]> = {};
  for (const m of sessionMetrics || []) {
    if (!userAvgDuration[m.provider_user_id]) userAvgDuration[m.provider_user_id] = [];
    userAvgDuration[m.provider_user_id].push(m.avg_duration_seconds);
  }

  const experiments = [];

  for (const [flagName, groups] of Object.entries(flagGroups)) {
    const controlIds = groups.control;
    const treatmentIds = groups.treatment;

    // Retention rate: has any session in last 7 days
    const hasRecentSession = (uid: string) => {
      const sessions = userSessions[uid] || [];
      return sessions.some((t) => t >= sevenDaysAgo);
    };

    const controlRetained = controlIds.filter(hasRecentSession).length;
    const treatmentRetained = treatmentIds.filter(hasRecentSession).length;

    const controlRate = controlIds.length > 0 ? controlRetained / controlIds.length : 0;
    const treatmentRate = treatmentIds.length > 0 ? treatmentRetained / treatmentIds.length : 0;

    const { z, pValue, significant } = zTestTwoProportions(
      treatmentRate, treatmentIds.length,
      controlRate, controlIds.length,
    );

    const lift = controlRate > 0 ? (treatmentRate - controlRate) / controlRate : 0;

    // Guardrail: session duration
    const avgDur = (ids: string[]) => {
      const allDurs: number[] = [];
      for (const uid of ids) {
        const durs = userAvgDuration[uid] || [];
        allDurs.push(...durs);
      }
      return allDurs.length > 0 ? allDurs.reduce((s, v) => s + v, 0) / allDurs.length : 0;
    };

    const controlDur = avgDur(controlIds);
    const treatmentDur = avgDur(treatmentIds);

    // Guardrail: avg reward
    const avgReward = (ids: string[]) => {
      const allRewards: number[] = [];
      for (const uid of ids) {
        const r = userRewards[uid] || [];
        allRewards.push(...r);
      }
      return allRewards.length > 0 ? allRewards.reduce((s, v) => s + v, 0) / allRewards.length : 0;
    };

    const controlReward = avgReward(controlIds);
    const treatmentReward = avgReward(treatmentIds);

    experiments.push({
      flag_name: flagName,
      control_count: controlIds.length,
      treatment_count: treatmentIds.length,
      control_retention_rate: Math.round(controlRate * 1000) / 1000,
      treatment_retention_rate: Math.round(treatmentRate * 1000) / 1000,
      lift: Math.round(lift * 1000) / 1000,
      confidence: Math.round((1 - pValue) * 1000) / 1000,
      is_significant: significant,
      guardrails: [
        {
          metric_name: "Avg Session Duration (s)",
          control_value: Math.round(controlDur),
          treatment_value: Math.round(treatmentDur),
          degraded: treatmentDur < controlDur * 0.9,
        },
        {
          metric_name: "Avg Reward",
          control_value: Math.round(controlReward * 1000) / 1000,
          treatment_value: Math.round(treatmentReward * 1000) / 1000,
          degraded: treatmentReward < controlReward * 0.9,
        },
      ],
    });
  }

  // Exploration rate trend from decisions
  const { data: decisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select("was_exploration,created_at")
    .order("created_at", { ascending: true });

  // Group by week, compute exploration rate
  const weeklyExploration: Record<string, { total: number; explored: number }> = {};
  for (const d of decisions || []) {
    const week = d.created_at.slice(0, 10);
    if (!weeklyExploration[week]) weeklyExploration[week] = { total: 0, explored: 0 };
    weeklyExploration[week].total++;
    if (d.was_exploration) weeklyExploration[week].explored++;
  }

  const exploration_trend = Object.entries(weeklyExploration)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      rate: data.total > 0 ? Math.round((data.explored / data.total) * 1000) / 10 : 0,
    }));

  return NextResponse.json({ experiments, exploration_trend });
}
