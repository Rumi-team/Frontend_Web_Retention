import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const planPrice = parseInt(process.env.PLAN_PRICE_MONTHLY || "29");

  // Get active users per month from session_metrics
  const { data: metrics } = await supabase
    .schema("retention")
    .from("session_metrics")
    .select("provider_user_id,date,session_count")
    .order("date", { ascending: true });

  // Group by month → unique active users
  const monthlyActiveUsers: Record<string, Set<string>> = {};
  for (const m of metrics || []) {
    const month = m.date.slice(0, 7); // YYYY-MM
    if (!monthlyActiveUsers[month]) monthlyActiveUsers[month] = new Set();
    monthlyActiveUsers[month].add(m.provider_user_id);
  }

  // Estimate MRR = active users × plan price (simplified)
  // In reality, need subscription data from Rumi_App
  let payingUserCount = 0;
  try {
    const rumiAppUrl = process.env.RUMI_APP_SUPABASE_URL;
    const rumiAppKey = process.env.RUMI_APP_SUPABASE_SERVICE_KEY;
    if (rumiAppUrl && rumiAppKey) {
      const rumiApp = createClient(rumiAppUrl, rumiAppKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { count } = await rumiApp
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_paying", true);
      payingUserCount = count || 0;
    }
  } catch {
    // Fallback: estimate from latest month's active users
    const months = Object.keys(monthlyActiveUsers).sort();
    const latestMonth = months[months.length - 1];
    payingUserCount = latestMonth ? monthlyActiveUsers[latestMonth].size : 0;
  }

  const mrr = payingUserCount * planPrice;

  const mrr_trend = Object.entries(monthlyActiveUsers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, users]) => ({
      date: month,
      mrr: users.size * planPrice,
    }));

  // Churn rate: users active last month but not this month
  const months = Object.keys(monthlyActiveUsers).sort();
  let churnRate = 0;
  if (months.length >= 2) {
    const prevMonth = monthlyActiveUsers[months[months.length - 2]];
    const currMonth = monthlyActiveUsers[months[months.length - 1]];
    let churned = 0;
    for (const uid of prevMonth) {
      if (!currMonth.has(uid)) churned++;
    }
    churnRate = prevMonth.size > 0 ? Math.round((churned / prevMonth.size) * 1000) / 10 : 0;
  }

  // LTV estimate: ARPU / churn_rate_decimal
  const churnDecimal = churnRate / 100;
  const ltv = churnDecimal > 0 ? Math.round(planPrice / churnDecimal) : planPrice * 12;

  // Revenue at risk: from churn_risk_scores > 0.7
  const { data: highRiskUsers } = await supabase
    .schema("retention")
    .from("churn_risk_scores")
    .select("provider_user_id")
    .gte("score", 0.7);

  const revenueAtRisk = (highRiskUsers?.length || 0) * planPrice;

  return NextResponse.json({
    mrr,
    mrr_trend,
    churn_rate: churnRate,
    ltv_estimate: ltv,
    revenue_at_risk: revenueAtRisk,
    total_customers: payingUserCount,
    plan_price: planPrice,
    is_estimated: !process.env.RUMI_APP_SUPABASE_URL,
  });
}
