import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the Rumi_App Supabase project (xdaxseboeioleiguqfkg).
 * Used to query session_evaluations and profiles for cross-project analytics.
 */
export const createRumiAppClient = () => {
  const url = process.env.RUMI_APP_SUPABASE_URL!.trim();
  const key = process.env.RUMI_APP_SUPABASE_SERVICE_KEY!.trim();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};
