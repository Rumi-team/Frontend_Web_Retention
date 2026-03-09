import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const range = req.nextUrl.searchParams.get("range") || "30";
  const daysBack = parseInt(range) || 30;
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

  // Get lifecycle snapshots grouped by date
  const { data: snapshots } = await supabase
    .schema("retention")
    .from("lifecycle_snapshots")
    .select("date,stage")
    .gte("date", cutoff)
    .order("date", { ascending: true });

  // Aggregate by date × stage
  const dayStages: Record<string, Record<string, number>> = {};
  for (const s of snapshots || []) {
    if (!dayStages[s.date]) dayStages[s.date] = { new: 0, returning: 0, resurrecting: 0, dormant: 0 };
    dayStages[s.date][s.stage] = (dayStages[s.date][s.stage] || 0) + 1;
  }

  const daily = Object.entries(dayStages)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stages]) => ({
      date,
      new: stages.new || 0,
      returning: stages.returning || 0,
      resurrecting: stages.resurrecting || 0,
      dormant: stages.dormant || 0,
    }));

  // Current stage counts (latest day)
  const latest = daily[daily.length - 1] || { new: 0, returning: 0, resurrecting: 0, dormant: 0 };

  // RL agent activity overlay: count decisions per lifecycle stage
  // Join latest lifecycle with recent decisions
  const { data: latestLifecycle } = await supabase
    .schema("retention")
    .from("lifecycle_snapshots")
    .select("provider_user_id,stage")
    .eq("date", latest.date || new Date().toISOString().slice(0, 10));

  const userStage: Record<string, string> = {};
  for (const l of latestLifecycle || []) {
    userStage[l.provider_user_id] = l.stage;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentDecisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select("provider_user_id,action_chosen")
    .neq("action_chosen", "no_action")
    .gte("created_at", sevenDaysAgo);

  // Count interventions per stage
  const stageInterventions: Record<string, number> = { new: 0, returning: 0, resurrecting: 0, dormant: 0 };
  for (const d of recentDecisions || []) {
    const stage = userStage[d.provider_user_id];
    if (stage) stageInterventions[stage]++;
  }

  return NextResponse.json({
    daily,
    current: {
      new: latest.new,
      returning: latest.returning,
      resurrecting: latest.resurrecting,
      dormant: latest.dormant,
    },
    rl_interventions: stageInterventions,
  });
}
