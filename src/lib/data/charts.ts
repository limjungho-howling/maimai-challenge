import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  updatedAt: string;
  rank: number;
}

export async function listCharts({
  difficulty,
  page,
  pageSize,
}: {
  difficulty: number | null;
  page: number;
  pageSize: number;
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
