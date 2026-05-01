import { generateMathChallenge } from "../_shared/challenge.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { electionIsLive } from "../_shared/election.ts";
import { sha256 } from "../_shared/hash.ts";
import { jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { createVoteChallengeSchema } from "../_shared/schemas.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const CHALLENGE_TTL_SECONDS = 180;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const payload = createVoteChallengeSchema.parse(await parseJsonBody(request));
    const serviceClient = createServiceRoleClient();

    const { data: election } = await serviceClient
      .from("elections")
      .select("id, status, starts_at, ends_at")
      .eq("slug", payload.electionSlug)
      .eq("visibility", "public")
      .maybeSingle();

    if (!election) {
      return jsonResponse({ data: null, error: "Election not found." }, { status: 404 });
    }

    if (!electionIsLive(election)) {
      return jsonResponse({ data: null, error: "Election is not accepting votes right now." }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = forwardedFor !== "unknown" ? await sha256(forwardedFor) : null;
    const fingerprintHash = payload.fingerprint ? await sha256(payload.fingerprint) : null;
    const challenge = generateMathChallenge();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();

    const { data: savedChallenge, error } = await serviceClient
      .from("vote_challenges")
      .insert({
        election_id: election.id,
        operand_left: challenge.operandLeft,
        operator: challenge.operator,
        operand_right: challenge.operandRight,
        answer_value: challenge.answerValue,
        ip_hash: ipHash,
        fingerprint_hash: fingerprintHash,
        expires_at: expiresAt
      })
      .select("id")
      .single();

    if (error || !savedChallenge) {
      return jsonResponse({ data: null, error: error?.message ?? "Unable to create challenge." }, { status: 400 });
    }

    return jsonResponse({
      data: {
        challengeId: savedChallenge.id,
        prompt: challenge.prompt,
        expiresAt
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
