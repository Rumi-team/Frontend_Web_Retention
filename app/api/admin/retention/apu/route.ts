import { NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createRetentionDataClient();

  // Last 30 days of APU snapshots
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: snapshots } = await supabase
    .schema("retention")
    .from("apu_snapshots")
    .select("date,apu_count,total_paying,apu_ratio,apu_user_ids")
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: true });

  // Current APU users: 4+ sessions in trailing 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: weeklyMetrics } = await supabase
    .schema("retention")
    .from("session_metrics")
    .select("provider_user_id,session_count,date")
    .gte("date", sevenDaysAgo);

  const userWeeklySessions: Record<string, { total: number; lastDate: string }> = {};
  for (const m of weeklyMetrics || []) {
    if (!userWeeklySessions[m.provider_user_id]) {
      userWeeklySessions[m.provider_user_id] = { total: 0, lastDate: m.date };
    }
    userWeeklySessions[m.provider_user_id].total += m.session_count;
    if (m.date > userWeeklySessions[m.provider_user_id].lastDate) {
      userWeeklySessions[m.provider_user_id].lastDate = m.date;
    }
  }

  // Get APU users (4+ sessions/week)
  const apuUsers = Object.entries(userWeeklySessions)
    .filter(([, v]) => v.total >= 4)
    .map(([uid, v]) => ({
      user_id: uid,
      sessions_this_week: v.total,
      last_session: v.lastDate,
    }))
    .sort((a, b) => b.sessions_this_week - a.sessions_this_week);

  // Detect APU health alerts: users who were APU previously but dropped
  const prevSnapshot = snapshots && snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const currentApuIds = new Set(apuUsers.map((u) => u.user_id));
  const alerts: Array<{ user_id: string; previous_sessions: number; current_sessions: number }> = [];

  if (prevSnapshot?.apu_user_ids) {
    for (const prevId of prevSnapshot.apu_user_ids) {
      if (!currentApuIds.has(prevId)) {
        const current = userWeeklySessions[prevId]?.total || 0;
        alerts.push({ user_id: prevId, previous_sessions: 4, current_sessions: current });
      }
    }
  }

  const latest = snapshots?.[snapshots.length - 1];
  const prev48h = snapshots && snapshots.length >= 3 ? snapshots[snapshots.length - 3] : null;
  const trend = latest && prev48h ? latest.apu_count - prev48h.apu_count : 0;

  return NextResponse.json({
    snapshots: snapshots || [],
    apu_users: apuUsers,
    current_apu_count: latest?.apu_count || apuUsers.length,
    apu_ratio: latest?.apu_ratio || 0,
    total_paying: latest?.total_paying || 0,
    trend,
    alerts,
  });
}
