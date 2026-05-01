import type { SupabaseClient } from "@supabase/supabase-js";
import { talentProfileSubmissionSchema, type TalentProfileSubmissionInput } from "./schemas";
import type { SubmitProfileResult, TalentProfileRecord } from "./types";

export async function getCurrentTalentProfile(client: SupabaseClient) {
  const { data, error } = await client.from("talent_profiles").select("*").maybeSingle();

  if (error || !data) {
    return { data: data as TalentProfileRecord | null, error };
  }

  const profile = data as TalentProfileRecord;

  if (!profile.city_id || !profile.state_id) {
    return { data: profile, error };
  }

  const [{ data: city }, { data: state }] = await Promise.all([
    client.from("cities").select("ogc_fid, nm_mun, state_id").eq("ogc_fid", profile.city_id).maybeSingle(),
    client.from("states").select("id, sigla, nome").eq("id", profile.state_id).maybeSingle()
  ]);

  return {
    data: {
      ...profile,
      city_name: (city as { nm_mun?: string } | null)?.nm_mun ?? null,
      state_name: (state as { nome?: string } | null)?.nome ?? null,
      state_sigla: (state as { sigla?: string } | null)?.sigla ?? null
    },
    error
  };
}

export async function submitTalentProfileForReview(client: SupabaseClient, input: TalentProfileSubmissionInput) {
  const payload = talentProfileSubmissionSchema.parse(input);

  const { data, error } = await client.functions.invoke<SubmitProfileResult>("submit-profile-for-review", {
    body: payload
  });

  return { data, error };
}
