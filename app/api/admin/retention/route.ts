import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { fetchMetrics } from "@/lib/retention/client";

function isAuthorized(req: NextRequest): boolean {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  if (!ADMIN_SECRET) return true; // dev mode
  const cookie = req.cookies.get("admin_token")?.value;
  if (cookie === ADMIN_SECRET) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_SECRET}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
