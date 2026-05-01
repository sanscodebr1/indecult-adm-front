import type { SupabaseClient, User } from "@supabase/supabase-js";
import { authCredentialsSchema, type AuthCredentialsInput } from "./schemas";

export async function signUpWithEmailAndPassword(client: SupabaseClient, input: AuthCredentialsInput) {
  const payload = authCredentialsSchema.parse(input);

  return client.auth.signUp({
    email: payload.email,
    password: payload.password
  });
}

export async function signInWithEmailAndPassword(client: SupabaseClient, input: AuthCredentialsInput) {
  const payload = authCredentialsSchema.parse(input);

  return client.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  });
}

export async function signOut(client: SupabaseClient) {
  return client.auth.signOut();
}

export async function getCurrentSession(client: SupabaseClient) {
  return client.auth.getSession();
}

export async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();

  if (error) {
    return null;
  }

  return data.user ?? null;
}
