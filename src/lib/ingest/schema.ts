import { z } from "zod";

import { DIFFICULTIES } from "@/lib/maimai/constants";

const difficultySchema = z.union([
  z.literal(DIFFICULTIES[0]),
  z.literal(DIFFICULTIES[1]),
  z.literal(DIFFICULTIES[2]),
  z.literal(DIFFICULTIES[3]),
  z.literal(DIFFICULTIES[4]),
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
    .length(5),
  collectedAt: z.string().datetime().optional(),
});

export type MaimaiIngestPayload = z.infer<typeof ingestPayloadSchema>;
