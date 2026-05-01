import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@indecult/supabase/server";

export async function getOptionalUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function requireUser() {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
