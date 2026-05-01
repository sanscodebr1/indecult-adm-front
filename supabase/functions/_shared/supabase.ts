import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getSupabaseFunctionEnv } from "./env.ts";

export function createServiceRoleClient() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseFunctionEnv();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createUserClient(authorization: string) {
  const { supabaseUrl, anonKey } = getSupabaseFunctionEnv();

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
