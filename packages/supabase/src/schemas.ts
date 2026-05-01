import { z } from "zod";

export const authCredentialsSchema = z.object({
  email: z.string().email("Informe um email valido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.")
});

export const uploadedMediaSchema = z.object({
  storageBucket: z.string().trim().min(1, "Bucket de upload obrigatorio."),
  storagePath: z.string().trim().min(1, "Caminho do arquivo obrigatorio."),
  fileName: z.string().trim().min(1, "Nome do arquivo obrigatorio."),
  mimeType: z.string().trim().min(1, "Tipo do arquivo obrigatorio."),
  fileSizeBytes: z.number().int().positive("Tamanho do arquivo invalido.")
});

const talentProfileBaseSchema = z.object({
  displayName: z.string().trim().min(2, "Informe o nome de exibicao."),
  fullName: z.string().trim().min(3, "Informe o nome completo."),
  birthDate: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Data de nascimento invalida."),
  city: z.string().trim().min(2, "Informe a cidade.").optional(),
  stateCode: z
    .string()
    .trim()
    .min(2, "Informe o estado.")
    .max(3, "Use a sigla do estado.")
    .transform((value) => value.toUpperCase())
    .optional(),
  cityId: z.number().int().positive("Informe a cidade.").optional(),
  stateId: z.number().int().positive("Informe o estado.").optional(),
  bio: z.string().trim().max(2000, "A biografia esta muito longa.").optional(),
  introVideo: uploadedMediaSchema.nullable().optional(),
  galleryImages: z.array(uploadedMediaSchema).max(12, "Limite de 12 imagens na galeria.").optional().default([])
});

function validateTalentLocation(
  value: {
    city?: string;
    stateCode?: string;
    cityId?: number;
    stateId?: number;
  },
  context: z.RefinementCtx
) {
  const hasLegacyLocation = Boolean(value.city?.trim()) && Boolean(value.stateCode?.trim());
  const hasRelationalLocation = typeof value.cityId === "number" && typeof value.stateId === "number";

  if (!hasLegacyLocation && !hasRelationalLocation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cityId"],
      message: "Informe cidade e estado."
    });
  }
}

export const talentProfileSchema = talentProfileBaseSchema.superRefine(validateTalentLocation);

export const talentProfileSubmissionSchema = talentProfileBaseSchema
  .extend({
    requestType: z.enum(["initial_submission", "profile_update"]).optional()
  })
  .superRefine(validateTalentLocation);

export const voteChallengeRequestSchema = z.object({
  electionSlug: z.string().trim().min(1, "Informe a eleicao."),
  fingerprint: z.string().trim().min(8).max(512).optional()
});

export const castVoteSchema = z.object({
  challengeId: z.string().uuid("Challenge invalido."),
  electionCandidateId: z.string().uuid("Candidato invalido."),
  captchaAnswer: z.coerce.number().int("Resposta invalida."),
  fingerprint: z.string().trim().min(8).max(512).optional()
});

export type AuthCredentialsInput = z.infer<typeof authCredentialsSchema>;
export type TalentProfileInput = z.infer<typeof talentProfileSchema>;
export type TalentProfileSubmissionInput = z.infer<typeof talentProfileSubmissionSchema>;
export type VoteChallengeRequestInput = z.infer<typeof voteChallengeRequestSchema>;
export type CastVoteInputSchema = z.infer<typeof castVoteSchema>;
