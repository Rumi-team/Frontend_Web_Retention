import { NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";
import { isRealUser } from "@/lib/retention/segments";

export async function GET() {
  const supabase = createRetentionDataClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // ── DAU/MAU ──
  const { data: dauEvents } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start")
    .gte("timestamp", thirtyDaysAgo)
    .order("timestamp", { ascending: true });

  // Build daily unique user counts (exclude simulation IDs)
  const dailyUsers: Record<string, Set<string>> = {};
  for (const e of dauEvents || []) {
    if (!isRealUser(e.provider_user_id)) continue;
    const day = e.timestamp.slice(0, 10);
    if (!dailyUsers[day]) dailyUsers[day] = new Set();
    dailyUsers[day].add(e.provider_user_id);
  }

  // Rolling 30-day MAU: for each day, count unique users in [day-29, day]
  const sortedDays = Object.keys(dailyUsers).sort();
  const dau_mau = sortedDays.map((date) => {
    const dayMs = new Date(date).getTime();
    const windowStart = dayMs - 29 * 86400000;
    const mauUsers = new Set<string>();
    for (const [d, users] of Object.entries(dailyUsers)) {
      const dMs = new Date(d).getTime();
      if (dMs >= windowStart && dMs <= dayMs) {
        for (const u of users) mauUsers.add(u);
      }
    }
    const dau = dailyUsers[date].size;
    const mau = mauUsers.size;
    return {
      date,
      dau,
      mau,
      ratio: mau > 0 ? Math.round((dau / mau) * 1000) / 1000 : 0,
    };
  });

  // ── Session Duration ──
  // Use session_metrics for historical data, but supplement with live event
  // data for today so "Sessions Today" / "Unique Users Today" aren't stale.
  const thirtyDaysAgoDate = thirtyDaysAgo.slice(0, 10);
  const { data: sessionMetrics } = await supabase
    .schema("retention")
    .from("session_metrics")
    .select("date,session_count,avg_duration_seconds,provider_user_id")
    .gte("date", thirtyDaysAgoDate)
    .order("date", { ascending: true });

  // Aggregate by day (exclude simulation IDs)
  const dayMetrics: Record<string, { totalSessions: number; totalDuration: number; users: Set<string> }> = {};
  for (const m of sessionMetrics || []) {
    if (!isRealUser(m.provider_user_id)) continue;
    if (!dayMetrics[m.date]) dayMetrics[m.date] = { totalSessions: 0, totalDuration: 0, users: new Set() };
    dayMetrics[m.date].totalSessions += m.session_count;
    dayMetrics[m.date].totalDuration += m.avg_duration_seconds * m.session_count;
    dayMetrics[m.date].users.add(m.provider_user_id);
  }

  // Supplement today's metrics from live events so we don't wait for the cron
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = dailyUsers[today];
  if (todayEvents && todayEvents.size > 0 && !dayMetrics[today]) {
    dayMetrics[today] = {
      totalSessions: todayEvents.size, // approximate: 1 session per user
      totalDuration: 0,
      users: todayEvents,
    };
  }

  const session_metrics = Object.entries(dayMetrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      avg_duration_seconds: d.totalSessions > 0 ? Math.round(d.totalDuration / d.totalSessions) : 0,
      total_sessions: d.totalSessions,
      unique_users: d.users.size,
    }));

  // Session duration drop alert
  let duration_alert = false;
  if (session_metrics.length >= 4) {
    const recent3 = session_metrics.slice(-3);
    const prev3 = session_metrics.slice(-6, -3);
    if (prev3.length > 0) {
      const recentAvg = recent3.reduce((s, m) => s + m.avg_duration_seconds, 0) / recent3.length;
      const prevAvg = prev3.reduce((s, m) => s + m.avg_duration_seconds, 0) / prev3.length;
      if (prevAvg > 0 && (prevAvg - recentAvg) / prevAvg > 0.2) {
        duration_alert = true;
      }
    }
  }

  // ── Stickiness ──
  // How many unique days each user was active in the last 30 days
  const userActiveDays: Record<string, Set<string>> = {};
  for (const e of dauEvents || []) {
    if (!isRealUser(e.provider_user_id)) continue;
    const day = e.timestamp.slice(0, 10);
    if (!userActiveDays[e.provider_user_id]) userActiveDays[e.provider_user_id] = new Set();
    userActiveDays[e.provider_user_id].add(day);
  }

  const stickinessBuckets: Record<number, number> = {};
  for (const days of Object.values(userActiveDays)) {
    const count = days.size;
    stickinessBuckets[count] = (stickinessBuckets[count] || 0) + 1;
  }

  const stickiness = Object.entries(stickinessBuckets)
    .map(([days, userCount]) => ({ days_active: parseInt(days), user_count: userCount }))
    .sort((a, b) => a.days_active - b.days_active);

  return NextResponse.json({
    dau_mau,
    session_metrics,
    stickiness,
    duration_alert,
  });
}
