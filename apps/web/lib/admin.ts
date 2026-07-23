import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@indecult/supabase/server";
import { createServiceRoleSupabaseClient } from "@indecult/supabase/admin";

type AppUserSummary = {
  id: string;
  email: string;
  display_name: string | null;
  account_status: string;
};

type TalentProfileRow = {
  id: string;
  user_id: string;
  public_slug: string;
  display_name: string;
  full_name: string;
  birth_date: string | null;
  city: string | null;
  state_code: string | null;
  city_id: number | null;
  state_id: number | null;
  city_name?: string | null;
  state_sigla?: string | null;
  bio: string | null;
  status: "draft" | "pending_review" | "approved" | "rejected" | "suspended";
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  approved_change_request_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileChangeRequestRow = {
  id: string;
  talent_profile_id: string;
  requested_by: string;
  request_type: "initial_submission" | "profile_update";
  status: "pending" | "approved" | "rejected" | "cancelled";
  proposed_profile: Record<string, unknown> | null;
  proposed_media: unknown[] | null;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

type TalentProfileMediaRow = {
  id: string;
  talent_profile_id: string;
  media_kind: "gallery_image" | "intro_video" | "profile_photo";
  source: "upload" | "youtube";
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  signed_url?: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ElectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  cover_mobile_url: string | null;
  visibility: "public" | "private";
  status: "draft" | "scheduled" | "live" | "paused" | "finished" | "cancelled";
  starts_at: string;
  ends_at: string;
  published_at: string | null;
  allow_public_results: boolean;
  max_votes_per_ip_per_day: number | null;
  max_votes_per_fingerprint_per_day: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type ElectionCategoryRow = {
  id: string;
  election_id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ElectionCandidateRow = {
  id: string;
  election_id: string;
  talent_profile_id: string;
  candidate_number: number | null;
  category_id?: string | null;
  display_order: number;
  is_active: boolean;
  added_by: string | null;
  created_at: string;
};

type VoteRow = {
  id: string;
  vote_attempt_id: string;
  election_id: string;
  election_candidate_id: string;
  created_at: string;
};

type ElectionRankingRow = {
  election_candidate_id: string;
  election_id: string;
  talent_profile_id: string;
  display_name: string;
  vote_count: number;
  ranking_position: number;
};

export type AdminViewer = {
  id: string;
  email: string | null;
};

export type AdminTalentListItem = {
  profile: TalentProfileRow;
  user: AppUserSummary | null;
  pendingRequest: Pick<ProfileChangeRequestRow, "id" | "request_type" | "status" | "created_at"> | null;
};

export type AdminTalentDetail = {
  profile: TalentProfileRow;
  user: AppUserSummary | null;
  media: TalentProfileMediaRow[];
  requests: ProfileChangeRequestRow[];
  pendingRequest: ProfileChangeRequestRow | null;
};

export type AdminElectionListItem = ElectionRow;

export type AdminElectionCategorySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  participantsCount: number;
  totalVotes: number;
};

export type AdminElectionParticipant = {
  electionCandidateId: string;
  talentProfileId: string;
  displayName: string;
  publicSlug: string;
  candidateNumber: number | null;
  displayOrder: number;
  isActive: boolean;
  category: Pick<AdminElectionCategorySummary, "id" | "slug" | "name" | "displayOrder" | "isActive"> | null;
  voteCount: number;
  rankingPosition: number | null;
};

export type AdminElectionVoteListItem = {
  id: string;
  voteAttemptId: string;
  createdAt: string;
  participant: {
    electionCandidateId: string;
    displayName: string;
    publicSlug: string;
    candidateNumber: number | null;
  } | null;
  category: Pick<AdminElectionCategorySummary, "id" | "slug" | "name"> | null;
};

export type AdminElectionDetail = {
  election: AdminElectionListItem;
  totalVotes: number;
  totalParticipants: number;
  totalCategories: number;
  participants: AdminElectionParticipant[];
  categories: AdminElectionCategorySummary[];
};

export type PaginatedAdminElectionVotes = {
  items: AdminElectionVoteListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AdminStateOption = {
  id: number;
  sigla: string;
  nome: string;
};

export type AdminElectionTalentAssignmentOption = {
  profileId: string;
  displayName: string;
  publicSlug: string;
  cityName: string | null;
  stateId: number | null;
  stateSigla: string | null;
  existingCandidateId: string | null;
  existingCategoryId: string | null;
};

export async function requireAdminViewer(): Promise<AdminViewer> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login" as Route);
  }

  const serviceClient = createServiceRoleSupabaseClient();
  const { data: roleRecord } = await serviceClient
    .from("admins")
    .select("user_id, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!roleRecord) {
    redirect("/acesso-negado" as Route);
  }

  return {
    id: user.id,
    email: user.email ?? null
  };
}

export async function listTalentProfilesForAdmin(): Promise<AdminTalentListItem[]> {
  const serviceClient = createServiceRoleSupabaseClient();
  const { data: profiles, error } = await serviceClient
    .from("talent_profiles")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const typedProfiles = (profiles ?? []) as TalentProfileRow[];

  if (typedProfiles.length === 0) {
    return [];
  }

  const userIds = [...new Set(typedProfiles.map((profile) => profile.user_id))];
  const profileIds = typedProfiles.map((profile) => profile.id);
  const cityIds = [...new Set(typedProfiles.map((profile) => profile.city_id).filter((value): value is number => typeof value === "number"))];
  const stateIds = [...new Set(typedProfiles.map((profile) => profile.state_id).filter((value): value is number => typeof value === "number"))];

  const [{ data: users }, { data: requests }, { data: cities }, { data: states }] = await Promise.all([
    serviceClient.from("app_users").select("id, email, display_name, account_status").in("id", userIds),
    serviceClient
      .from("profile_change_requests")
      .select("id, talent_profile_id, request_type, status, created_at")
      .in("talent_profile_id", profileIds)
      .eq("status", "pending"),
    cityIds.length > 0 ? serviceClient.from("cities").select("ogc_fid, nm_mun, state_id").in("ogc_fid", cityIds) : Promise.resolve({ data: [] }),
    stateIds.length > 0 ? serviceClient.from("states").select("id, sigla, name").in("id", stateIds) : Promise.resolve({ data: [] })
  ]);

  const userMap = new Map(((users ?? []) as AppUserSummary[]).map((user) => [user.id, user]));
  const cityMap = new Map(((cities ?? []) as Array<{ ogc_fid: number; nm_mun: string; state_id: number }>).map((city) => [city.ogc_fid, city]));
  const stateMap = new Map(((states ?? []) as Array<{ id: number; sigla: string; name?: string }>).map((state) => [state.id, state]));
  const requestMap = new Map(
    ((requests ?? []) as Array<Pick<ProfileChangeRequestRow, "id" | "talent_profile_id" | "request_type" | "status" | "created_at">>).map(
      (request) => [request.talent_profile_id, request]
    )
  );

  return typedProfiles
    .map((profile) => ({
      profile: {
        ...profile,
        city_name: profile.city ?? (profile.city_id ? cityMap.get(profile.city_id)?.nm_mun ?? null : null),
        state_sigla: profile.state_code ?? (profile.state_id ? stateMap.get(profile.state_id)?.sigla ?? null : null)
      },
      user: userMap.get(profile.user_id) ?? null,
      pendingRequest: requestMap.get(profile.id) ?? null
    }))
    .sort((left, right) => {
      if (left.profile.status === "pending_review" && right.profile.status !== "pending_review") {
        return -1;
      }

      if (left.profile.status !== "pending_review" && right.profile.status === "pending_review") {
        return 1;
      }

      return new Date(right.profile.submitted_at ?? right.profile.updated_at).getTime() - new Date(left.profile.submitted_at ?? left.profile.updated_at).getTime();
    });
}

export async function getTalentProfileDetailForAdmin(profileId: string): Promise<AdminTalentDetail | null> {
  const serviceClient = createServiceRoleSupabaseClient();
  const { data: profile, error } = await serviceClient
    .from("talent_profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!profile) {
    return null;
  }

  const typedProfile = profile as TalentProfileRow;

  const [{ data: user }, { data: media }, { data: requests }, { data: city }, { data: state }] = await Promise.all([
    serviceClient
      .from("app_users")
      .select("id, email, display_name, account_status")
      .eq("id", typedProfile.user_id)
      .maybeSingle(),
    serviceClient
      .from("talent_profile_media")
      .select("id, talent_profile_id, media_kind, source, storage_bucket, storage_path, external_url, mime_type, file_size_bytes, sort_order, is_active, created_at, updated_at")
      .eq("talent_profile_id", profileId)
      .order("sort_order", { ascending: true }),
    serviceClient
      .from("profile_change_requests")
      .select(
        "id, talent_profile_id, requested_by, request_type, status, proposed_profile, proposed_media, review_notes, reviewed_at, reviewed_by, rejection_reason, applied_at, created_at, updated_at"
      )
      .eq("talent_profile_id", profileId)
      .order("created_at", { ascending: false }),
    typedProfile.city_id ? serviceClient.from("cities").select("ogc_fid, nm_mun, state_id").eq("ogc_fid", typedProfile.city_id).maybeSingle() : Promise.resolve({ data: null }),
    typedProfile.state_id ? serviceClient.from("states").select("id, sigla, name").eq("id", typedProfile.state_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  const typedRequests = (requests ?? []) as ProfileChangeRequestRow[];
  const typedMedia = (media ?? []) as TalentProfileMediaRow[];
  const mediaWithUrls = await Promise.all(
    typedMedia.map(async (item) => ({
      ...item,
      signed_url:
        item.source === "upload" && item.storage_bucket && item.storage_path
          ? await generateSignedUrl(serviceClient, item.storage_bucket, item.storage_path)
          : item.external_url
    }))
  );

  return {
    profile: {
      ...typedProfile,
      city_name: typedProfile.city ?? ((city as { nm_mun?: string } | null)?.nm_mun ?? null),
      state_sigla: typedProfile.state_code ?? ((state as { sigla?: string } | null)?.sigla ?? null)
    },
    user: (user as AppUserSummary | null) ?? null,
    media: mediaWithUrls,
    requests: typedRequests,
    pendingRequest: typedRequests.find((request) => request.status === "pending") ?? null
  };
}

async function generateSignedUrl(client: ReturnType<typeof createServiceRoleSupabaseClient>, bucket: string, path: string): Promise<string | null> {
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

export type AdminDashboardSnapshot = {
  pendingProfiles: number;
  approvedProfiles: number;
  draftElections: number;
  liveElections: number;
};

export async function getAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const serviceClient = createServiceRoleSupabaseClient();

  const [pendingProfiles, approvedProfiles, draftElections, liveElections] = await Promise.all([
    serviceClient.from("talent_profiles").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
    serviceClient.from("talent_profiles").select("*", { count: "exact", head: true }).eq("status", "approved"),
    serviceClient.from("elections").select("*", { count: "exact", head: true }).eq("status", "draft"),
    serviceClient.from("elections").select("*", { count: "exact", head: true }).eq("status", "live")
  ]);

  return {
    pendingProfiles: pendingProfiles.count ?? 0,
    approvedProfiles: approvedProfiles.count ?? 0,
    draftElections: draftElections.count ?? 0,
    liveElections: liveElections.count ?? 0
  };
}

type ListElectionsFilters = {
  query?: string;
  status?: string;
  visibility?: string;
};

export async function listElectionsForAdmin(filters: ListElectionsFilters = {}): Promise<AdminElectionListItem[]> {
  const serviceClient = createServiceRoleSupabaseClient();
  let query = serviceClient.from("elections").select("*").order("starts_at", { ascending: false });

  const search = filters.query?.trim();

  if (search) {
    const escaped = search.replace(/[%_,]/g, (char) => `\\${char}`);
    query = query.or(`title.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.visibility && filters.visibility !== "all") {
    query = query.eq("visibility", filters.visibility);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AdminElectionListItem[];
}

export async function getElectionDetailForAdmin(electionId: string): Promise<AdminElectionDetail | null> {
  const serviceClient = createServiceRoleSupabaseClient();
  const [{ data: election, error: electionError }, { count: totalVotes, error: totalVotesError }, { data: candidates, error: candidatesError }] = await Promise.all([
    serviceClient.from("elections").select("*").eq("id", electionId).maybeSingle(),
    serviceClient.from("votes").select("*", { count: "exact", head: true }).eq("election_id", electionId),
    serviceClient
      .from("election_candidates")
      .select("id, election_id, talent_profile_id, candidate_number, category_id, display_order, is_active, added_by, created_at")
      .eq("election_id", electionId)
      .order("display_order", { ascending: true })
      .order("candidate_number", { ascending: true })
  ]);

  if (electionError) {
    throw new Error(electionError.message);
  }

  if (totalVotesError) {
    throw new Error(totalVotesError.message);
  }

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  if (!election) {
    return null;
  }

  const typedCandidates = (candidates ?? []) as ElectionCandidateRow[];
  const profileIds = [...new Set(typedCandidates.map((candidate) => candidate.talent_profile_id))];
  const [{ data: profiles, error: profilesError }, { data: rankings, error: rankingsError }, { data: categories, error: categoriesError }] = await Promise.all([
    profileIds.length > 0
      ? serviceClient.from("talent_profiles").select("id, display_name, public_slug").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    serviceClient
      .from("election_candidate_rankings")
      .select("election_candidate_id, election_id, talent_profile_id, display_name, vote_count, ranking_position")
      .eq("election_id", electionId)
      .order("vote_count", { ascending: false })
      .order("display_name", { ascending: true }),
    serviceClient
      .from("election_categories")
      .select("id, election_id, slug, name, description, display_order, is_active, created_by, created_at, updated_at")
      .eq("election_id", electionId)
  ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (rankingsError) {
    throw new Error(rankingsError.message);
  }

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; display_name: string; public_slug: string }>).map((profile) => [profile.id, profile])
  );
  const rankingMap = new Map(((rankings ?? []) as ElectionRankingRow[]).map((ranking) => [ranking.election_candidate_id, ranking]));
  const categoryMap = new Map(((categories ?? []) as ElectionCategoryRow[]).map((category) => [category.id, category]));

  const participants = typedCandidates
    .map((candidate) => {
      const ranking = rankingMap.get(candidate.id);
      const profile = profileMap.get(candidate.talent_profile_id);
      const category = candidate.category_id ? categoryMap.get(candidate.category_id) ?? null : null;

      return {
        electionCandidateId: candidate.id,
        talentProfileId: candidate.talent_profile_id,
        displayName: ranking?.display_name ?? profile?.display_name ?? "Talento sem nome",
        publicSlug: profile?.public_slug ?? "",
        candidateNumber: candidate.candidate_number,
        displayOrder: candidate.display_order,
        isActive: candidate.is_active,
        category: category
          ? {
              id: category.id,
              slug: category.slug,
              name: category.name,
              displayOrder: category.display_order,
              isActive: category.is_active
            }
          : null,
        voteCount: ranking?.vote_count ?? 0,
        rankingPosition: ranking?.ranking_position ?? null
      } satisfies AdminElectionParticipant;
    })
    .sort((left, right) => {
      if (right.voteCount !== left.voteCount) {
        return right.voteCount - left.voteCount;
      }

      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.displayName.localeCompare(right.displayName, "pt-BR");
    });

  const categorySummaries = new Map(
    Array.from(categoryMap.values())
      .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name, "pt-BR"))
      .map((category) => [
        category.id,
        {
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: category.description,
          displayOrder: category.display_order,
          isActive: category.is_active,
          participantsCount: 0,
          totalVotes: 0
        } satisfies AdminElectionCategorySummary
      ])
  );

  for (const participant of participants) {
    if (!participant.category) {
      continue;
    }

    const summary = categorySummaries.get(participant.category.id);

    if (!summary) {
      continue;
    }

    summary.participantsCount += 1;
    summary.totalVotes += participant.voteCount;
  }

  return {
    election: election as AdminElectionListItem,
    totalVotes: totalVotes ?? 0,
    totalParticipants: typedCandidates.length,
    totalCategories: categorySummaries.size,
    participants,
    categories: Array.from(categorySummaries.values())
  };
}

export async function listElectionVotesForAdmin(
  electionId: string,
  page: number,
  pageSize: number
): Promise<PaginatedAdminElectionVotes> {
  const serviceClient = createServiceRoleSupabaseClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  const [{ data: votes, count, error: votesError }, { data: candidates, error: candidatesError }] = await Promise.all([
    serviceClient
      .from("votes")
      .select("id, vote_attempt_id, election_id, election_candidate_id, created_at", { count: "exact" })
      .eq("election_id", electionId)
      .order("created_at", { ascending: false })
      .range(from, to),
    serviceClient
      .from("election_candidates")
      .select("id, election_id, talent_profile_id, candidate_number, category_id, display_order, is_active, added_by, created_at")
      .eq("election_id", electionId)
  ]);

  if (votesError) {
    throw new Error(votesError.message);
  }

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  const typedVotes = (votes ?? []) as VoteRow[];
  const typedCandidates = (candidates ?? []) as ElectionCandidateRow[];
  const candidateMap = new Map(typedCandidates.map((candidate) => [candidate.id, candidate]));
  const profileIds = [...new Set(typedCandidates.map((candidate) => candidate.talent_profile_id))];
  const categoryIds = [...new Set(typedCandidates.map((candidate) => candidate.category_id).filter((value): value is string => typeof value === "string"))];

  const [{ data: profiles, error: profilesError }, { data: categories, error: categoriesError }] = await Promise.all([
    profileIds.length > 0
      ? serviceClient.from("talent_profiles").select("id, display_name, public_slug").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length > 0
      ? serviceClient.from("election_categories").select("id, slug, name").in("id", categoryIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; display_name: string; public_slug: string }>).map((profile) => [profile.id, profile])
  );
  const categoryMap = new Map(((categories ?? []) as Array<{ id: string; slug: string; name: string }>).map((category) => [category.id, category]));

  return {
    items: typedVotes.map((vote) => {
      const candidate = candidateMap.get(vote.election_candidate_id);
      const profile = candidate ? profileMap.get(candidate.talent_profile_id) : null;
      const category = candidate?.category_id ? categoryMap.get(candidate.category_id) ?? null : null;

      return {
        id: vote.id,
        voteAttemptId: vote.vote_attempt_id,
        createdAt: vote.created_at,
        participant: candidate
          ? {
              electionCandidateId: candidate.id,
              displayName: profile?.display_name ?? "Talento sem nome",
              publicSlug: profile?.public_slug ?? "",
              candidateNumber: candidate.candidate_number
            }
          : null,
        category: category
          ? {
              id: category.id,
              slug: category.slug,
              name: category.name
            }
          : null
      } satisfies AdminElectionVoteListItem;
    }),
    page: safePage,
    pageSize: safePageSize,
    totalItems: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / safePageSize))
  };
}

type ListElectionAssignableTalentsFilters = {
  query?: string;
  stateId?: number | null;
  limit?: number;
};

export async function listElectionAssignableTalentsForAdmin(
  electionId: string,
  filters: ListElectionAssignableTalentsFilters = {}
): Promise<AdminElectionTalentAssignmentOption[]> {
  const serviceClient = createServiceRoleSupabaseClient();
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 40;
  let query = serviceClient
    .from("talent_profiles")
    .select("id, display_name, public_slug, city_id, state_id, full_name")
    .eq("status", "approved")
    .order("display_name", { ascending: true })
    .limit(limit);

  const search = filters.query?.trim();

  if (search) {
    const escaped = search.replace(/[%_,]/g, (char) => `\\${char}`);
    query = query.or(`display_name.ilike.%${escaped}%,public_slug.ilike.%${escaped}%,full_name.ilike.%${escaped}%`);
  }

  if (typeof filters.stateId === "number" && Number.isFinite(filters.stateId)) {
    query = query.eq("state_id", filters.stateId);
  }

  const { data: profiles, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const typedProfiles = (profiles ?? []) as Array<{
    id: string;
    display_name: string;
    public_slug: string;
    city_id: number | null;
    state_id: number | null;
    full_name: string;
  }>;

  if (typedProfiles.length === 0) {
    return [];
  }

  const profileIds = typedProfiles.map((profile) => profile.id);
  const cityIds = [...new Set(typedProfiles.map((profile) => profile.city_id).filter((value): value is number => typeof value === "number"))];
  const stateIds = [...new Set(typedProfiles.map((profile) => profile.state_id).filter((value): value is number => typeof value === "number"))];

  const [{ data: candidates, error: candidatesError }, { data: cities, error: citiesError }, { data: states, error: statesError }] = await Promise.all([
    serviceClient
      .from("election_candidates")
      .select("id, talent_profile_id, category_id")
      .eq("election_id", electionId)
      .in("talent_profile_id", profileIds),
    cityIds.length > 0
      ? serviceClient.from("cities").select("ogc_fid, nm_mun, state_id").in("ogc_fid", cityIds)
      : Promise.resolve({ data: [], error: null }),
    stateIds.length > 0
      ? serviceClient.from("states").select("id, sigla, name").in("id", stateIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  if (citiesError) {
    throw new Error(citiesError.message);
  }

  if (statesError) {
    throw new Error(statesError.message);
  }

  const candidateMap = new Map(
    ((candidates ?? []) as Array<{ id: string; talent_profile_id: string; category_id: string | null }>).map((candidate) => [
      candidate.talent_profile_id,
      candidate
    ])
  );
  const cityMap = new Map(((cities ?? []) as Array<{ ogc_fid: number; nm_mun: string; state_id: number }>).map((city) => [city.ogc_fid, city]));
  const stateMap = new Map(((states ?? []) as Array<{ id: number; sigla: string; name: string }>).map((state) => [state.id, state]));

  return typedProfiles.map((profile) => {
    const candidate = candidateMap.get(profile.id) ?? null;
    const city = profile.city_id ? cityMap.get(profile.city_id) ?? null : null;
    const state = profile.state_id ? stateMap.get(profile.state_id) ?? null : null;

    return {
      profileId: profile.id,
      displayName: profile.display_name,
      publicSlug: profile.public_slug,
      cityName: city?.nm_mun ?? null,
      stateId: profile.state_id,
      stateSigla: state?.sigla ?? null,
      existingCandidateId: candidate?.id ?? null,
      existingCategoryId: candidate?.category_id ?? null
    };
  });
}

export async function listStatesForAdmin(): Promise<AdminStateOption[]> {
  const serviceClient = createServiceRoleSupabaseClient();
  const { data, error } = await serviceClient.from("states").select("id, sigla, name").order("sigla", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ id: number; sigla: string; name: string }>).map((state) => ({
    id: state.id,
    sigla: state.sigla,
    nome: state.name
  }));
}
