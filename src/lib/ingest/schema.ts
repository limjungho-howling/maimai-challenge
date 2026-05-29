import { z } from "zod";

import { RANKING_DIFFICULTIES } from "@/lib/maimai/constants";

const difficultySchema = z.union([
  z.literal(RANKING_DIFFICULTIES[0]),
  z.literal(RANKING_DIFFICULTIES[1]),
]);

const scorePagesSchema = z
  .array(
    z.object({
      difficulty: difficultySchema,
      html: z.string().min(1),
    }),
  )
  .min(1)
  .max(2)
  .refine(
    (pages) => new Set(pages.map((page) => page.difficulty)).size === pages.length,
    "scorePages must not contain duplicate difficulties",
  );

const catalogScorePagesSchema = z
  .array(
    z.object({
      difficulty: difficultySchema,
      html: z.string().min(1),
      version: z.number().int().min(0).max(25).nullable().optional(),
      versionName: z.string().min(1).nullable().optional(),
    }),
  )
  .min(1)
  .max(52)
  .refine(
    (pages) =>
      new Set(
        pages.map((page) => `${page.version ?? "unknown"}:${page.difficulty}`),
      ).size === pages.length,
    "scorePages must not contain duplicate version/difficulty pages",
  );

const detailPagesSchema = z.array(
  z.object({
    idx: z.string().min(1),
    html: z.string().min(1),
    jacketUrl: z.string().url().nullable().optional(),
  }),
);

export const ingestPayloadSchema = z.object({
  playerHtml: z.string().min(1),
  scorePages: scorePagesSchema,
  detailPages: detailPagesSchema.optional(),
  collectedAt: z.string().datetime().optional(),
});

export const catalogPayloadSchema = z.object({
  scorePages: catalogScorePagesSchema,
  detailPages: detailPagesSchema.optional().default([]),
  collectedAt: z.string().datetime().optional(),
});

export const legacyIngestPayloadSchema = z.object({
  playerHtml: z.string().min(1),
  scorePages: z
    .array(
      z.object({
        difficulty: difficultySchema,
        html: z.string().min(1),
      }),
    )
    .min(1)
    .max(2)
    .refine(
      (pages) => new Set(pages.map((page) => page.difficulty)).size === pages.length,
      "scorePages must not contain duplicate difficulties",
    ),
  detailPages: z
    .array(
      z.object({
        idx: z.string().min(1),
        html: z.string().min(1),
        jacketUrl: z.string().url().nullable().optional(),
      }),
    )
    .optional(),
  collectedAt: z.string().datetime().optional(),
});

export type MaimaiIngestPayload = z.infer<typeof ingestPayloadSchema>;
export type MaimaiCatalogPayload = z.infer<typeof catalogPayloadSchema>;
