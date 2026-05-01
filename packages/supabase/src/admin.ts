import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabaseEnv } from "./env";

export function createServiceRoleSupabaseClient(): SupabaseClient {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServiceSupabaseEnv();

  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
