"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createServiceRoleSupabaseClient } from "@indecult/supabase/admin";
import { reviewAdminTalent } from "@indecult/supabase";
import { createServerSupabaseClient } from "@indecult/supabase/server";
import { z } from "zod";
import { requireAdminViewer } from "../../lib/admin";

const approveTalentSchema = z.object({
  profileId: z.string().uuid("Perfil invalido."),
  changeRequestId: z.string().uuid("Solicitacao invalida.").optional().or(z.literal(""))
});

const rejectTalentSchema = z.object({
  profileId: z.string().uuid("Perfil invalido."),
  changeRequestId: z.string().uuid("Solicitacao invalida.").optional().or(z.literal("")),
  reason: z.string().trim().min(3, "Informe um motivo com pelo menos 3 caracteres.")
});

const electionFormSchema = z.object({
  title: z.string().trim().min(3, "Informe um titulo com ao menos 3 caracteres."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  coverUrl: z.string().trim().optional(),
  visibility: z.enum(["public", "private"]),
  status: z.enum(["draft", "scheduled", "live", "paused", "finished", "cancelled"]),
  startsAt: z.string().min(1, "Informe a data de inicio."),
  endsAt: z.string().min(1, "Informe a data de encerramento."),
  allowPublicResults: z.boolean(),
  maxVotesPerIpPerDay: z.number().int().positive().nullable(),
  maxVotesPerFingerprintPerDay: z.number().int().positive().nullable()
});

const createElectionSchema = electionFormSchema.refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
    message: "A data de encerramento precisa ser maior do que a data de inicio.",
    path: ["endsAt"]
  });

const updateElectionSchema = electionFormSchema
  .extend({
    electionId: z.string().uuid("Eleicao invalida.")
  })
  .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
    message: "A data de encerramento precisa ser maior do que a data de inicio.",
    path: ["endsAt"]
  });

const createElectionCategorySchema = z.object({
  electionId: z.string().uuid("Eleicao invalida."),
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  displayOrder: z.number().int().min(0).nullable()
});

const assignElectionCandidatesSchema = z.object({
  electionId: z.string().uuid("Eleicao invalida."),
  categoryId: z.string().uuid("Categoria invalida."),
  profileIds: z.array(z.string().uuid("Perfil invalido.")).min(1, "Selecione ao menos um talento.")
});

const importElectionCandidatesByStateSchema = z.object({
  electionId: z.string().uuid("Eleicao invalida."),
  categoryId: z.string().uuid("Categoria invalida."),
  stateId: z.number().int().positive("Estado invalido.")
});

const updateElectionCategorySchema = z.object({
  electionId: z.string().uuid("Eleicao invalida."),
  categoryId: z.string().uuid("Categoria invalida."),
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  displayOrder: z.number().int().min(0).nullable(),
  isActive: z.boolean()
});

const deleteElectionCategorySchema = z.object({
  electionId: z.string().uuid("Eleicao invalida."),
  categoryId: z.string().uuid("Categoria invalida.")
});

const removeElectionParticipantSchema = z.object({
  electionId: z.string().uuid("Eleicao invalida."),
  electionCandidateId: z.string().uuid("Participante invalido.")
});

