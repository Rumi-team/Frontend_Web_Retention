import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { fetchMetrics } from "@/lib/retention/client";

export async function GET() {
  // Auth handled by middleware
  const supabase = createServerSupabaseClient();
  const metrics = await fetchMetrics();

  // Get recent decisions with action_payload
  const { data: recentDecisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select(
      "id,provider_user_id,action_chosen,action_payload,was_exploration,policy_version,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    metrics: metrics || {},
    recent_decisions: recentDecisions || [],
  });
}
