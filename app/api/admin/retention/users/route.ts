import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 50;
  const offset = (page - 1) * limit;

  // Get unique users from decisions
  const { data: decisionData } = await supabase
    .schema("retention")
    .from("decisions")
    .select("provider_user_id,created_at")
    .order("created_at", { ascending: false });

  if (!decisionData?.length) {
    return NextResponse.json({ users: [], total: 0, page });
  }

  // Group by user
  const userMap: Record<
    string,
    { decision_count: number; last_contact: string }
  > = {};
  for (const d of decisionData) {
    const uid = d.provider_user_id;
    if (!userMap[uid]) {
      userMap[uid] = { decision_count: 0, last_contact: d.created_at };
    }
    userMap[uid].decision_count++;
  }

  // Get session events for segment classification
  const { data: eventData } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start");

  const userSessions: Record<string, string[]> = {};
  for (const e of eventData || []) {
    if (!userSessions[e.provider_user_id])
      userSessions[e.provider_user_id] = [];
    userSessions[e.provider_user_id].push(e.timestamp);
  }

  const allUserIds = Object.keys(userMap);
  const total = allUserIds.length;
  const pageUsers = allUserIds.slice(offset, offset + limit);

  const users = pageUsers.map((uid) => ({
    user_id: uid,
    segment: classifyUser(userSessions[uid] || []),
    decision_count: userMap[uid].decision_count,
    last_contact: userMap[uid].last_contact,
  }));

  return NextResponse.json({ users, total, page });
}