export async function approveTalentProfileAction(formData: FormData) {
  const parsed = approveTalentSchema.safeParse({
    profileId: String(formData.get("profileId") ?? ""),
    changeRequestId: String(formData.get("changeRequestId") ?? "")
  });

  if (!parsed.success) {
    redirect("/dashboard/talentos" as Route);
  }

  await requireAdminViewer();
  const supabase = await createServerSupabaseClient();
  const profileId = parsed.data.profileId;
  const result = await reviewAdminTalent(supabase, {
    profileId,
    changeRequestId: parsed.data.changeRequestId || null,
    decision: "approved"
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  revalidatePath("/dashboard/talentos");
  revalidatePath(`/dashboard/talentos/${profileId}`);
  redirect(`/dashboard/talentos/${profileId}` as Route);
}

export async function rejectTalentProfileAction(formData: FormData) {
  const parsed = rejectTalentSchema.safeParse({
    profileId: String(formData.get("profileId") ?? ""),
    changeRequestId: String(formData.get("changeRequestId") ?? ""),
    reason: String(formData.get("reason") ?? "")
  });

  if (!parsed.success) {
    redirect("/dashboard/talentos" as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const profileId = parsed.data.profileId;
  const reason = parsed.data.reason;

  const { error: profileError } = await serviceClient
    .from("talent_profiles")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: admin.id,
      rejection_reason: reason
    })
    .eq("id", profileId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (parsed.data.changeRequestId) {
    const { error: requestError } = await serviceClient
      .from("profile_change_requests")
      .update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: admin.id,
        rejection_reason: reason,
        review_notes: reason
      })
      .eq("id", parsed.data.changeRequestId);

    if (requestError) {
      throw new Error(requestError.message);
    }
  }

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "talent_profile",
    entity_id: profileId,
    action: "reject_profile",
    metadata: {
      reason
    }
  });

  revalidatePath("/dashboard/talentos");
  revalidatePath(`/dashboard/talentos/${profileId}`);
  redirect(`/dashboard/talentos/${profileId}` as Route);
}

