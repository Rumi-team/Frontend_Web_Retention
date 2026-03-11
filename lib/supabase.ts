import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the Retention_Layer Supabase project.
 * Used ONLY for auth operations (verify-code, admin user management).
 * For retention data queries, use createRetentionDataClient() instead.
 */
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s+/g, "");
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s+/g, "");
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

/**
 * Service-role client for the Rumi_App Supabase project (xdaxseboeioleiguqfkg).
 * ALL retention data (events, decisions, rewards, flags, etc.) lives here.
 * Use this for any .schema("retention") queries.
 */
export const createRetentionDataClient = () => {
  const url = process.env.RUMI_APP_SUPABASE_URL!.replace(/\s+/g, "");
  const key = process.env.RUMI_APP_SUPABASE_SERVICE_KEY!.replace(/\s+/g, "");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};
