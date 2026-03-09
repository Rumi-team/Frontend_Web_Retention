import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all churn risk scores
  const { data: scores } = await supabase
    .schema("retention")
    .from("churn_risk_scores")
    .select("provider_user_id,score,factors,computed_at")
    .order("score", { ascending: false });

  const allScores = scores || [];

  // Risk distribution buckets
  const buckets = [
    { label: "0.0-0.2", min: 0, max: 0.2, count: 0 },
    { label: "0.2-0.4", min: 0.2, max: 0.4, count: 0 },
    { label: "0.4-0.6", min: 0.4, max: 0.6, count: 0 },
    { label: "0.6-0.8", min: 0.6, max: 0.8, count: 0 },
    { label: "0.8-1.0", min: 0.8, max: 1.01, count: 0 },
  ];

  for (const s of allScores) {
    for (const b of buckets) {
      if (s.score >= b.min && s.score < b.max) {
        b.count++;
        break;
      }
    }
  }

  // Tier counts
  const highRisk = allScores.filter((s) => s.score >= 0.7).length;
  const mediumRisk = allScores.filter((s) => s.score >= 0.4 && s.score < 0.7).length;
  const lowRisk = allScores.filter((s) => s.score < 0.4).length;

  // Get last session date per user for top at-risk
  const atRiskUsers = allScores.filter((s) => s.score >= 0.4).slice(0, 50);
  const atRiskIds = atRiskUsers.map((u) => u.provider_user_id);

  let lastSessions: Record<string, string> = {};
  if (atRiskIds.length > 0) {
    const { data: metrics } = await supabase
      .schema("retention")
      .from("session_metrics")
      .select("provider_user_id,date")
      .in("provider_user_id", atRiskIds)
      .order("date", { ascending: false });

    for (const m of metrics || []) {
      if (!lastSessions[m.provider_user_id]) {
        lastSessions[m.provider_user_id] = m.date;
      }
    }
  }

  // Check if RL intervention was already triggered
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  let userInterventions: Record<string, string> = {};
  if (atRiskIds.length > 0) {
    const { data: decisions } = await supabase
      .schema("retention")
      .from("decisions")
      .select("provider_user_id,action_chosen")
      .in("provider_user_id", atRiskIds)
      .neq("action_chosen", "no_action")
      .gte("created_at", sevenDaysAgo);

    for (const d of decisions || []) {
      userInterventions[d.provider_user_id] = d.action_chosen;
    }
  }

  const at_risk_users = atRiskUsers.map((u) => {
    // Find top factor
    const factors = u.factors as Record<string, number>;
    let topFactor = "";
    let topValue = 0;
    for (const [key, val] of Object.entries(factors)) {
      if (val > topValue) { topFactor = key; topValue = val; }
    }

    return {
      user_id: u.provider_user_id,
      score: u.score,
      factors: u.factors,
      top_factor: topFactor,
      last_session: lastSessions[u.provider_user_id] || null,
      computed_at: u.computed_at,
      rl_intervention: userInterventions[u.provider_user_id] || null,
    };
  });

  // Correlation data (RL feature candidates)
  const { data: correlations } = await supabase
    .schema("retention")
    .from("correlation_cache")
    .select("*")
    .order("odds_ratio", { ascending: false })
    .limit(20);

  return NextResponse.json({
    high_risk: highRisk,
    medium_risk: mediumRisk,
    low_risk: lowRisk,
    total: allScores.length,
    risk_distribution: buckets.map((b) => ({ bucket: b.label, count: b.count })),
    at_risk_users,
    correlations: correlations || [],
  });
}
