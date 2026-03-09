import { createRumiAppClient } from "./rumi-app";

/**
 * Coaching Bridge — fetches coaching session data from Rumi_App
 * and correlates it with retention events.
 *
 * Data flow:
 *   Rumi_App.session_evaluations → coaching quality metrics
 *   Rumi_App.profiles            → user info + plan status
 *   Retention_Layer.events       → session starts, engagement
 *   Retention_Layer.decisions    → RL actions taken
 */

export interface CoachingSession {
  id: string;
  provider_user_id: string;
  strategy_name: string | null;
  transformation_level: number | null;
  session_duration_minutes: number | null;
  created_at: string;
}

export interface CoachingProfile {
  id: string;
  provider_user_id: string;
  full_name: string | null;
  email: string | null;
  is_paying: boolean;
  plan_type: string | null;
  created_at: string;
}

export interface StrategyRetention {
  strategy: string;
  total_sessions: number;
  returned_within_48h: number;
  returned_within_7d: number;
  avg_transformation: number;
  retention_rate_48h: number;
  retention_rate_7d: number;
}

export interface TransformationRetention {
  level: number;
  session_count: number;
  returned_within_48h: number;
  retention_rate_48h: number;
}

/**
 * Check if Rumi_App cross-project access is configured.
 */
export function isRumiAppConfigured(): boolean {
  return !!(process.env.RUMI_APP_SUPABASE_URL && process.env.RUMI_APP_SUPABASE_SERVICE_KEY);
}

/**
 * Fetch recent coaching sessions from Rumi_App.session_evaluations.
 */
export async function fetchCoachingSessions(limit = 500): Promise<CoachingSession[]> {
  if (!isRumiAppConfigured()) return [];
  const client = createRumiAppClient();
  const { data, error } = await client
    .from("session_evaluations")
    .select("id,provider_user_id,strategy_name,transformation_level,session_duration_minutes,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("coaching-bridge: session_evaluations query failed:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch coaching sessions for a specific user.
 */
export async function fetchUserCoachingSessions(providerUserId: string): Promise<CoachingSession[]> {
  if (!isRumiAppConfigured()) return [];
  const client = createRumiAppClient();
  const { data } = await client
    .from("session_evaluations")
    .select("id,provider_user_id,strategy_name,transformation_level,session_duration_minutes,created_at")
    .eq("provider_user_id", providerUserId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

/**
 * Fetch user profiles from Rumi_App.profiles.
 */
export async function fetchProfiles(providerUserIds?: string[]): Promise<CoachingProfile[]> {
  if (!isRumiAppConfigured()) return [];
  const client = createRumiAppClient();
  let query = client
    .from("profiles")
    .select("id,provider_user_id,full_name,email,is_paying,plan_type,created_at")
    .order("created_at", { ascending: false });
  if (providerUserIds && providerUserIds.length > 0) {
    query = query.in("provider_user_id", providerUserIds);
  }
  const { data } = await query.limit(500);
  return data || [];
}

/**
 * Fetch a single user profile.
 */
export async function fetchUserProfile(providerUserId: string): Promise<CoachingProfile | null> {
  if (!isRumiAppConfigured()) return null;
  const client = createRumiAppClient();
  const { data } = await client
    .from("profiles")
    .select("id,provider_user_id,full_name,email,is_paying,plan_type,created_at")
    .eq("provider_user_id", providerUserId)
    .single();
  return data;
}
