import { NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";
import { isRealUser } from "@/lib/retention/segments";

/**
 * Default funnel: First Visit → Second Session → Weekly User → Repeat Weekly → APU
 */
export async function GET() {
  const supabase = createRetentionDataClient();

  // Get all session_start events per user
  const { data: events } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start")
    .order("timestamp", { ascending: true });

  if (!events?.length) {
    return NextResponse.json({ funnel_name: "Default Funnel", steps: [], total_users: 0 });
  }

  // Group by user (exclude simulation IDs)
  const userSessions: Record<string, Date[]> = {};
  for (const e of events) {
    if (!isRealUser(e.provider_user_id)) continue;
    if (!userSessions[e.provider_user_id]) userSessions[e.provider_user_id] = [];
    userSessions[e.provider_user_id].push(new Date(e.timestamp));
  }

  const totalUsers = Object.keys(userSessions).length;

  // Step 1: First Visit (any user with at least 1 session)
  const step1Users = new Set(Object.keys(userSessions));

  // Step 2: Second Session within 7 days of first
  const step2Users = new Set<string>();
  for (const [uid, dates] of Object.entries(userSessions)) {
    if (dates.length < 2) continue;
    const first = dates[0].getTime();
    const hasSecond = dates.slice(1).some((d) => d.getTime() - first <= 7 * 86400000);
    if (hasSecond) step2Users.add(uid);
  }

  // Step 3: Weekly User (3+ sessions in any 7-day window)
  const step3Users = new Set<string>();
  for (const [uid, dates] of Object.entries(userSessions)) {
    if (dates.length < 3) continue;
    for (let i = 0; i < dates.length; i++) {
      const windowEnd = dates[i].getTime() + 7 * 86400000;
      const inWindow = dates.filter((d) => d.getTime() >= dates[i].getTime() && d.getTime() <= windowEnd);
      if (inWindow.length >= 3) { step3Users.add(uid); break; }
    }
  }

  // Step 4: Repeat Weekly (must be a Weekly User AND active in 2+ consecutive weeks)
  const step4Users = new Set<string>();
  for (const uid of step3Users) {
    const dates = userSessions[uid];
    const weeks = new Set(dates.map((d) => {
      const start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      return start.toISOString().slice(0, 10);
    }));
    const sortedWeeks = [...weeks].sort();
    for (let i = 1; i < sortedWeeks.length; i++) {
      const prev = new Date(sortedWeeks[i - 1]);
      const curr = new Date(sortedWeeks[i]);
      if (curr.getTime() - prev.getTime() <= 8 * 86400000) {
        step4Users.add(uid);
        break;
      }
    }
  }

  // Step 5: Power User / APU (4+ sessions in trailing 7 days — use latest data)
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const step5Users = new Set<string>();
  for (const [uid, dates] of Object.entries(userSessions)) {
    const recentCount = dates.filter((d) => d.getTime() >= sevenDaysAgo).length;
    if (recentCount >= 4) step5Users.add(uid);
  }

  const steps = [
    { name: "First Visit", event_type: "session_start", count: step1Users.size, conversion_rate: 100, drop_off: 0 },
    { name: "Second Session (7d)", event_type: "session_start_2", count: step2Users.size, conversion_rate: totalUsers > 0 ? Math.round((step2Users.size / totalUsers) * 1000) / 10 : 0, drop_off: step1Users.size - step2Users.size },
    { name: "Weekly User (3+/wk)", event_type: "weekly_user", count: step3Users.size, conversion_rate: totalUsers > 0 ? Math.round((step3Users.size / totalUsers) * 1000) / 10 : 0, drop_off: step2Users.size - step3Users.size },
    { name: "Repeat Weekly", event_type: "repeat_weekly", count: step4Users.size, conversion_rate: totalUsers > 0 ? Math.round((step4Users.size / totalUsers) * 1000) / 10 : 0, drop_off: step3Users.size - step4Users.size },
    { name: "Power User (APU)", event_type: "apu", count: step5Users.size, conversion_rate: totalUsers > 0 ? Math.round((step5Users.size / totalUsers) * 1000) / 10 : 0, drop_off: step4Users.size - step5Users.size },
  ];

  // A/B comparison: if flag_assignments exist, compute funnels per variant
  const { data: flags } = await supabase
    .schema("retention")
    .from("flag_assignments")
    .select("provider_user_id,variant")
    .eq("flag_name", "retention_bandit_v1");

  let ab_comparison = null;
  if (flags && flags.length > 0) {
    const controlIds = new Set(flags.filter((f) => f.variant === "control").map((f) => f.provider_user_id));
    const treatmentIds = new Set(flags.filter((f) => f.variant === "treatment").map((f) => f.provider_user_id));

    const countIn = (stepSet: Set<string>, groupSet: Set<string>) => {
      let count = 0;
      for (const uid of stepSet) if (groupSet.has(uid)) count++;
      return count;
    };

    ab_comparison = {
      control: {
        total: controlIds.size,
        steps: [
          countIn(step1Users, controlIds),
          countIn(step2Users, controlIds),
          countIn(step3Users, controlIds),
          countIn(step4Users, controlIds),
          countIn(step5Users, controlIds),
        ],
      },
      treatment: {
        total: treatmentIds.size,
        steps: [
          countIn(step1Users, treatmentIds),
          countIn(step2Users, treatmentIds),
          countIn(step3Users, treatmentIds),
          countIn(step4Users, treatmentIds),
          countIn(step5Users, treatmentIds),
        ],
      },
    };
  }

  return NextResponse.json({
    funnel_name: "Default Funnel",
    steps,
    total_users: totalUsers,
    ab_comparison,
  });
}
