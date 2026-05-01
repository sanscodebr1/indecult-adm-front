import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminTalentListFunctionResult, AdminTalentReviewFunctionResult, AdminTalentReviewInput, ProfileStatus } from "./types";

const adminTalentReviewSchema = z
  .object({
    profileId: z.string().uuid("Perfil invalido."),
    changeRequestId: z.string().uuid("Solicitacao invalida.").optional().nullable(),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(3, "Informe um motivo com pelo menos 3 caracteres.").optional().nullable()
  })
  .superRefine((value, context) => {
    if (value.decision === "rejected" && !value.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Informe o motivo da reprovacao."
      });
    }
  });

export async function listAdminTalents(client: SupabaseClient) {
  const { data, error } = await client.functions.invoke<AdminTalentListFunctionResult>("admin-list-talents", {
    body: {
      includeHistory: true
    }
  });

  return { data, error };
}

export async function reviewAdminTalent(client: SupabaseClient, input: AdminTalentReviewInput) {
  const payload = adminTalentReviewSchema.parse(input);

  const { data, error } = await client.functions.invoke<AdminTalentReviewFunctionResult>("admin-review-talent", {
    body: payload
  });

  return { data, error };
}

export function isPendingProfileStatus(status: ProfileStatus) {
  return status === "pending_review";
}
