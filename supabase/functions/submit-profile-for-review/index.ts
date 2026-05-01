import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { talentProfileSubmissionSchema } from "../_shared/schemas.ts";
import { slugify } from "../_shared/slug.ts";
import { createServiceRoleClient, createUserClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse({ error: "Authorization header is required." }, { status: 401 });
    }

    const userClient = createUserClient(authorization);
    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Invalid session." }, { status: 401 });
    }

    const payload = talentProfileSubmissionSchema.parse(await parseJsonBody(request));
    const serviceClient = createServiceRoleClient();
    const resolvedLocation = await resolveTalentLocation(serviceClient, payload);

    const { data: existingProfile } = await serviceClient
      .from("talent_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const normalizedProfile = {
      display_name: payload.displayName,
      full_name: payload.fullName,
      birth_date: payload.birthDate || null,
      city_id: resolvedLocation.cityId,
      state_id: resolvedLocation.stateId,
      bio: payload.bio?.trim() || null
    };

    const proposedMedia = [
      ...(payload.introVideo
        ? [
            {
              mediaKind: "intro_video",
              source: "upload",
              storageBucket: payload.introVideo.storageBucket,
              storagePath: payload.introVideo.storagePath,
              mimeType: payload.introVideo.mimeType,
              fileSizeBytes: payload.introVideo.fileSizeBytes,
              originalFileName: payload.introVideo.fileName
            }
          ]
        : []),
      ...payload.galleryImages.map((file, index) => ({
        mediaKind: "gallery_image",
        source: "upload",
        storageBucket: file.storageBucket,
        storagePath: file.storagePath,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
        originalFileName: file.fileName,
        sortOrder: index
      }))
    ];

    let profileId = existingProfile?.id as string | undefined;
    let profileStatus = existingProfile?.status ?? "draft";
    let requestType = payload.requestType ?? (existingProfile ? "profile_update" : "initial_submission");

    if (!existingProfile) {
      const baseSlug = slugify(payload.displayName || payload.fullName) || `talento-${createUniqueId().slice(0, 8)}`;
      let publicSlug = baseSlug;
      let suffix = 1;

      while (true) {
        const { data: slugConflict } = await serviceClient
          .from("talent_profiles")
          .select("id")
          .eq("public_slug", publicSlug)
          .maybeSingle();

        if (!slugConflict) {
          break;
        }

        suffix += 1;
        publicSlug = `${baseSlug}-${suffix}`;
      }

      const { data: createdProfile, error: profileError } = await serviceClient
        .from("talent_profiles")
        .insert({
          user_id: user.id,
          public_slug: publicSlug,
          ...normalizedProfile,
          status: "pending_review",
          submitted_at: new Date().toISOString(),
          rejection_reason: null
        })
        .select("id, status")
        .single();

      if (profileError || !createdProfile) {
        return jsonResponse({ error: profileError?.message ?? "Unable to create profile." }, { status: 400 });
      }

      profileId = createdProfile.id;
      profileStatus = createdProfile.status;
      requestType = "initial_submission";
    } else if (existingProfile.status === "pending_review") {
      return jsonResponse(
        {
          data: null,
          error: "Seu perfil ja esta em analise. Aguarde a revisao antes de enviar uma nova solicitacao."
        },
        { status: 409 }
      );
    } else {
      const { data: updatedProfile, error: updateError } = await serviceClient
        .from("talent_profiles")
        .update({
          ...normalizedProfile,
          status: "pending_review",
          submitted_at: new Date().toISOString(),
          rejection_reason: null
        })
        .eq("id", existingProfile.id)
        .select("id, status")
        .single();

      if (updateError || !updatedProfile) {
        return jsonResponse({ error: updateError?.message ?? "Unable to update profile." }, { status: 400 });
      }

      profileId = updatedProfile.id;
      profileStatus = updatedProfile.status;
      requestType = existingProfile.status === "draft" ? "initial_submission" : "profile_update";
    }

    const { data: pendingRequest } = await serviceClient
      .from("profile_change_requests")
      .select("id")
      .eq("talent_profile_id", profileId)
      .eq("status", "pending")
      .maybeSingle();

    const changeRequestPayload = {
      talent_profile_id: profileId,
      requested_by: user.id,
      request_type: requestType,
      proposed_profile: normalizedProfile,
      proposed_media: proposedMedia,
      review_notes: null,
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      applied_at: null,
      status: "pending"
    };

    const requestMutation = pendingRequest
      ? serviceClient
          .from("profile_change_requests")
          .update(changeRequestPayload)
          .eq("id", pendingRequest.id)
          .select("id")
          .single()
      : serviceClient.from("profile_change_requests").insert(changeRequestPayload).select("id").single();

    const { data: savedRequest, error: requestError } = await requestMutation;

    if (requestError || !savedRequest) {
      return jsonResponse({ error: requestError?.message ?? "Unable to save change request." }, { status: 400 });
    }

    await serviceClient.from("admin_audit_logs").insert({
      actor_user_id: user.id,
      entity_type: "talent_profile",
      entity_id: profileId,
      action: "submit_profile_for_review",
      metadata: {
        request_id: savedRequest.id,
        request_type: requestType
      }
    });

    return jsonResponse({
      data: {
        profileId,
        requestId: savedRequest.id,
        profileStatus,
        message:
          requestType === "initial_submission"
            ? "Perfil enviado para analise."
            : "Atualizacao enviada para analise."
      },
      error: null
    });
  } catch (error) {
    return jsonResponse(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unexpected error."
      },
      { status: 400 }
    );
  }
});

function createUniqueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  const randomPart = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}-${randomPart}`;
}

async function resolveTalentLocation(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  payload: {
    city?: string;
    stateCode?: string;
    cityId?: number;
    stateId?: number;
  }
) {
  if (typeof payload.cityId === "number" && typeof payload.stateId === "number") {
    const { data: city, error: cityError } = await serviceClient
      .from("cities")
      .select("ogc_fid, state_id")
      .eq("ogc_fid", payload.cityId)
      .maybeSingle();

    if (cityError) {
      throw new Error(cityError.message);
    }

    if (!city) {
      throw new Error("Cidade informada nao foi encontrada.");
    }

    if (city.state_id !== payload.stateId) {
      throw new Error("A cidade informada nao pertence ao estado selecionado.");
    }

    return {
      cityId: payload.cityId,
      stateId: payload.stateId
    };
  }

  if (!payload.city?.trim() || !payload.stateCode?.trim()) {
    throw new Error("Cidade e estado sao obrigatorios.");
  }

  const normalizedStateCode = payload.stateCode.trim().toUpperCase();
  const normalizedCityName = normalizeComparableText(payload.city);

  const { data: state, error: stateError } = await serviceClient
    .from("states")
    .select("id, sigla")
    .eq("sigla", normalizedStateCode)
    .maybeSingle();

  if (stateError) {
    throw new Error(stateError.message);
  }

  if (!state) {
    throw new Error("Estado informado nao foi encontrado.");
  }

  const { data: cities, error: citiesError } = await serviceClient
    .from("cities")
    .select("ogc_fid, nm_mun, state_id")
    .eq("state_id", state.id);

  if (citiesError) {
    throw new Error(citiesError.message);
  }

  const matchedCity = (cities ?? []).find((city) => normalizeComparableText(city.nm_mun) === normalizedCityName);

  if (!matchedCity) {
    throw new Error("Cidade informada nao foi encontrada para o estado selecionado.");
  }

  return {
    cityId: matchedCity.ogc_fid,
    stateId: state.id
  };
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase()
    .trim();
}