export async function createElectionAction(formData: FormData) {
  const parsed = createElectionSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
    coverUrl: String(formData.get("coverUrl") ?? ""),
    visibility: String(formData.get("visibility") ?? "public"),
    status: String(formData.get("status") ?? "draft"),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    allowPublicResults: formData.get("allowPublicResults") === "on",
    maxVotesPerIpPerDay: parseOptionalPositiveInteger(formData.get("maxVotesPerIpPerDay")),
    maxVotesPerFingerprintPerDay: parseOptionalPositiveInteger(formData.get("maxVotesPerFingerprintPerDay"))
  });

  if (!parsed.success) {
    redirect("/dashboard/eleicoes/nova" as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const baseSlug = slugify(parsed.data.slug || parsed.data.title);
  const slug = await ensureUniqueElectionSlug(serviceClient, baseSlug);
  const publishedAt = parsed.data.status === "draft" ? null : new Date().toISOString();
  const assetScopeKey = crypto.randomUUID();
  const logoFile = getOptionalFormFile(formData, "logoFile");
  const coverFile = getOptionalFormFile(formData, "coverFile");
  const logoUrl = logoFile
    ? await uploadElectionAsset(serviceClient, logoFile, "logo", assetScopeKey)
    : toNullableString(parsed.data.logoUrl);
  const coverUrl = coverFile
    ? await uploadElectionAsset(serviceClient, coverFile, "cover", assetScopeKey)
    : toNullableString(parsed.data.coverUrl);

  const { data: election, error } = await serviceClient
    .from("elections")
    .insert({
      slug,
      title: parsed.data.title,
      description: parsed.data.description || null,
      logo_url: logoUrl,
      cover_url: coverUrl,
      visibility: parsed.data.visibility,
      status: parsed.data.status,
      starts_at: new Date(parsed.data.startsAt).toISOString(),
      ends_at: new Date(parsed.data.endsAt).toISOString(),
      published_at: publishedAt,
      allow_public_results: parsed.data.allowPublicResults,
      max_votes_per_ip_per_day: parsed.data.maxVotesPerIpPerDay,
      max_votes_per_fingerprint_per_day: parsed.data.maxVotesPerFingerprintPerDay,
      created_by: admin.id,
      updated_by: admin.id
    })
    .select("id")
    .single();

  if (error || !election) {
    throw new Error(error?.message ?? "Nao foi possivel criar a eleicao.");
  }

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: election.id,
    action: "create_election",
    metadata: {
      slug,
      status: parsed.data.status
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/eleicoes");
  revalidatePath("/dashboard/eleicoes/nova");
  redirect("/dashboard/eleicoes?created=1" as unknown as Route);
}

export async function updateElectionAction(formData: FormData) {
  const parsed = updateElectionSchema.safeParse({
    electionId: String(formData.get("electionId") ?? ""),
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
    coverUrl: String(formData.get("coverUrl") ?? ""),
    visibility: String(formData.get("visibility") ?? "public"),
    status: String(formData.get("status") ?? "draft"),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    allowPublicResults: formData.get("allowPublicResults") === "on",
    maxVotesPerIpPerDay: parseOptionalPositiveInteger(formData.get("maxVotesPerIpPerDay")),
    maxVotesPerFingerprintPerDay: parseOptionalPositiveInteger(formData.get("maxVotesPerFingerprintPerDay"))
  });

  if (!parsed.success) {
    redirect(`/dashboard/eleicoes/${String(formData.get("electionId") ?? "")}?tab=overview` as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const logoFile = getOptionalFormFile(formData, "logoFile");
  const coverFile = getOptionalFormFile(formData, "coverFile");
  const { data: existingElection, error: existingElectionError } = await serviceClient
    .from("elections")
    .select("id, published_at, logo_url, cover_url")
    .eq("id", parsed.data.electionId)
    .maybeSingle();

  if (existingElectionError) {
    throw new Error(existingElectionError.message);
  }

  if (!existingElection) {
    throw new Error("Eleicao nao encontrada.");
  }

  const baseSlug = slugify(parsed.data.slug || parsed.data.title);
  const slug = await ensureUniqueElectionSlug(serviceClient, baseSlug, parsed.data.electionId);
  const publishedAt =
    parsed.data.status === "draft"
      ? null
      : existingElection.published_at ?? new Date().toISOString();
  const logoUrl = logoFile
    ? await uploadElectionAsset(serviceClient, logoFile, "logo", parsed.data.electionId)
    : toNullableString(parsed.data.logoUrl) ?? existingElection.logo_url ?? null;
  const coverUrl = coverFile
    ? await uploadElectionAsset(serviceClient, coverFile, "cover", parsed.data.electionId)
    : toNullableString(parsed.data.coverUrl) ?? existingElection.cover_url ?? null;

  const { error } = await serviceClient
    .from("elections")
    .update({
      slug,
      title: parsed.data.title,
      description: parsed.data.description || null,
      logo_url: logoUrl,
      cover_url: coverUrl,
      visibility: parsed.data.visibility,
      status: parsed.data.status,
      starts_at: new Date(parsed.data.startsAt).toISOString(),
      ends_at: new Date(parsed.data.endsAt).toISOString(),
      published_at: publishedAt,
      allow_public_results: parsed.data.allowPublicResults,
      max_votes_per_ip_per_day: parsed.data.maxVotesPerIpPerDay,
      max_votes_per_fingerprint_per_day: parsed.data.maxVotesPerFingerprintPerDay,
      updated_by: admin.id
    })
    .eq("id", parsed.data.electionId);

  if (error) {
    throw new Error(error.message);
  }

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: parsed.data.electionId,
    action: "update_election",
    metadata: {
      slug,
      status: parsed.data.status
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/eleicoes");
  revalidatePath(`/dashboard/eleicoes/${parsed.data.electionId}`);
  redirect(`/dashboard/eleicoes/${parsed.data.electionId}?tab=overview&electionUpdated=1` as unknown as Route);
}

export async function createElectionCategoryAction(formData: FormData) {
  const parsed = createElectionCategorySchema.safeParse({
    electionId: String(formData.get("electionId") ?? ""),
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    displayOrder: parseOptionalNonNegativeInteger(formData.get("displayOrder"))
  });

  if (!parsed.success) {
    redirect(`/dashboard/eleicoes/${String(formData.get("electionId") ?? "")}` as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const slug = await ensureUniqueElectionCategorySlug(
    serviceClient,
    parsed.data.electionId,
    slugify(parsed.data.slug || parsed.data.name)
  );

  const { data: category, error } = await serviceClient
    .from("election_categories")
    .insert({
      election_id: parsed.data.electionId,
      slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      display_order: parsed.data.displayOrder ?? 0,
      created_by: admin.id
    })
    .select("id")
    .single();

  if (error || !category) {
    throw new Error(error?.message ?? "Nao foi possivel criar a categoria.");
  }

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: parsed.data.electionId,
    action: "create_election_category",
    metadata: {
      category_id: category.id,
      slug
    }
  });

  revalidatePath(`/dashboard/eleicoes/${parsed.data.electionId}`);
  redirect(`/dashboard/eleicoes/${parsed.data.electionId}?tab=categories&categoryCreated=1` as unknown as Route);
}

export async function assignElectionCandidatesAction(formData: FormData) {
  const parsed = assignElectionCandidatesSchema.safeParse({
    electionId: String(formData.get("electionId") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    profileIds: formData
      .getAll("profileIds")
      .map((value) => String(value))
      .filter((value) => value.length > 0)
  });

  if (!parsed.success) {
    redirect(`/dashboard/eleicoes/${String(formData.get("electionId") ?? "")}` as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const assignedCount = await assignTalentsToElectionCategory(
    serviceClient,
    admin.id,
    parsed.data.electionId,
    parsed.data.categoryId,
    parsed.data.profileIds
  );

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: parsed.data.electionId,
    action: "assign_election_candidates",
    metadata: {
      category_id: parsed.data.categoryId,
      assigned_count: assignedCount
    }
  });

  revalidatePath(`/dashboard/eleicoes/${parsed.data.electionId}`);
  redirect(`/dashboard/eleicoes/${parsed.data.electionId}?tab=participants&assigned=${assignedCount}` as unknown as Route);
}

export async function importElectionCandidatesByStateAction(formData: FormData) {
  const parsed = importElectionCandidatesByStateSchema.safeParse({
    electionId: String(formData.get("electionId") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    stateId: parseOptionalPositiveInteger(formData.get("stateId"))
  });

  if (!parsed.success) {
    redirect(`/dashboard/eleicoes/${String(formData.get("electionId") ?? "")}` as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const { data: profiles, error } = await serviceClient
    .from("talent_profiles")
    .select("id")
    .eq("status", "approved")
    .eq("state_id", parsed.data.stateId);

  if (error) {
    throw new Error(error.message);
  }

  const profileIds = ((profiles ?? []) as Array<{ id: string }>).map((profile) => profile.id);
  const assignedCount = await assignTalentsToElectionCategory(
    serviceClient,
    admin.id,
    parsed.data.electionId,
    parsed.data.categoryId,
    profileIds
  );

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: parsed.data.electionId,
    action: "import_election_candidates_by_state",
    metadata: {
      category_id: parsed.data.categoryId,
      state_id: parsed.data.stateId,
      assigned_count: assignedCount
    }
  });

  revalidatePath(`/dashboard/eleicoes/${parsed.data.electionId}`);
  redirect(`/dashboard/eleicoes/${parsed.data.electionId}?tab=categories&imported=${assignedCount}` as unknown as Route);
}

export async function updateElectionCategoryAction(formData: FormData) {
  const parsed = updateElectionCategorySchema.safeParse({
    electionId: String(formData.get("electionId") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    displayOrder: parseOptionalNonNegativeInteger(formData.get("displayOrder")),
    isActive: formData.get("isActive") === "on"
  });

  if (!parsed.success) {
    redirect(`/dashboard/eleicoes/${String(formData.get("electionId") ?? "")}?tab=categories` as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const slug = await ensureUniqueElectionCategorySlug(
    serviceClient,
    parsed.data.electionId,
    slugify(parsed.data.slug || parsed.data.name),
    parsed.data.categoryId
  );

  const { data: updatedCategory, error } = await serviceClient
    .from("election_categories")
    .update({
      slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      display_order: parsed.data.displayOrder ?? 0,
      is_active: parsed.data.isActive
    })
    .eq("id", parsed.data.categoryId)
    .eq("election_id", parsed.data.electionId)
    .select("id")
    .maybeSingle();

  if (error || !updatedCategory) {
    throw new Error(error?.message ?? "Nao foi possivel atualizar a categoria.");
  }

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: parsed.data.electionId,
    action: "update_election_category",
    metadata: {
      category_id: parsed.data.categoryId,
      slug,
      is_active: parsed.data.isActive
    }
  });

  revalidatePath(`/dashboard/eleicoes/${parsed.data.electionId}`);
  redirect(`/dashboard/eleicoes/${parsed.data.electionId}?tab=categories&categoryUpdated=1` as unknown as Route);
}

export async function deleteElectionCategoryAction(formData: FormData) {
  const parsed = deleteElectionCategorySchema.safeParse({
    electionId: String(formData.get("electionId") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "")
  });

  if (!parsed.success) {
    redirect(`/dashboard/eleicoes/${String(formData.get("electionId") ?? "")}?tab=categories` as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();

  const { data: category, error: categoryError } = await serviceClient
    .from("election_categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("election_id", parsed.data.electionId)
    .maybeSingle();

  if (categoryError) {
    throw new Error(categoryError.message);
  }

  if (!category) {
    throw new Error("Categoria nao encontrada para esta eleicao.");
  }

  const { error: clearCandidatesError } = await serviceClient
    .from("election_candidates")
    .update({ category_id: null })
    .eq("election_id", parsed.data.electionId)
    .eq("category_id", parsed.data.categoryId);

  if (clearCandidatesError) {
    throw new Error(clearCandidatesError.message);
  }

  const { error: deleteError } = await serviceClient
    .from("election_categories")
    .delete()
    .eq("id", parsed.data.categoryId)
    .eq("election_id", parsed.data.electionId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: parsed.data.electionId,
    action: "delete_election_category",
    metadata: {
      category_id: parsed.data.categoryId
    }
  });

  revalidatePath(`/dashboard/eleicoes/${parsed.data.electionId}`);
  redirect(`/dashboard/eleicoes/${parsed.data.electionId}?tab=categories&categoryDeleted=1` as unknown as Route);
}

export async function removeElectionParticipantAction(formData: FormData) {
  const parsed = removeElectionParticipantSchema.safeParse({
    electionId: String(formData.get("electionId") ?? ""),
    electionCandidateId: String(formData.get("electionCandidateId") ?? "")
  });

  if (!parsed.success) {
    redirect(`/dashboard/eleicoes/${String(formData.get("electionId") ?? "")}?tab=participants` as Route);
  }

  const admin = await requireAdminViewer();
  const serviceClient = createServiceRoleSupabaseClient();
  const { data: candidate, error: candidateError } = await serviceClient
    .from("election_candidates")
    .select("id, election_id")
    .eq("id", parsed.data.electionCandidateId)
    .eq("election_id", parsed.data.electionId)
    .maybeSingle();

  if (candidateError) {
    throw new Error(candidateError.message);
  }

  if (!candidate) {
    throw new Error("Participante nao encontrado nesta eleicao.");
  }

  const { count: votesCount, error: votesError } = await serviceClient
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("election_candidate_id", parsed.data.electionCandidateId);

  if (votesError) {
    throw new Error(votesError.message);
  }

  let removalMode: "deleted" | "deactivated" = "deleted";

  if ((votesCount ?? 0) > 0) {
    const { error: updateError } = await serviceClient
      .from("election_candidates")
      .update({
        is_active: false,
        category_id: null
      })
      .eq("id", parsed.data.electionCandidateId)
      .eq("election_id", parsed.data.electionId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    removalMode = "deactivated";
  } else {
    const { error: deleteError } = await serviceClient
      .from("election_candidates")
      .delete()
      .eq("id", parsed.data.electionCandidateId)
      .eq("election_id", parsed.data.electionId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  await serviceClient.from("admin_audit_logs").insert({
    actor_user_id: admin.id,
    entity_type: "election",
    entity_id: parsed.data.electionId,
    action: "remove_election_participant",
    metadata: {
      election_candidate_id: parsed.data.electionCandidateId,
      votes_count: votesCount ?? 0,
      removal_mode: removalMode
    }
  });

  revalidatePath(`/dashboard/eleicoes/${parsed.data.electionId}`);
  redirect(
    `/dashboard/eleicoes/${parsed.data.electionId}?tab=participants&participantRemoved=1&removalMode=${removalMode}` as unknown as Route
  );
}

function parseOptionalPositiveInteger(value: FormDataEntryValue | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getOptionalFormFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function parseOptionalNonNegativeInteger(value: FormDataEntryValue | null) {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

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

async function uploadElectionAsset(
  serviceClient: ReturnType<typeof createServiceRoleSupabaseClient>,
  file: File,
  kind: "logo" | "cover",
  scopeKey: string
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Apenas arquivos de imagem sao aceitos para logo e capa.");
  }

  const extension = inferFileExtension(file);
  const path = `${scopeKey}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await serviceClient.storage.from("election-assets").upload(path, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = serviceClient.storage.from("election-assets").getPublicUrl(path);
  return data.publicUrl;
}

function inferFileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.trim().toLowerCase();

  if (fromName) {
    return fromName;
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/jpeg":
    default:
      return "jpg";
  }
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

function slugify(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `eleicao-${Date.now()}`;
}

async function ensureUniqueElectionSlug(
  serviceClient: ReturnType<typeof createServiceRoleSupabaseClient>,
  baseSlug: string,
  excludeElectionId?: string
) {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    let query = serviceClient.from("elections").select("id").eq("slug", slug);

    if (excludeElectionId) {
      query = query.neq("id", excludeElectionId);
    }

    const { data: existing } = await query.maybeSingle();

    if (!existing) {
      return slug;
    }

    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

async function ensureUniqueElectionCategorySlug(
  serviceClient: ReturnType<typeof createServiceRoleSupabaseClient>,
  electionId: string,
  baseSlug: string,
  excludeCategoryId?: string
) {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    let query = serviceClient
      .from("election_categories")
      .select("id")
      .eq("election_id", electionId)
      .eq("slug", slug);

    if (excludeCategoryId) {
      query = query.neq("id", excludeCategoryId);
    }

    const { data: existing } = await query.maybeSingle();

    if (!existing) {
      return slug;
    }

    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

async function assignTalentsToElectionCategory(
  serviceClient: ReturnType<typeof createServiceRoleSupabaseClient>,
  adminId: string,
  electionId: string,
  categoryId: string,
  profileIds: string[]
) {
  const uniqueProfileIds = [...new Set(profileIds)];

  if (uniqueProfileIds.length === 0) {
    return 0;
  }

  const [{ data: category, error: categoryError }, { data: approvedProfiles, error: profilesError }, { data: existingCandidates, error: existingCandidatesError }, { data: lastCandidateRows, error: lastCandidateRowsError }] =
    await Promise.all([
      serviceClient.from("election_categories").select("id, election_id").eq("id", categoryId).eq("election_id", electionId).maybeSingle(),
      serviceClient.from("talent_profiles").select("id").in("id", uniqueProfileIds).eq("status", "approved"),
      serviceClient
        .from("election_candidates")
        .select("id, talent_profile_id, candidate_number, display_order, added_by")
        .eq("election_id", electionId)
        .in("talent_profile_id", uniqueProfileIds),
      serviceClient.from("election_candidates").select("display_order").eq("election_id", electionId).order("display_order", { ascending: false }).limit(1)
    ]);

  if (categoryError) {
    throw new Error(categoryError.message);
  }

  if (!category) {
    throw new Error("Categoria nao encontrada para esta eleicao.");
  }

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (existingCandidatesError) {
    throw new Error(existingCandidatesError.message);
  }

  if (lastCandidateRowsError) {
    throw new Error(lastCandidateRowsError.message);
  }

  const approvedIds = ((approvedProfiles ?? []) as Array<{ id: string }>).map((profile) => profile.id);

  if (approvedIds.length === 0) {
    return 0;
  }

  const existingMap = new Map(
    ((existingCandidates ?? []) as Array<{
      id: string;
      talent_profile_id: string;
      candidate_number: number | null;
      display_order: number;
      added_by: string | null;
    }>).map((candidate) => [candidate.talent_profile_id, candidate])
  );

  let nextDisplayOrder = ((lastCandidateRows ?? []) as Array<{ display_order: number }>)[0]?.display_order ?? 0;

  const payload = approvedIds.map((profileId) => {
    const existing = existingMap.get(profileId);

    if (!existing) {
      nextDisplayOrder += 1;
    }

    return {
      election_id: electionId,
      talent_profile_id: profileId,
      category_id: categoryId,
      candidate_number: existing?.candidate_number ?? null,
      display_order: existing?.display_order ?? nextDisplayOrder,
      is_active: true,
      added_by: existing?.added_by ?? adminId
    };
  });

  const { error: upsertError } = await serviceClient
    .from("election_candidates")
    .upsert(payload, { onConflict: "election_id,talent_profile_id" });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return approvedIds.length;
}
