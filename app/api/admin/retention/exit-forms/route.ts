import { NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createRetentionDataClient();

  // Reason distribution
  const { data: allForms } = await supabase
    .schema("retention")
    .from("exit_forms")
    .select("reason_category,submitted_at,provider_user_id,reason_detail,feedback,plan_at_exit,id")
    .order("submitted_at", { ascending: false });

  const forms = allForms || [];
  const total = forms.length;

  // Aggregate by reason
  const reasonCounts: Record<string, number> = {};
  for (const f of forms) {
    reasonCounts[f.reason_category] = (reasonCounts[f.reason_category] || 0) + 1;
  }

  const reason_summary = Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Daily trend (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const dailyCounts: Record<string, number> = {};
  for (const f of forms) {
    const day = f.submitted_at.slice(0, 10);
    if (day >= thirtyDaysAgo) {
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }
  }

  const trend = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Last 7 days count
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const last7d = forms.filter((f) => f.submitted_at >= sevenDaysAgo).length;

  // Recent entries (last 50)
  const recent = forms.slice(0, 50).map((f) => ({
    id: f.id,
    provider_user_id: f.provider_user_id,
    reason_category: f.reason_category,
    reason_detail: f.reason_detail,
    feedback: f.feedback,
    plan_at_exit: f.plan_at_exit,
    submitted_at: f.submitted_at,
  }));

  return NextResponse.json({
    total,
    last_7d: last7d,
    top_reason: reason_summary[0]?.reason || "none",
    reason_summary,
    trend,
    recent,
  });
}
