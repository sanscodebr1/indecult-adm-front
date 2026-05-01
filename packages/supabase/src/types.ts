export type ProfileStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";

export type UserRole = "talent" | "admin";

export type AdminTalentMedia = {
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

export type AdminTalentRequest = {
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

export type AdminTalentListItem = {
  profile: TalentProfileRecord;
  user: {
    id: string;
    email: string;
    display_name: string | null;
    account_status: string;
  } | null;
  media: AdminTalentMedia[];
  requests: AdminTalentRequest[];
  pendingRequest: AdminTalentRequest | null;
};

export type AdminTalentListFunctionResult = {
  items: AdminTalentListItem[];
};

export type AdminTalentReviewInput = {
  profileId: string;
  changeRequestId?: string | null;
  decision: "approved" | "rejected";
  reason?: string | null;
};

export type AdminTalentReviewFunctionResult = {
  profileId: string;
  status: "approved" | "rejected";
  message: string;
};

export type UploadedMediaReference = {
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type TalentProfileDraft = {
  displayName: string;
  fullName: string;
  birthDate?: string;
  city?: string;
  stateCode?: string;
  cityId?: number;
  stateId?: number;
  bio?: string;
  introVideo?: UploadedMediaReference | null;
  galleryImages?: UploadedMediaReference[];
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type TalentProfileRecord = {
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
  state_name?: string | null;
  state_sigla?: string | null;
  bio: string | null;
  status: ProfileStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TalentProfileSubmission = TalentProfileDraft & {
  requestType?: "initial_submission" | "profile_update";
};

export type SubmitProfileResult = {
  profileId: string;
  requestId: string;
  profileStatus: ProfileStatus;
  message: string;
};

export type VoteChallengeRequest = {
  electionSlug: string;
  fingerprint?: string;
};

export type VoteChallenge = {
  challengeId: string;
  prompt: string;
  expiresAt: string;
};

export type CastVoteInput = {
  challengeId: string;
  electionCandidateId: string;
  captchaAnswer: number;
  fingerprint?: string;
};

export type CastVoteResult = {
  voteAttemptId: string;
  result: "counted" | "invalid_captcha" | "blocked_rule" | "invalid_challenge";
  resultReason?: string | null;
  voteCount?: number;
};

export type DatabaseTableName =
  | "admins"
  | "app_users"
  | "user_roles"
  | "talent_profiles"
  | "talent_profile_media"
  | "profile_change_requests"
  | "elections"
  | "election_categories"
  | "election_candidates"
  | "vote_challenges"
  | "vote_attempts"
  | "votes"
  | "admin_audit_logs";

export type SupabaseEdgeResponse<T> = {
  data: T | null;
  error: string | null;
};
