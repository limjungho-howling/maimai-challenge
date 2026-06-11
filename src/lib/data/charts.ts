import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

const SELECT_PAGE_SIZE = 1000;
const CHART_ID_FILTER_CHUNK_SIZE = 100;
export const CHART_LIST_CACHE_TAG = "chart-list";
const CHART_LIST_CACHE_VERSION = "v3";

export interface ChartSummary {
  chartId: string;
  title: string;
  jacketUrl: string | null;
  kind: string;
  versionNumber: number | null;
  versionName: string | null;
  difficulty: number;
  difficultyLabel: string;
  level: string;
  genre: string | null;
  maxDxScore: number;
  lastChangedAt: string | null;
  leaderDxScore: number | null;
  leaderName: string | null;
  leaderCount: number;
}

export type ChartSort = "fewest-five-stars" | "recent";

export interface ChartRanking {
  chartId: string;
  profileId: string;
  playerName: string;
  discordUsername: string | null;
  achievementRate: number | null;
  dxScore: number;
  maxDxScore: number;
  dxStarCount: number;
  updatedAt: string;
  rank: number;
}

export async function listCharts({
  difficulty,
  leaderProfileId,
  level,
  page,
  pageSize,
  search,
  sort,
  version,
}: {
  difficulty: number | null;
  leaderProfileId: string | null;
  level: string | null;
  page: number;
  pageSize: number;
  search: string | null;
  sort: ChartSort;
  version: number | null;
}): Promise<{ charts: ChartSummary[]; count: number }> {
  return cachedListCharts({
    difficulty,
    leaderProfileId,
    level,
    page,
    pageSize,
    search,
    sort,
    version,
  });
}

const cachedListCharts = unstable_cache(
  async ({
    difficulty,
    leaderProfileId,
    level,
    page,
    pageSize,
    search,
    sort,
    version,
  }: {
    difficulty: number | null;
    leaderProfileId: string | null;
    level: string | null;
    page: number;
    pageSize: number;
    search: string | null;
    sort: ChartSort;
    version: number | null;
  }): Promise<{ charts: ChartSummary[]; count: number }> => {
  if (!hasSupabasePublicEnv()) {
    return { charts: [], count: 0 };
  }

  const supabase = createSupabasePublicReadClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let rows = await fetchAllChartSummaries(supabase, {
    difficulty,
    level,
    search,
    sort,
    version,
  });

  if (leaderProfileId) {
    const firstPlaceChartIds = await fetchFirstPlaceChartIds(supabase, leaderProfileId);
    if (firstPlaceChartIds.size === 0) {
      return { charts: [], count: 0 };
    }

    rows = rows.filter((row) => firstPlaceChartIds.has(String(row.chart_id)));
  }

  return {
    charts: rows.slice(from, to + 1).map(mapChartSummary),
    count: rows.length,
  };
  },
  ["chart-list", CHART_LIST_CACHE_VERSION],
  { revalidate: false, tags: [CHART_LIST_CACHE_TAG] },
);

async function fetchFirstPlaceChartIds(
  supabase: ReturnType<typeof createSupabasePublicReadClient>,
  profileId: string,
): Promise<Set<string>> {
  const chartIds = new Set<string>();

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chart_rankings")
      .select("chart_id")
      .eq("profile_id", profileId)
      .eq("rank", 1)
      .range(from, from + SELECT_PAGE_SIZE - 1);

    if (error) {
      console.error(error);
      return new Set();
    }

    for (const row of data ?? []) {
      chartIds.add(String(row.chart_id));
    }

    if ((data ?? []).length < SELECT_PAGE_SIZE) {
      return chartIds;
    }
  }
}

