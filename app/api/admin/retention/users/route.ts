import { NextRequest, NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";
import { classifyUser, isRealUser } from "@/lib/retention/segments";

export async function GET(req: NextRequest) {
  // Auth handled by middleware
  const supabase = createRetentionDataClient();

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

  // Group by user (exclude simulation IDs)
  const userMap: Record<
    string,
    { decision_count: number; last_contact: string }
  > = {};
  for (const d of decisionData) {
    const uid = d.provider_user_id;
    if (!isRealUser(uid)) continue;
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
