import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // ── DAU/MAU ──
  const { data: dauEvents } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start")
    .gte("timestamp", thirtyDaysAgo)
    .order("timestamp", { ascending: true });

  // Build daily unique user counts
  const dailyUsers: Record<string, Set<string>> = {};
  for (const e of dauEvents || []) {
    const day = e.timestamp.slice(0, 10);
    if (!dailyUsers[day]) dailyUsers[day] = new Set();
    dailyUsers[day].add(e.provider_user_id);
  }

  // MAU = all unique users across the 30-day window
  const allUsersInWindow = new Set((dauEvents || []).map((e) => e.provider_user_id));
  const mau = allUsersInWindow.size;

  const dau_mau = Object.entries(dailyUsers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, users]) => ({
      date,
      dau: users.size,
      mau,
      ratio: mau > 0 ? Math.round((users.size / mau) * 1000) / 1000 : 0,
    }));

  // ── Session Duration ──
  const thirtyDaysAgoDate = thirtyDaysAgo.slice(0, 10);
  const { data: sessionMetrics } = await supabase
    .schema("retention")
    .from("session_metrics")
    .select("date,session_count,avg_duration_seconds,provider_user_id")
    .gte("date", thirtyDaysAgoDate)
    .order("date", { ascending: true });

  // Aggregate by day
  const dayMetrics: Record<string, { totalSessions: number; totalDuration: number; users: Set<string> }> = {};
  for (const m of sessionMetrics || []) {
    if (!dayMetrics[m.date]) dayMetrics[m.date] = { totalSessions: 0, totalDuration: 0, users: new Set() };
    dayMetrics[m.date].totalSessions += m.session_count;
    dayMetrics[m.date].totalDuration += m.avg_duration_seconds * m.session_count;
    dayMetrics[m.date].users.add(m.provider_user_id);
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
