import { corsHeaders } from "../_shared/cors.ts";
import { electionIsLive } from "../_shared/election.ts";
import { sha256 } from "../_shared/hash.ts";
import { jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { castVoteSchema } from "../_shared/schemas.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const payload = castVoteSchema.parse(await parseJsonBody(request));
    const serviceClient = createServiceRoleClient();
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const ipHash = forwardedFor !== "unknown" ? await sha256(forwardedFor) : null;
    const userAgentHash = await sha256(userAgent);
    const fingerprintHash = payload.fingerprint ? await sha256(payload.fingerprint) : null;

    const { data: challenge } = await serviceClient
      .from("vote_challenges")
      .select("id, election_id, operand_left, operator, operand_right, answer_value, expires_at, used_at, ip_hash, fingerprint_hash")
      .eq("id", payload.challengeId)
      .maybeSingle();

    if (!challenge) {
      return jsonResponse({ data: null, error: "Challenge not found." }, { status: 404 });
    }

    if (challenge.used_at) {
      return jsonResponse({ data: null, error: "Challenge has already been used." }, { status: 400 });
    }

    if (new Date(challenge.expires_at) <= new Date()) {
      return jsonResponse({ data: null, error: "Challenge has expired." }, { status: 400 });
    }

    if (challenge.ip_hash && challenge.ip_hash !== ipHash) {
      return jsonResponse({ data: null, error: "Challenge does not match this client." }, { status: 400 });
    }

    if (challenge.fingerprint_hash && challenge.fingerprint_hash !== fingerprintHash) {
      return jsonResponse({ data: null, error: "Challenge does not match this device." }, { status: 400 });
    }

    const { data: election } = await serviceClient
      .from("elections")
      .select("id, title, starts_at, ends_at, status, max_votes_per_ip_per_day, max_votes_per_fingerprint_per_day")
      .eq("id", challenge.election_id)
      .maybeSingle();

    if (!election) {
      return jsonResponse({ data: null, error: "Election not found." }, { status: 404 });
    }

    if (!electionIsLive(election)) {
      return jsonResponse({ data: null, error: "Election is not accepting votes right now." }, { status: 400 });
    }

    const { data: candidate } = await serviceClient
      .from("election_candidates")
      .select("id, talent_profile_id, is_active")
      .eq("id", payload.electionCandidateId)
      .eq("election_id", challenge.election_id)
      .maybeSingle();

    if (!candidate || !candidate.is_active) {
      return jsonResponse({ data: null, error: "Candidate is not eligible in this election." }, { status: 400 });
    }

    const { data: claimedChallenge } = await serviceClient.rpc("claim_vote_challenge", {
      p_challenge_id: payload.challengeId,
      p_ip_hash: ipHash,
      p_fingerprint_hash: fingerprintHash
    });

    if (!claimedChallenge || claimedChallenge.length === 0) {
      return jsonResponse({ data: null, error: "Challenge is no longer available." }, { status: 400 });
    }

    const captchaValid = challenge.answer_value === payload.captchaAnswer;

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    let result: "counted" | "invalid_captcha" | "blocked_rule" = "counted";
    let resultReason: string | null = null;

    if (!captchaValid) {
      result = "invalid_captcha";
      resultReason = "Captcha answer did not match.";
    }

    if (result === "counted" && election.max_votes_per_ip_per_day && ipHash) {
      const { count } = await serviceClient
        .from("vote_attempts")
        .select("*", { count: "exact", head: true })
        .eq("election_id", election.id)
        .eq("result", "counted")
        .eq("ip_hash", ipHash)
        .gte("created_at", dayStart.toISOString());

      if ((count ?? 0) >= election.max_votes_per_ip_per_day) {
        result = "blocked_rule";
        resultReason = "Daily vote limit reached for IP.";
      }
    }

    if (result === "counted" && election.max_votes_per_fingerprint_per_day && fingerprintHash) {
      const { count } = await serviceClient
        .from("vote_attempts")
        .select("*", { count: "exact", head: true })
        .eq("election_id", election.id)
        .eq("result", "counted")
        .eq("fingerprint_hash", fingerprintHash)
        .gte("created_at", dayStart.toISOString());

      if ((count ?? 0) >= election.max_votes_per_fingerprint_per_day) {
        result = "blocked_rule";
        resultReason = "Daily vote limit reached for fingerprint.";
      }
    }

    const { data: voteAttempt, error: attemptError } = await serviceClient
      .from("vote_attempts")
      .insert({
        election_id: election.id,
        election_candidate_id: candidate.id,
        vote_challenge_id: challenge.id,
        captcha_left: challenge.operand_left,
        captcha_operator: challenge.operator,
        captcha_right: challenge.operand_right,
        captcha_answer: payload.captchaAnswer,
        captcha_valid: captchaValid,
        ip_hash: ipHash,
        user_agent_hash: userAgentHash,
        fingerprint_hash: fingerprintHash,
        result,
        result_reason: resultReason
      })
      .select("id")
      .single();

    if (attemptError || !voteAttempt) {
      return jsonResponse({ data: null, error: attemptError?.message ?? "Unable to register vote attempt." }, { status: 400 });
    }

    if (result !== "counted") {
      return jsonResponse(
        {
          data: {
            voteAttemptId: voteAttempt.id,
            result,
            resultReason
          },
          error: null
        },
        { status: 400 }
      );
    }

    const { error: voteError } = await serviceClient.from("votes").insert({
      vote_attempt_id: voteAttempt.id,
      election_id: election.id,
      election_candidate_id: candidate.id
    });

    if (voteError) {
      return jsonResponse({ data: null, error: voteError.message }, { status: 400 });
    }

    const { count: voteCount } = await serviceClient
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("election_id", election.id)
      .eq("election_candidate_id", candidate.id);

    return jsonResponse({
      data: {
        voteAttemptId: voteAttempt.id,
        result: "counted",
        voteCount: voteCount ?? 0
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
