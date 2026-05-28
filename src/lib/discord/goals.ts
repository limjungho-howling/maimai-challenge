import type { SupabaseClient } from "@supabase/supabase-js";

import type { RankGoal } from "@/lib/discord/messages";

export function pickRandomItems<T>(
  items: T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const pool = [...items];
  const picked: T[] = [];

  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

export async function fetchRankGoalsForDiscordUser(
  supabase: SupabaseClient,
  discordUserId: string,
  count = 3,
): Promise<{ playerName: string; goals: RankGoal[] }> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, maimai_name")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return { playerName: "Unknown", goals: [] };
  }

  const profileId = String(profile.id);
  const playerName = typeof profile.maimai_name === "string" ? profile.maimai_name : "Unknown";
  const { data: events, error: eventsError } = await supabase
    .from("ranking_events")
    .select("chart_id, created_at")
    .eq("profile_id", profileId)
    .eq("event_type", "rank_dropped")
    .order("created_at", { ascending: false })
    .limit(50);

  if (eventsError) {
    throw eventsError;
  }

  const chartIds = [
    ...new Set((events ?? []).map((event) => String(event.chart_id))),
  ];
  const pickedChartIds = pickRandomItems(chartIds, count);

  if (pickedChartIds.length === 0) {
    return { playerName, goals: [] };
  }

  const { data: summaries, error: summariesError } = await supabase
    .from("chart_leaderboard_summary")
    .select("chart_id, title, difficulty_label, max_dx_score")
    .in("chart_id", pickedChartIds);

  if (summariesError) {
    throw summariesError;
  }

  const summariesByChartId = new Map(
    (summaries ?? []).map((summary) => [String(summary.chart_id), summary]),
  );
  const goals: RankGoal[] = [];

  for (const chartId of pickedChartIds) {
    const { data: rankings, error: rankingsError } = await supabase
      .from("chart_rankings")
      .select("profile_id, player_name, dx_score, max_dx_score, rank")
      .eq("chart_id", chartId)
      .order("rank", { ascending: true })
      .order("dx_score", { ascending: false });

    if (rankingsError) {
      throw rankingsError;
    }

    const current = (rankings ?? []).find(
      (ranking) => String(ranking.profile_id) === profileId,
    );
    const summary = summariesByChartId.get(chartId);

    if (!current || !summary) {
      continue;
    }

    const currentRank = Number(current.rank);
    const currentDxScore = Number(current.dx_score);

    goals.push({
      chartTitle: String(summary.title),
      difficultyLabel: String(summary.difficulty_label),
      currentRank,
      currentDxScore,
      maxDxScore: Number(current.max_dx_score ?? summary.max_dx_score),
      higherScores: (rankings ?? [])
        .filter((ranking) => Number(ranking.dx_score) > currentDxScore)
        .slice(0, 5)
        .map((ranking) => ({
          playerName: String(ranking.player_name ?? "Unknown"),
          dxScore: Number(ranking.dx_score),
          rank: Number(ranking.rank),
        })),
    });
  }

  return { playerName, goals };
}
