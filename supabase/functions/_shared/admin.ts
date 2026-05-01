import type { User } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { createServiceRoleClient, createUserClient } from "./supabase.ts";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireAdminContext(authorization: string | null) {
  if (!authorization) {
    throw new HttpError(401, "Authorization header is required.");
  }

  const userClient = createUserClient(authorization);
  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new HttpError(401, "Invalid session.");
  }

  const serviceClient = createServiceRoleClient();
  await assertAdminUser(serviceClient, user);

  return {
    user,
    userClient,
    serviceClient
  };
}

async function assertAdminUser(serviceClient: ReturnType<typeof createServiceRoleClient>, user: User) {
  const { data: adminRecord, error } = await serviceClient
    .from("admins")
    .select("user_id, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!adminRecord) {
    throw new HttpError(403, "Admin access is required.");
  }
}
