import { requireAdminContext, HttpError } from "../_shared/admin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { adminReviewTalentSchema } from "../_shared/schemas.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const { user, serviceClient } = await requireAdminContext(request.headers.get("Authorization"));
    const payload = adminReviewTalentSchema.parse(await parseJsonBody(request));
    const now = new Date().toISOString();

    const requestQuery = payload.changeRequestId
      ? serviceClient
          .from("profile_change_requests")
          .select("id, proposed_profile, proposed_media, request_type")
          .eq("id", payload.changeRequestId)
          .maybeSingle()
      : serviceClient
          .from("profile_change_requests")
          .select("id, proposed_profile, proposed_media, request_type")
          .eq("talent_profile_id", payload.profileId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    const { data: requestRecord, error: requestError } = await requestQuery;

    if (requestError) {
      throw new HttpError(400, requestError.message);
    }

    if (payload.decision === "approved") {
      const proposedProfile = sanitizeApprovedProfilePayload(isRecord(requestRecord?.proposed_profile) ? requestRecord.proposed_profile : {});
      const proposedMedia = Array.isArray(requestRecord?.proposed_media) ? requestRecord.proposed_media : [];

      const normalizedMedia = proposedMedia
        .filter(isRecord)
        .map((item, index) => ({
          talent_profile_id: payload.profileId,
          media_kind: toMediaKind(item.mediaKind),
          source: toMediaSource(item.source),
          storage_bucket: toNullableString(item.storageBucket),
          storage_path: toNullableString(item.storagePath),
          external_url: toNullableString(item.externalUrl),
          mime_type: toNullableString(item.mimeType),
          file_size_bytes: toNullableNumber(item.fileSizeBytes),
          sort_order: typeof item.sortOrder === "number" ? item.sortOrder : index,
          is_active: true
        }))
        .filter((item) => item.media_kind && item.source)
        .map((item) => ({
          talent_profile_id: item.talent_profile_id,
          media_kind: item.media_kind as "gallery_image" | "intro_video" | "profile_photo",
          source: item.source as "upload" | "youtube",
          storage_bucket: item.storage_bucket,
          storage_path: item.storage_path,
          external_url: item.external_url,
          mime_type: item.mime_type,
          file_size_bytes: item.file_size_bytes,
          sort_order: item.sort_order,
          is_active: item.is_active
        }));

      const { error: profileError } = await serviceClient
        .from("talent_profiles")
        .update({
          ...proposedProfile,
          status: "approved",
          reviewed_at: now,
          reviewed_by: user.id,
          rejection_reason: null,
          approved_change_request_id: requestRecord?.id ?? null
        })
        .eq("id", payload.profileId);

      if (profileError) {
        throw new HttpError(400, profileError.message);
      }

      if (requestRecord?.id) {
        const { error: updateRequestError } = await serviceClient
          .from("profile_change_requests")
          .update({
            status: "approved",
            reviewed_at: now,
            reviewed_by: user.id,
            rejection_reason: null,
            review_notes: null,
            applied_at: now
          })
          .eq("id", requestRecord.id);

        if (updateRequestError) {
          throw new HttpError(400, updateRequestError.message);
        }
      }

      const { error: deleteMediaError } = await serviceClient.from("talent_profile_media").delete().eq("talent_profile_id", payload.profileId);

      if (deleteMediaError) {
        throw new HttpError(400, deleteMediaError.message);
      }

      if (normalizedMedia.length > 0) {
        const { error: mediaError } = await serviceClient.from("talent_profile_media").insert(normalizedMedia);

        if (mediaError) {
          throw new HttpError(400, mediaError.message);
        }
      }

      await serviceClient.from("admin_audit_logs").insert({
        actor_user_id: user.id,
        entity_type: "talent_profile",
        entity_id: payload.profileId,
        action: "approve_profile",
        metadata: {
          request_id: requestRecord?.id ?? null
        }
      });

      return jsonResponse({
        profileId: payload.profileId,
        status: "approved",
        message: "Talento aprovado com sucesso."
      });
    }

    const rejectionReason = payload.reason ?? "Perfil reprovado pela equipe administrativa.";

    const { error: rejectProfileError } = await serviceClient
      .from("talent_profiles")
      .update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: user.id,
        rejection_reason: rejectionReason
      })
      .eq("id", payload.profileId);

    if (rejectProfileError) {
      throw new HttpError(400, rejectProfileError.message);
    }

    if (requestRecord?.id) {
      const { error: rejectRequestError } = await serviceClient
        .from("profile_change_requests")
        .update({
          status: "rejected",
          reviewed_at: now,
          reviewed_by: user.id,
          rejection_reason: rejectionReason,
          review_notes: rejectionReason
        })
        .eq("id", requestRecord.id);

      if (rejectRequestError) {
        throw new HttpError(400, rejectRequestError.message);
      }
    }

    await serviceClient.from("admin_audit_logs").insert({
      actor_user_id: user.id,
      entity_type: "talent_profile",
      entity_id: payload.profileId,
      action: "reject_profile",
      metadata: {
        request_id: requestRecord?.id ?? null,
        reason: rejectionReason
      }
    });

    return jsonResponse({
      profileId: payload.profileId,
      status: "rejected",
      message: "Talento reprovado com sucesso."
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;

    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error." }, { status });
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMediaKind(value: unknown) {
  return value === "gallery_image" || value === "intro_video" || value === "profile_photo" ? value : null;
}

function toMediaSource(value: unknown) {
  return value === "upload" || value === "youtube" ? value : null;
}

function sanitizeApprovedProfilePayload(value: Record<string, unknown>) {
  return {
    display_name: toNullableString(value.display_name) ?? toNullableString(value.displayName),
    full_name: toNullableString(value.full_name) ?? toNullableString(value.fullName),
    birth_date: toNullableString(value.birth_date) ?? toNullableString(value.birthDate),
    city_id: toNullableNumber(value.city_id) ?? toNullableNumber(value.cityId),
    state_id: toNullableNumber(value.state_id) ?? toNullableNumber(value.stateId),
    bio: toNullableString(value.bio)
  };
}
