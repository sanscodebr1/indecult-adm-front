export function getSupabaseFunctionEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase Edge Function env vars are missing.");
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey
  };
}
