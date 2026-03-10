import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRetentionDataClient } from "@/lib/supabase";
import { classifyLifecycleState, computeChurnScore, computeRetentionMatrix } from "@/lib/retention/analytics";

export const maxDuration = 60;

const SEVEN_DAYS_MS = 7 * 86400000;
const FOURTEEN_DAYS_MS = 14 * 86400000;
const THIRTY_DAYS_MS = 30 * 86400000;

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createRetentionDataClient();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - FOURTEEN_DAYS_MS).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS).toISOString();

  const stats = {
    session_metrics: 0,
    apu_snapshot: false,
    lifecycle_snapshots: 0,
    churn_scores: 0,
    cohort_rows: 0,
  };

  // ── 1. Session Metrics ──
  // Count session_start events per user per day for the last 7 days
  const { data: recentEvents } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,event_type,timestamp")
    .in("event_type", ["session_start", "session_end"])
    .gte("timestamp", sevenDaysAgo)
    .order("timestamp", { ascending: true });

  if (recentEvents?.length) {
    // Group by user × date
    const userDateSessions: Record<string, Record<string, { starts: string[]; ends: string[] }>> = {};
    for (const e of recentEvents) {
      const uid = e.provider_user_id;
      const date = e.timestamp.slice(0, 10);
      if (!userDateSessions[uid]) userDateSessions[uid] = {};
      if (!userDateSessions[uid][date]) userDateSessions[uid][date] = { starts: [], ends: [] };
      if (e.event_type === "session_start") {
        userDateSessions[uid][date].starts.push(e.timestamp);
      } else {
        userDateSessions[uid][date].ends.push(e.timestamp);
      }
    }

    const rows: Array<{
      provider_user_id: string;
      date: string;
      session_count: number;
      total_duration_seconds: number;
      avg_duration_seconds: number;
    }> = [];

    for (const [uid, dates] of Object.entries(userDateSessions)) {
      for (const [date, { starts, ends }] of Object.entries(dates)) {
        const sessionCount = starts.length;
        let totalDuration = 0;
        // Pair starts with ends for duration estimation
        const pairedCount = Math.min(starts.length, ends.length);
        for (let i = 0; i < pairedCount; i++) {
          const dur = (new Date(ends[i]).getTime() - new Date(starts[i]).getTime()) / 1000;
          if (dur > 0 && dur < 7200) totalDuration += dur; // Cap at 2h per session
        }
        // Fallback: if no ends, estimate 15min per session
        if (ends.length === 0 && starts.length > 0) {
          totalDuration = starts.length * 900;
        }
        const avgDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0;

        rows.push({
          provider_user_id: uid,
          date,
          session_count: sessionCount,
          total_duration_seconds: Math.round(totalDuration),
          avg_duration_seconds: avgDuration,
        });
      }
    }

    if (rows.length) {
      const { error } = await supabase
        .schema("retention")
        .from("session_metrics")
        .upsert(rows, { onConflict: "provider_user_id,date" });
      if (!error) stats.session_metrics = rows.length;
    }
  }

  // ── 2. APU Snapshot ──
  // APU = paying users with 4+ sessions in the trailing 7 days
  // Query session_metrics for 7-day totals
  const { data: weeklyMetrics } = await supabase
    .schema("retention")
    .from("session_metrics")
    .select("provider_user_id,session_count")
    .gte("date", sevenDaysAgo.slice(0, 10));

  // Aggregate per user
  const userWeeklySessions: Record<string, number> = {};
  for (const m of weeklyMetrics || []) {
    userWeeklySessions[m.provider_user_id] = (userWeeklySessions[m.provider_user_id] || 0) + m.session_count;
  }

  // Get paying users from Rumi_App (cross-project)
  // If cross-project client not configured, treat all active users as paying for now
  let payingUserIds: Set<string>;
  try {
    const rumiAppUrl = process.env.RUMI_APP_SUPABASE_URL;
    const rumiAppKey = process.env.RUMI_APP_SUPABASE_SERVICE_KEY;
    if (rumiAppUrl && rumiAppKey) {
      const rumiApp = createClient(rumiAppUrl, rumiAppKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: profiles } = await rumiApp
        .from("profiles")
        .select("id")
        .eq("is_paying", true);
      payingUserIds = new Set((profiles || []).map((p) => p.id));
    } else {
      // Fallback: all users with sessions are "paying" for APU calculation
      payingUserIds = new Set(Object.keys(userWeeklySessions));
    }
  } catch {
    payingUserIds = new Set(Object.keys(userWeeklySessions));
  }

  const apuUserIds = Object.entries(userWeeklySessions)
    .filter(([uid, count]) => count >= 4 && payingUserIds.has(uid))
    .map(([uid]) => uid);

  const totalPaying = payingUserIds.size;
  const apuCount = apuUserIds.length;
  const apuRatio = totalPaying > 0 ? apuCount / totalPaying : 0;

  const { error: apuErr } = await supabase
    .schema("retention")
    .from("apu_snapshots")
    .upsert(
      { date: today, apu_count: apuCount, total_paying: totalPaying, apu_ratio: Math.round(apuRatio * 1000) / 1000, apu_user_ids: apuUserIds },
      { onConflict: "date" },
    );
  if (!apuErr) stats.apu_snapshot = true;

  // ── 3. Lifecycle Snapshots ──
  // Classify each user into new/returning/resurrecting/dormant
  const { data: allEvents } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start")
    .order("timestamp", { ascending: true });

  if (allEvents?.length) {
    const userTimestamps: Record<string, string[]> = {};
    for (const e of allEvents) {
      if (!userTimestamps[e.provider_user_id]) userTimestamps[e.provider_user_id] = [];
      userTimestamps[e.provider_user_id].push(e.timestamp);
    }

    const periodEnd = new Date(today + "T23:59:59Z");
    const periodStart = new Date(new Date(today).getTime() - SEVEN_DAYS_MS);
    const previousPeriodStart = new Date(periodStart.getTime() - SEVEN_DAYS_MS);

    const lifecycleRows: Array<{ provider_user_id: string; date: string; stage: string }> = [];

    for (const [uid, timestamps] of Object.entries(userTimestamps)) {
      const stage = classifyLifecycleState(timestamps, periodStart, periodEnd, previousPeriodStart);
      lifecycleRows.push({ provider_user_id: uid, date: today, stage });
    }

    if (lifecycleRows.length) {
      const { error } = await supabase
        .schema("retention")
        .from("lifecycle_snapshots")
        .upsert(lifecycleRows, { onConflict: "provider_user_id,date" });
      if (!error) stats.lifecycle_snapshots = lifecycleRows.length;
    }
  }

  // ── 4. Churn Risk Scores ──
  // For each user, compute multi-factor risk score
  const { data: allSessionMetrics } = await supabase
    .schema("retention")
    .from("session_metrics")
    .select("provider_user_id,date,session_count,avg_duration_seconds")
    .gte("date", thirtyDaysAgo.slice(0, 10))
    .order("date", { ascending: true });

  if (allSessionMetrics?.length) {
    const userMetrics: Record<string, Array<{ date: string; session_count: number; avg_duration_seconds: number }>> = {};
    for (const m of allSessionMetrics) {
      if (!userMetrics[m.provider_user_id]) userMetrics[m.provider_user_id] = [];
      userMetrics[m.provider_user_id].push(m);
    }

    // Get unique event types per user for engagement breadth
    const { data: eventTypes } = await supabase
      .schema("retention")
      .from("events")
      .select("provider_user_id,event_type")
      .gte("timestamp", fourteenDaysAgo);

    const userEventTypes: Record<string, Set<string>> = {};
    const allEventTypesSet = new Set<string>();
    for (const e of eventTypes || []) {
      if (!userEventTypes[e.provider_user_id]) userEventTypes[e.provider_user_id] = new Set();
      userEventTypes[e.provider_user_id].add(e.event_type);
      allEventTypesSet.add(e.event_type);
    }
    const totalEventTypes = allEventTypesSet.size || 1;

    const churnRows: Array<{
      provider_user_id: string;
      score: number;
      factors: Record<string, number>;
      computed_at: string;
    }> = [];

    for (const [uid, metrics] of Object.entries(userMetrics)) {
      const sorted = metrics.sort((a, b) => a.date.localeCompare(b.date));
      const lastDate = sorted[sorted.length - 1].date;
      const daysSinceLast = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000);

      // Split into recent (last 7d) and previous (7-14d)
      const recentCutoff = sevenDaysAgo.slice(0, 10);
      const recent = sorted.filter((m) => m.date >= recentCutoff);
      const previous = sorted.filter((m) => m.date < recentCutoff && m.date >= fourteenDaysAgo.slice(0, 10));

      const recentSessions = recent.reduce((s, m) => s + m.session_count, 0);
      const prevSessions = previous.reduce((s, m) => s + m.session_count, 0);
      const recentAvgDur = recent.length > 0
        ? recent.reduce((s, m) => s + m.avg_duration_seconds, 0) / recent.length
        : 0;
      const prevAvgDur = previous.length > 0
        ? previous.reduce((s, m) => s + m.avg_duration_seconds, 0) / previous.length
        : 0;

      const uniqueEventTypes = userEventTypes[uid]?.size || 0;

      // Account age from first event
      const firstMetric = sorted[0];
      const accountAgeDays = Math.floor((now.getTime() - new Date(firstMetric.date).getTime()) / 86400000);

      const { score, factors } = computeChurnScore({
        daysSinceLastSession: daysSinceLast,
        recentSessionsPerWeek: recentSessions,
        previousSessionsPerWeek: prevSessions,
        recentAvgDuration: recentAvgDur,
        previousAvgDuration: prevAvgDur,
        uniqueEventTypes,
        totalEventTypes,
        accountAgeDays,
      });

      churnRows.push({
        provider_user_id: uid,
        score: Math.round(score * 1000) / 1000,
        factors,
        computed_at: now.toISOString(),
      });
    }

    if (churnRows.length) {
      const { error } = await supabase
        .schema("retention")
        .from("churn_risk_scores")
        .upsert(churnRows, { onConflict: "provider_user_id" });
      if (!error) stats.churn_scores = churnRows.length;
    }
  }

  // ── 5. Cohort Cache ──
  // Compute weekly first_time retention matrix from session_start events
  if (allEvents?.length) {
    const cohortRows = computeRetentionMatrix(
      allEvents.map((e) => ({ provider_user_id: e.provider_user_id, timestamp: e.timestamp })),
      "first_time",
      "week",
      12,
    );

    const cacheRows: Array<{
      cohort_date: string;
      period: number;
      period_unit: string;
      retention_mode: string;
      cohort_size: number;
      retained_count: number;
      retention_rate: number;
      computed_at: string;
    }> = [];

    for (const row of cohortRows) {
      for (const p of row.periods) {
        cacheRows.push({
          cohort_date: row.cohort_label,
          period: p.period,
          period_unit: "week",
          retention_mode: "first_time",
          cohort_size: row.cohort_size,
          retained_count: p.retained,
          retention_rate: Math.round(p.rate * 1000) / 1000,
          computed_at: now.toISOString(),
        });
      }
    }

    if (cacheRows.length) {
      const { error } = await supabase
        .schema("retention")
        .from("cohort_cache")
        .upsert(cacheRows, { onConflict: "cohort_date,period,period_unit,retention_mode" });
      if (!error) stats.cohort_rows = cacheRows.length;
    }
  }

  return NextResponse.json({ status: "ok", date: today, stats });
}
