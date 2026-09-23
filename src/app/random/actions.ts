"use server";

import { z } from "zod";

import { listCharts, type ChartSummary } from "@/lib/data/charts";
import { MAIMAI_VERSIONS, RANKING_DIFFICULTIES } from "@/lib/maimai/constants";
import type { RandomPoolChart } from "@/lib/random/pool";

// Every value export in a "use server" file must be an async function, so the
// knobs below stay module-private.
const RANDOM_SEARCH_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;
const MAX_LEVEL_LENGTH = 8;
const MAX_PAGE = 500;
const MAX_VERSION_NUMBER = Math.max(
  ...MAIMAI_VERSIONS.map((version) => version.number),
);

const difficultySchema = z.union([
  z.literal(RANKING_DIFFICULTIES[0]),
  z.literal(RANKING_DIFFICULTIES[1]),
]);

const searchInputSchema = z.object({
  q: z.string().max(MAX_SEARCH_LENGTH).catch(""),
  level: z.string().max(MAX_LEVEL_LENGTH).catch(""),
  version: z.number().int().min(0).max(MAX_VERSION_NUMBER).nullable().catch(null),
  difficulty: difficultySchema.nullable().catch(null),
  page: z.number().int().min(1).max(MAX_PAGE).catch(1),
});

const FALLBACK_INPUT: z.infer<typeof searchInputSchema> = {
  q: "",
  level: "",
  version: null,
  difficulty: null,
  page: 1,
};

export interface RandomSearchResult {
  charts: RandomPoolChart[];
  page: number;
  pageCount: number;
  count: number;
}

export async function searchRandomPoolCharts(
  input: unknown,
): Promise<RandomSearchResult> {
  const parsed = searchInputSchema.safeParse(input);
  const { q, level, version, difficulty, page } = parsed.success
    ? parsed.data
    : FALLBACK_INPUT;
  const search = q.trim();

  const { charts, count } = await listCharts({
    difficulty,
    leaderProfileId: null,
    level: level.trim() || null,
    page,
    pageSize: RANDOM_SEARCH_PAGE_SIZE,
    search: search || null,
    sort: "recent",
    version,
  });

  return {
    charts: charts.map(toRandomPoolChart),
    page,
    pageCount: Math.max(1, Math.ceil(count / RANDOM_SEARCH_PAGE_SIZE)),
    count,
  };
}

/** Only the fields the picker renders — leaderboard scores stay on the server. */
function toRandomPoolChart(chart: ChartSummary): RandomPoolChart {
  return {
    chartId: chart.chartId,
    title: chart.title,
    jacketUrl: chart.jacketUrl,
    kind: chart.kind,
    difficulty: chart.difficulty,
    level: chart.level,
    versionName: chart.versionName,
  };
}
