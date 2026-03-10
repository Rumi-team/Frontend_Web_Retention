import { createRetentionDataClient } from "@/lib/supabase";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface SegmentResult {
  name: string;
  count: number;
  description: string;
  user_ids: string[];
}

function getSupabase() {
  return createRetentionDataClient();
}

export async function computeSegments(): Promise<SegmentResult[]> {
  const supabase = getSupabase();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - SEVEN_DAYS_MS).toISOString();
  const fourteenDaysAgo = new Date(now - FOURTEEN_DAYS_MS).toISOString();

  // Get all session events
  const { data: events } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start");

  if (!events?.length) {
    return [
      { name: "all_users", count: 0, description: "All tracked users", user_ids: [] },
      { name: "new_users", count: 0, description: "First session < 7 days ago", user_ids: [] },
      { name: "active_frequent", count: 0, description: "3+ sessions in last 14 days", user_ids: [] },
      { name: "lapsed", count: 0, description: "No session in last 14 days", user_ids: [] },
    ];
  }

  // Group by user
  const userSessions: Record<string, string[]> = {};
  for (const e of events) {
    const uid = e.provider_user_id;
    if (!userSessions[uid]) userSessions[uid] = [];
    userSessions[uid].push(e.timestamp);
  }

  const allUsers = Object.keys(userSessions);
  const newUsers: string[] = [];
  const activeFrequent: string[] = [];
  const lapsed: string[] = [];

  for (const [uid, timestamps] of Object.entries(userSessions)) {
    const sorted = timestamps.sort();
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];

    if (first >= sevenDaysAgo) newUsers.push(uid);

    const recentCount = sorted.filter((t) => t >= fourteenDaysAgo).length;
    if (recentCount >= 3) activeFrequent.push(uid);

    if (latest < fourteenDaysAgo) lapsed.push(uid);
  }

  return [
    { name: "all_users", count: allUsers.length, description: "All tracked users", user_ids: allUsers },
    { name: "new_users", count: newUsers.length, description: "First session < 7 days ago", user_ids: newUsers },
    { name: "active_frequent", count: activeFrequent.length, description: "3+ sessions in last 14 days", user_ids: activeFrequent },
    { name: "lapsed", count: lapsed.length, description: "No session in last 14 days", user_ids: lapsed },
  ];
}

export function classifyUser(
  sessions: string[],
  now: Date = new Date()
): string {
  if (!sessions.length) return "lapsed";
  const sorted = sessions.sort();
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - FOURTEEN_DAYS_MS).toISOString();

  if (first >= sevenDaysAgo) return "new_users";
  const recentCount = sorted.filter((t) => t >= fourteenDaysAgo).length;
  if (recentCount >= 3) return "active_frequent";
  if (latest < fourteenDaysAgo) return "lapsed";
  return "all_users";
}