async function fetchAllChartSummaries(
  supabase: ReturnType<typeof createSupabasePublicReadClient>,
  {
    difficulty,
    level,
    search,
    sort,
    version,
  }: {
    difficulty: number | null;
    level: string | null;
    search: string | null;
    sort: ChartSort;
    version: number | null;
  },
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    let query = supabase
      .from("chart_leaderboard_summary")
      .select("*")
      .order("last_changed_at", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true })
      .order("chart_id", { ascending: true })
      .range(from, from + SELECT_PAGE_SIZE - 1);

    if (difficulty !== null) {
      query = query.eq("difficulty", difficulty);
    }

    if (level) {
      query = query.eq("level", level);
    }

    if (version !== null) {
      query = query.eq("version_number", version);
    }

    if (search) {
      query = query.ilike("title", `%${escapeLikePattern(search)}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return [];
    }

    rows.push(...((data ?? []) as Array<Record<string, unknown>>));

    if ((data ?? []).length < SELECT_PAGE_SIZE) {
      return sort === "fewest-five-stars"
        ? sortChartsByFewestFiveStars(supabase, rows)
        : rows;
    }
  }
}

async function sortChartsByFewestFiveStars(
  supabase: ReturnType<typeof createSupabasePublicReadClient>,
  rows: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (rows.length === 0) {
    return rows;
  }

  const fiveStarCountsByChartId = await fetchFiveStarCountsByChartId(
    supabase,
    rows.map((row) => String(row.chart_id)),
  );

  return [...rows].sort((left, right) => {
    const leftFiveStars = fiveStarCountsByChartId.get(String(left.chart_id)) ?? 0;
    const rightFiveStars = fiveStarCountsByChartId.get(String(right.chart_id)) ?? 0;

    if (leftFiveStars !== rightFiveStars) {
      return leftFiveStars - rightFiveStars;
    }

    return compareDefaultChartOrder(left, right);
  });
}

async function fetchFiveStarCountsByChartId(
  supabase: ReturnType<typeof createSupabasePublicReadClient>,
  chartIds: string[],
): Promise<Map<string, number>> {
  const countsByChartId = new Map<string, number>();
  const uniqueChartIds = [...new Set(chartIds)];

  for (let index = 0; index < uniqueChartIds.length; index += CHART_ID_FILTER_CHUNK_SIZE) {
    const chunk = uniqueChartIds.slice(index, index + CHART_ID_FILTER_CHUNK_SIZE);

    for (let from = 0; ; from += SELECT_PAGE_SIZE) {
      const to = from + SELECT_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("player_scores")
        .select("chart_id,profile_id")
        .eq("dx_star_count", 5)
        .in("chart_id", chunk)
        .order("chart_id", { ascending: true })
        .order("profile_id", { ascending: true })
        .range(from, to);

      if (error) {
        console.error(error);
        return new Map();
      }

      for (const row of data ?? []) {
        const chartId = String(row.chart_id);
        countsByChartId.set(chartId, (countsByChartId.get(chartId) ?? 0) + 1);
      }

      if ((data ?? []).length < SELECT_PAGE_SIZE) {
        break;
      }
    }
  }

  return countsByChartId;
}

function compareDefaultChartOrder(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number {
  const leftChangedAt = parseSortableTime(left.last_changed_at);
  const rightChangedAt = parseSortableTime(right.last_changed_at);

  if (leftChangedAt !== rightChangedAt) {
    return rightChangedAt - leftChangedAt;
  }

  const titleOrder = String(left.title).localeCompare(String(right.title));
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return String(left.chart_id).localeCompare(String(right.chart_id));
}

function parseSortableTime(value: unknown): number {
  return typeof value === "string" ? new Date(value).getTime() || 0 : 0;
}

export async function listChartLevels(): Promise<string[]> {
  return cachedListChartLevels();
}

const cachedListChartLevels = unstable_cache(
  async (): Promise<string[]> => {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  const supabase = createSupabasePublicReadClient();
  const rows: Array<{ level: unknown }> = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chart_leaderboard_summary")
      .select("level")
      .in("difficulty", [3, 4])
      .range(from, from + SELECT_PAGE_SIZE - 1);

    if (error) {
      console.error(error);
      return [];
    }

    rows.push(...(data ?? []));

    if ((data ?? []).length < SELECT_PAGE_SIZE) {
      break;
    }
  }

  return [...new Set(rows.map((row) => String(row.level)).filter(Boolean))]
    .sort(compareLevels);
  },
  ["chart-levels"],
  { revalidate: false, tags: [CHART_LIST_CACHE_TAG] },
);

export async function listChartVersions(): Promise<Array<{ number: number; name: string }>> {
  return cachedListChartVersions();
}

const cachedListChartVersions = unstable_cache(
  async (): Promise<Array<{ number: number; name: string }>> => {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  const supabase = createSupabasePublicReadClient();
  const rows: Array<{ version_number: unknown; version_name: unknown }> = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chart_leaderboard_summary")
      .select("version_number,version_name")
      .in("difficulty", [3, 4])
      .not("version_number", "is", null)
      .range(from, from + SELECT_PAGE_SIZE - 1);

    if (error) {
      console.error(error);
      return [];
    }

    rows.push(...(data ?? []));

    if ((data ?? []).length < SELECT_PAGE_SIZE) {
      break;
    }
  }

  const versionsByNumber = new Map<number, string>();
  for (const row of rows) {
    const number = Number(row.version_number);
    const name = typeof row.version_name === "string" ? row.version_name : null;
    if (Number.isInteger(number) && name) {
      versionsByNumber.set(number, name);
    }
  }

  return [...versionsByNumber.entries()]
    .sort(([left], [right]) => left - right)
    .map(([number, name]) => ({ number, name }));
  },
  ["chart-versions"],
  { revalidate: false, tags: [CHART_LIST_CACHE_TAG] },
);

export async function getChartSummary(chartId: string): Promise<ChartSummary | null> {
  return cachedGetChartSummary(chartId);
}

const cachedGetChartSummary = unstable_cache(
  async (chartId: string): Promise<ChartSummary | null> => {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  const supabase = createSupabasePublicReadClient();
  const { data, error } = await supabase
    .from("chart_leaderboard_summary")
    .select("*")
    .eq("chart_id", chartId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapChartSummary(data);
  },
  ["chart-summary"],
  { revalidate: 60, tags: [CHART_LIST_CACHE_TAG] },
);

export async function listChartRankings(chartId: string): Promise<ChartRanking[]> {
  return cachedListChartRankings(chartId);
}

const cachedListChartRankings = unstable_cache(
  async (chartId: string): Promise<ChartRanking[]> => {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  const supabase = createSupabasePublicReadClient();
  const { data, error } = await supabase
    .from("chart_rankings")
    .select("*")
    .eq("chart_id", chartId)
    .order("rank", { ascending: true })
    .order("dx_score", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return mapChartRankingRows(data ?? []);
  },
  ["chart-rankings"],
  { revalidate: 60, tags: [CHART_LIST_CACHE_TAG] },
);

export function mapChartRankingRows(
  rows: Array<Record<string, unknown>>,
): ChartRanking[] {
  return rows.map((row) => ({
    chartId: String(row.chart_id),
    profileId: String(row.profile_id),
    playerName: typeof row.player_name === "string" ? row.player_name : "Unknown",
    discordUsername:
      typeof row.discord_username === "string" ? row.discord_username : null,
    achievementRate:
      row.achievement_rate === null ? null : Number(row.achievement_rate),
    dxScore: Number(row.dx_score),
    maxDxScore: Number(row.max_dx_score),
    dxStarCount: Number(row.dx_star_count ?? 0),
    updatedAt: String(row.updated_at),
    rank: Number(row.rank),
  }));
}

function mapChartSummary(row: Record<string, unknown>): ChartSummary {
  return {
    chartId: String(row.chart_id),
    title: String(row.title),
    jacketUrl: typeof row.jacket_url === "string" ? row.jacket_url : null,
    kind: String(row.kind),
    versionNumber:
      row.version_number === null || row.version_number === undefined
        ? null
        : Number(row.version_number),
    versionName: typeof row.version_name === "string" ? row.version_name : null,
    difficulty: Number(row.difficulty),
    difficultyLabel: String(row.difficulty_label),
    level: String(row.level),
    genre: typeof row.genre === "string" ? row.genre : null,
    maxDxScore: Number(row.max_dx_score),
    lastChangedAt:
      typeof row.last_changed_at === "string" ? row.last_changed_at : null,
    leaderDxScore:
      row.leader_dx_score === null || row.leader_dx_score === undefined
        ? null
        : Number(row.leader_dx_score),
    leaderName: typeof row.leader_name === "string" ? row.leader_name : null,
    leaderCount: Number(row.leader_count ?? 0),
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function compareLevels(left: string, right: string): number {
  const leftValue = levelSortValue(left);
  const rightValue = levelSortValue(right);
  return leftValue === rightValue ? left.localeCompare(right) : leftValue - rightValue;
}

function levelSortValue(level: string): number {
  const match = level.match(/^(\d+)(\+)?$/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[1]) * 10 + (match[2] ? 1 : 0);
}

function createSupabasePublicReadClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
