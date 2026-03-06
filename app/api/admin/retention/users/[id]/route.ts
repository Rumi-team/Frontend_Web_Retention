import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchPosteriors } from "@/lib/retention/client";
import { classifyUser } from "@/lib/retention/segments";

function isAuthorized(req: NextRequest): boolean {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  if (!ADMIN_SECRET) return true; // dev mode
  const cookie = req.cookies.get("admin_token")?.value;
  if (cookie === ADMIN_SECRET) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_SECRET}`) return true;
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Posteriors from retention API
  const posteriorData = await fetchPosteriors(userId);

  // Recent decisions
  const { data: decisions } = await supabase
    .schema("retention")
    .from("decisions")
    .select(
      "id,action_chosen,action_payload,was_exploration,policy_version,created_at"
    )
    .eq("provider_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Recent events
  const { data: events } = await supabase
    .schema("retention")
    .from("events")
    .select("event_type,timestamp,properties")
    .eq("provider_user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(50);

  // Session events for segment classification
  const sessionTimestamps = (events || [])
    .filter((e) => e.event_type === "session_start")
    .map((e) => e.timestamp);

  const segment = classifyUser(sessionTimestamps);
  const lastContact =
    decisions && decisions.length > 0 ? decisions[0].created_at : null;

  return NextResponse.json({
    user_id: userId,
    segment,
    decision_count: decisions?.length || 0,
    last_contact: lastContact,
    posteriors: posteriorData?.posteriors || {},
    recent_decisions: decisions || [],
    recent_events: events || [],
  });
}
