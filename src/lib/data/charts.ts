import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SELECT_PAGE_SIZE = 1000;

export interface ChartSummary {
  chartId: string;
  title: string;
  jacketUrl: string | null;
  kind: string;
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
  level,
  page,
  pageSize,
  search,
}: {
  difficulty: number | null;
  level: string | null;
  page: number;
  pageSize: number;
  search: string | null;
}): Promise<{ charts: ChartSummary[]; count: number }> {
  if (!hasSupabasePublicEnv()) {
    return { charts: [], count: 0 };
  }

  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("chart_leaderboard_summary")
    .select("*", { count: "exact" })
    .order("last_changed_at", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .range(from, to);

  if (difficulty !== null) {
    query = query.eq("difficulty", difficulty);
  }

  if (level) {
    query = query.eq("level", level);
  }

  if (search) {
    query = query.ilike("title", `%${escapeLikePattern(search)}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error(error);
    return { charts: [], count: 0 };
  }

  return {
    charts: (data ?? []).map(mapChartSummary),
    count: count ?? 0,
  };
}

export async function listChartLevels(): Promise<string[]> {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
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
}

export async function getChartSummary(chartId: string): Promise<ChartSummary | null> {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chart_leaderboard_summary")
    .select("*")
    .eq("chart_id", chartId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapChartSummary(data);
}

export async function listChartRankings(chartId: string): Promise<ChartRanking[]> {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
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

  return (data ?? []).map((row) => ({
    chartId: String(row.chart_id),
    profileId: String(row.profile_id),
    playerName: row.player_name ?? "Unknown",
    discordUsername: row.discord_username,
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
