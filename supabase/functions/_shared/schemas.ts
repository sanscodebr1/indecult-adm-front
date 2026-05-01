import { z } from "https://esm.sh/zod@3.23.8";

const uploadedMediaSchema = z.object({
  storageBucket: z.string().trim().min(1),
  storagePath: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive()
});

export const talentProfileSubmissionSchema = z.object({
  displayName: z.string().trim().min(2),
  fullName: z.string().trim().min(3),
  birthDate: z.string().optional().nullable(),
  city: z.string().trim().min(2).optional(),
  stateCode: z.string().trim().min(2).max(3).transform((value) => value.toUpperCase()).optional(),
  cityId: z.number().int().positive().optional(),
  stateId: z.number().int().positive().optional(),
  bio: z.string().trim().max(2000).optional().nullable(),
  introVideo: uploadedMediaSchema.optional().nullable(),
  galleryImages: z.array(uploadedMediaSchema).max(12).optional().default([]),
  requestType: z.enum(["initial_submission", "profile_update"]).optional()
}).superRefine((value, context) => {
  const hasLegacyLocation = Boolean(value.city?.trim()) && Boolean(value.stateCode?.trim());
  const hasRelationalLocation = typeof value.cityId === "number" && typeof value.stateId === "number";

  if (!hasLegacyLocation && !hasRelationalLocation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cityId"],
      message: "City/state or cityId/stateId is required."
    });
  }
});

export const createVoteChallengeSchema = z.object({
  electionSlug: z.string().trim().min(1),
  fingerprint: z.string().trim().min(8).max(512).optional()
});

export const castVoteSchema = z.object({
  challengeId: z.string().uuid(),
  electionCandidateId: z.string().uuid(),
  captchaAnswer: z.number().int(),
  fingerprint: z.string().trim().min(8).max(512).optional()
});

export const adminListTalentsSchema = z.object({
  includeHistory: z.boolean().optional().default(true)
});

export const adminReviewTalentSchema = z
  .object({
    profileId: z.string().uuid(),
    changeRequestId: z.string().uuid().optional().nullable(),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(3).optional().nullable()
  })
  .superRefine((value, context) => {
    if (value.decision === "rejected" && !value.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Reason is required when rejecting a talent."
      });
    }
  });
