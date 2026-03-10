import { NextRequest, NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";
import { fetchPosteriors } from "@/lib/retention/client";
import { classifyUser } from "@/lib/retention/segments";
import { fetchUserCoachingSessions, fetchUserProfile } from "@/lib/supabase/coaching-bridge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  // Auth handled by middleware
  const supabase = createRetentionDataClient();

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

  // Coaching data from Rumi_App (cross-project)
  const [coachingSessions, profile] = await Promise.all([
    fetchUserCoachingSessions(userId),
    fetchUserProfile(userId),
  ]);

  return NextResponse.json({
    user_id: userId,
    segment,
    decision_count: decisions?.length || 0,
    last_contact: lastContact,
    posteriors: posteriorData?.posteriors || {},
    recent_decisions: decisions || [],
    recent_events: events || [],
    coaching: {
      profile: profile ? {
        full_name: profile.full_name,
        email: profile.email,
        is_paying: profile.is_paying,
        plan_type: profile.plan_type,
        joined: profile.created_at,
      } : null,
      sessions: coachingSessions.map((s) => ({
        strategy: s.strategy_name,
        transformation_level: s.transformation_level,
        duration_minutes: s.session_duration_minutes,
        date: s.created_at,
      })),
      total_sessions: coachingSessions.length,
      avg_transformation: coachingSessions.length > 0
        ? Math.round(
            coachingSessions
              .filter((s) => s.transformation_level != null)
              .reduce((sum, s) => sum + (s.transformation_level || 0), 0) /
            Math.max(coachingSessions.filter((s) => s.transformation_level != null).length, 1) * 10
          ) / 10
        : null,
    },
  });
}
