import type { SupabaseClient } from "@supabase/supabase-js";
import { castVoteSchema, voteChallengeRequestSchema, type CastVoteInputSchema, type VoteChallengeRequestInput } from "./schemas";
import type { CastVoteResult, VoteChallenge } from "./types";

export async function requestVoteChallenge(client: SupabaseClient, input: VoteChallengeRequestInput) {
  const payload = voteChallengeRequestSchema.parse(input);

  const { data, error } = await client.functions.invoke<VoteChallenge>("create-vote-challenge", {
    body: payload
  });

  return { data, error };
}

export async function castVote(client: SupabaseClient, input: CastVoteInputSchema) {
  const payload = castVoteSchema.parse(input);

  const { data, error } = await client.functions.invoke<CastVoteResult>("cast-vote", {
    body: payload
  });

  return { data, error };
}
