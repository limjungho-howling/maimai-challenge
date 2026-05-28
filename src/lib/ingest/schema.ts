import { z } from "zod";

import { RANKING_DIFFICULTIES } from "@/lib/maimai/constants";

const difficultySchema = z.union([
  z.literal(RANKING_DIFFICULTIES[0]),
  z.literal(RANKING_DIFFICULTIES[1]),
]);

export const ingestPayloadSchema = z.object({
  playerHtml: z.string().min(1),
  scorePages: z
    .array(
      z.object({
        difficulty: difficultySchema,
        html: z.string().min(1),
      }),
    )
    .length(2),
  detailPages: z
    .array(
      z.object({
        idx: z.string().min(1),
        html: z.string().min(1),
      }),
    )
    .optional(),
  collectedAt: z.string().datetime().optional(),
});

export type MaimaiIngestPayload = z.infer<typeof ingestPayloadSchema>;
