import { requireAdminContext, HttpError } from "../_shared/admin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { adminListTalentsSchema } from "../_shared/schemas.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const { serviceClient } = await requireAdminContext(request.headers.get("Authorization"));
    adminListTalentsSchema.parse(await parseJsonBody(request));

    const { data: profiles, error: profilesError } = await serviceClient
      .from("talent_profiles")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (profilesError) {
      throw new HttpError(400, profilesError.message);
    }

    const typedProfiles = profiles ?? [];

    if (typedProfiles.length === 0) {
      return jsonResponse({ items: [] });
    }

    const userIds = [...new Set(typedProfiles.map((profile) => profile.user_id))];
    const profileIds = typedProfiles.map((profile) => profile.id);
    const cityIds = [...new Set(typedProfiles.map((profile) => profile.city_id).filter((value): value is number => typeof value === "number"))];
    const stateIds = [...new Set(typedProfiles.map((profile) => profile.state_id).filter((value): value is number => typeof value === "number"))];

    const [{ data: users, error: usersError }, { data: media, error: mediaError }, { data: requests, error: requestsError }, { data: cities }, { data: states }] =
      await Promise.all([
      serviceClient.from("app_users").select("id, email, display_name, account_status").in("id", userIds),
      serviceClient
        .from("talent_profile_media")
        .select("id, talent_profile_id, media_kind, source, storage_bucket, storage_path, external_url, mime_type, file_size_bytes, sort_order, is_active, created_at, updated_at")
        .in("talent_profile_id", profileIds)
        .order("sort_order", { ascending: true }),
      serviceClient
        .from("profile_change_requests")
        .select(
          "id, talent_profile_id, requested_by, request_type, status, proposed_profile, proposed_media, review_notes, reviewed_at, reviewed_by, rejection_reason, applied_at, created_at, updated_at"
        )
        .in("talent_profile_id", profileIds)
        .order("created_at", { ascending: false }),
      cityIds.length > 0 ? serviceClient.from("cities").select("ogc_fid, nm_mun, state_id").in("ogc_fid", cityIds) : Promise.resolve({ data: [] }),
      stateIds.length > 0 ? serviceClient.from("states").select("id, sigla, name").in("id", stateIds) : Promise.resolve({ data: [] })
    ]);

    if (usersError) {
      throw new HttpError(400, usersError.message);
    }

    if (mediaError) {
      throw new HttpError(400, mediaError.message);
    }

    if (requestsError) {
      throw new HttpError(400, requestsError.message);
    }

    const userMap = new Map((users ?? []).map((user) => [user.id, user]));
    const cityMap = new Map(((cities ?? []) as Array<{ ogc_fid: number; nm_mun: string; state_id: number }>).map((city) => [city.ogc_fid, city]));
    const stateMap = new Map(((states ?? []) as Array<{ id: number; sigla: string; name?: string }>).map((state) => [state.id, state]));
    const mediaMap = groupBy(media ?? [], (item) => item.talent_profile_id);
    const requestMap = groupBy(requests ?? [], (item) => item.talent_profile_id);

    const itemPromises = typedProfiles.map(async (profile) => {
      const groupedRequests = requestMap.get(profile.id) ?? [];
      const profileMedia = mediaMap.get(profile.id) ?? [];

      const mediaWithUrls = await Promise.all(
        profileMedia.map(async (item) => ({
          ...item,
          signed_url: item.source === "upload" && item.storage_bucket && item.storage_path
            ? await generateSignedUrl(serviceClient, item.storage_bucket, item.storage_path)
            : item.external_url
        }))
      );

      const pendingRequest = groupedRequests.find((request) => request.status === "pending");
      const pendingMediaWithUrls = pendingRequest && Array.isArray(pendingRequest.proposed_media)
        ? await Promise.all(
            pendingRequest.proposed_media
              .filter(isRecord)
              .map(async (item) => {
                const storageBucket = toNullableString(item.storageBucket);
                const storagePath = toNullableString(item.storagePath);
                return {
                  ...item,
                  signed_url: item.source === "upload" && storageBucket && storagePath
                    ? await generateSignedUrl(serviceClient, storageBucket, storagePath)
                    : toNullableString(item.externalUrl)
                };
              })
          )
        : [];

      return {
        profile: {
          ...profile,
          city_name: profile.city ?? (profile.city_id ? cityMap.get(profile.city_id)?.nm_mun ?? null : null),
          state_sigla: profile.state_code ?? (profile.state_id ? stateMap.get(profile.state_id)?.sigla ?? null : null)
        },
        user: userMap.get(profile.user_id) ?? null,
        media: mediaWithUrls,
        requests: groupedRequests,
        pendingRequest: pendingRequest ? { ...pendingRequest, proposed_media: pendingMediaWithUrls } : null
      };
    });

    const mappedItems = await Promise.all(itemPromises);
    const items = mappedItems.sort((left, right) => {
      if (left.profile.status === "pending_review" && right.profile.status !== "pending_review") {
        return -1;
      }

      if (left.profile.status !== "pending_review" && right.profile.status === "pending_review") {
        return 1;
      }

      return new Date(right.profile.submitted_at ?? right.profile.updated_at).getTime() - new Date(left.profile.submitted_at ?? left.profile.updated_at).getTime();
    });

    return jsonResponse({ items });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;

    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error." }, { status });
  }
});

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const current = map.get(key) ?? [];
    current.push(item);
    map.set(key, current);
  }

  return map;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function generateSignedUrl(client: any, bucket: string, path: string): Promise<string | null> {
  try {
    const expiresIn = 60 * 60 * 24 * 7; // 7 days
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      console.error(`Failed to generate signed URL for ${bucket}/${path}:`, error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error(`Error generating signed URL for ${bucket}/${path}:`, err);
    return null;
  }
}
