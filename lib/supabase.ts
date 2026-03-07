import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for admin DB queries.
 * For auth session handling, use lib/supabase/server.ts or lib/supabase/client.ts.
 */
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};
