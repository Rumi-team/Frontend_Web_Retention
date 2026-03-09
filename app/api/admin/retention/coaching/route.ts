import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  fetchCoachingSessions,
  fetchProfiles,
  isRumiAppConfigured,
  type CoachingSession,
  type StrategyRetention,
  type TransformationRetention,
} from "@/lib/supabase/coaching-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isRumiAppConfigured()) {
    return NextResponse.json({
      connected: false,
      message: "Rumi_App cross-project not configured. Set RUMI_APP_SUPABASE_URL and RUMI_APP_SUPABASE_SERVICE_KEY.",
    });
  }

  const supabase = createServerSupabaseClient();

  // 1. Fetch coaching sessions from Rumi_App
  const sessions = await fetchCoachingSessions(1000);
  if (sessions.length === 0) {
    return NextResponse.json({
      connected: true,
      has_data: false,
      message: "No coaching sessions found in Rumi_App.",
    });
  }

  // 2. Fetch retention events (session_start) from Retention_Layer
  const userIds = [...new Set(sessions.map((s) => s.provider_user_id))];
  const { data: retentionEvents } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,event_type,timestamp")
    .in("provider_user_id", userIds)
    .eq("event_type", "session_start")
    .order("timestamp", { ascending: true });

  // Build return-time lookup: for each coaching session, find the next session_start
  const eventsByUser: Record<string, string[]> = {};
  for (const e of retentionEvents || []) {
    if (!eventsByUser[e.provider_user_id]) eventsByUser[e.provider_user_id] = [];
    eventsByUser[e.provider_user_id].push(e.timestamp);
  }

  // 3. Compute strategy → retention correlation
  const strategyMap = new Map<string, {
    sessions: number;
    returned48h: number;
    returned7d: number;
    transformationSum: number;
    transformationCount: number;
  }>();

  for (const session of sessions) {
    const strategy = session.strategy_name || "unknown";
    if (!strategyMap.has(strategy)) {
      strategyMap.set(strategy, {
        sessions: 0, returned48h: 0, returned7d: 0,
        transformationSum: 0, transformationCount: 0,
      });
    }
    const entry = strategyMap.get(strategy)!;
    entry.sessions++;

    if (session.transformation_level != null) {
      entry.transformationSum += session.transformation_level;
      entry.transformationCount++;
    }

    // Check if user returned within 48h / 7d after this coaching session
    const sessionTime = new Date(session.created_at).getTime();
    const userEvents = eventsByUser[session.provider_user_id] || [];
    const nextSession = userEvents.find((t) => new Date(t).getTime() > sessionTime);
    if (nextSession) {
      const gap = new Date(nextSession).getTime() - sessionTime;
      if (gap <= 48 * 3600 * 1000) entry.returned48h++;
      if (gap <= 7 * 24 * 3600 * 1000) entry.returned7d++;
    }
  }

  const strategyRetention: StrategyRetention[] = [...strategyMap.entries()]
    .map(([strategy, data]) => ({
      strategy,
      total_sessions: data.sessions,
      returned_within_48h: data.returned48h,
      returned_within_7d: data.returned7d,
      avg_transformation: data.transformationCount > 0
        ? Math.round((data.transformationSum / data.transformationCount) * 10) / 10
        : 0,
      retention_rate_48h: data.sessions > 0
        ? Math.round((data.returned48h / data.sessions) * 1000) / 10
        : 0,
      retention_rate_7d: data.sessions > 0
        ? Math.round((data.returned7d / data.sessions) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.total_sessions - a.total_sessions);

  // 4. Compute transformation level → retention correlation
  const transformMap = new Map<number, { count: number; returned48h: number }>();
  for (const session of sessions) {
    const level = session.transformation_level ?? -1;
    if (level < 0) continue;
    // Bucket: round to nearest integer (1-5 scale typical)
    const bucket = Math.round(level);
    if (!transformMap.has(bucket)) transformMap.set(bucket, { count: 0, returned48h: 0 });
    const entry = transformMap.get(bucket)!;
    entry.count++;

    const sessionTime = new Date(session.created_at).getTime();
    const userEvents = eventsByUser[session.provider_user_id] || [];
    const nextSession = userEvents.find((t) => new Date(t).getTime() > sessionTime);
    if (nextSession) {
      const gap = new Date(nextSession).getTime() - sessionTime;
      if (gap <= 48 * 3600 * 1000) entry.returned48h++;
    }
  }

  const transformationRetention: TransformationRetention[] = [...transformMap.entries()]
    .map(([level, data]) => ({
      level,
      session_count: data.count,
      returned_within_48h: data.returned48h,
      retention_rate_48h: data.count > 0
        ? Math.round((data.returned48h / data.count) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => a.level - b.level);

  // 5. Fetch RL decisions for these users to show intervention density
  const { data: decisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select("provider_user_id,action_chosen,was_exploration,created_at")
    .in("provider_user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(500);

  const totalDecisions = decisions?.length || 0;
  const interventionsByAction: Record<string, number> = {};
  for (const d of decisions || []) {
    interventionsByAction[d.action_chosen] = (interventionsByAction[d.action_chosen] || 0) + 1;
  }

  // 6. Fetch profiles for user count info
  const profiles = await fetchProfiles(userIds);
  const payingCount = profiles.filter((p) => p.is_paying).length;

  // 7. Daily coaching session trend (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const dailySessions: Record<string, number> = {};
  for (const s of sessions) {
    const day = s.created_at.slice(0, 10);
    if (day >= thirtyDaysAgo) {
      dailySessions[day] = (dailySessions[day] || 0) + 1;
    }
  }
  const sessionTrend = Object.entries(dailySessions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, sessions: count }));

  return NextResponse.json({
    connected: true,
    has_data: true,
    summary: {
      total_coaching_sessions: sessions.length,
      unique_coached_users: userIds.length,
      paying_users: payingCount,
      total_retention_decisions: totalDecisions,
      users_with_both: userIds.filter(
        (id) => (eventsByUser[id]?.length || 0) > 0
      ).length,
    },
    strategy_retention: strategyRetention,
    transformation_retention: transformationRetention,
    intervention_distribution: interventionsByAction,
    session_trend: sessionTrend,
  });
}
