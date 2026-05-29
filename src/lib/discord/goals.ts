import type { SupabaseClient } from "@supabase/supabase-js";

import type { DailyChallengeGoal, RankGoal } from "@/lib/discord/messages";

export const DAILY_LEVEL_OPTIONS = [
  { label: "전체 레벨", value: "all" },
  { label: "10+", value: "10+" },
  { label: "11", value: "11" },
  { label: "11+", value: "11+" },
  { label: "12", value: "12" },
  { label: "12+", value: "12+" },
  { label: "13", value: "13" },
  { label: "13+", value: "13+" },
  { label: "14", value: "14" },
  { label: "14+", value: "14+" },
  { label: "15", value: "15" },
] as const;

export interface DailyChallengeUserOption {
  label: string;
  value: string;
}

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

export async function fetchDailyChallengeUserOptions(
  supabase: SupabaseClient,
  discordUserId: string,
): Promise<DailyChallengeUserOption[]> {
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (currentProfileError) {
    throw currentProfileError;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, maimai_name, discord_username")
    .not("maimai_name", "is", null)
    .order("maimai_name", { ascending: true })
    .limit(24);

  if (error) {
    throw error;
  }

  const currentProfileId = currentProfile ? String(currentProfile.id) : null;
  const userOptions = (data ?? [])
    .filter((profile) => String(profile.id) !== currentProfileId)
    .map((profile) => ({
      label: String(profile.maimai_name ?? profile.discord_username ?? "Unknown").slice(0, 100),
      value: String(profile.id),
    }));

  return [{ label: "전체 유저", value: "all" }, ...userOptions].slice(0, 25);
}

export async function fetchDailyChallengeGoals({
  supabase,
  discordUserId,
  level,
  targetProfileId,
  count = 3,
}: {
  supabase: SupabaseClient;
  discordUserId: string;
  level: string;
  targetProfileId: string;
  count?: number;
}): Promise<{ playerName: string; targetLabel: string; goals: DailyChallengeGoal[] }> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, maimai_name")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return { playerName: "Unknown", targetLabel: "전체 유저", goals: [] };
  }

  const profileId = String(profile.id);
  const playerName = typeof profile.maimai_name === "string" ? profile.maimai_name : "Unknown";
  const targetLabel = await fetchDailyTargetLabel(supabase, targetProfileId);
  let eventsQuery = supabase
    .from("ranking_events")
    .select("chart_id, actor_profile_id, ingest_run_id, created_at")
    .eq("profile_id", profileId)
    .eq("event_type", "rank_dropped")
    .not("actor_profile_id", "is", null)
    .not("ingest_run_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (targetProfileId !== "all") {
    eventsQuery = eventsQuery.eq("actor_profile_id", targetProfileId);
  }

  const { data: events, error: eventsError } = await eventsQuery;

  if (eventsError) {
    throw eventsError;
  }

  const eventTargets = uniqueEventTargets(
    (events ?? []).map((event) => ({
      chartId: String(event.chart_id),
      targetProfileId: String(event.actor_profile_id),
      ingestRunId: String(event.ingest_run_id),
    })),
  );

  if (eventTargets.length === 0) {
    return { playerName, targetLabel, goals: [] };
  }

  const chartIds = [...new Set(eventTargets.map((event) => event.chartId))];
  const { data: summaries, error: summariesError } = await supabase
    .from("chart_leaderboard_summary")
    .select("chart_id, title, difficulty_label, level")
    .in("chart_id", chartIds);

  if (summariesError) {
    throw summariesError;
  }

  const summariesByChartId = new Map(
    (summaries ?? []).map((summary) => [String(summary.chart_id), summary]),
  );
  const targetProfileIds = [
    ...new Set(eventTargets.map((event) => event.targetProfileId)),
  ];
  const { data: targetProfiles, error: targetProfilesError } = await supabase
    .from("profiles")
    .select("id, maimai_name, discord_username")
    .in("id", targetProfileIds);

  if (targetProfilesError) {
    throw targetProfilesError;
  }

  const targetNamesByProfileId = new Map(
    (targetProfiles ?? []).map((profile) => [
      String(profile.id),
      String(profile.maimai_name ?? profile.discord_username ?? "Unknown"),
    ]),
  );
  const notificationMessagesByRunId = await fetchSentPersonalLogMessagesByRunId(
    supabase,
    profileId,
    [...new Set(eventTargets.map((event) => event.ingestRunId))],
  );
  const { data: rankings, error: rankingsError } = await supabase
    .from("chart_rankings")
    .select("chart_id, profile_id, player_name, dx_score, rank")
    .in("chart_id", chartIds);

  if (rankingsError) {
    throw rankingsError;
  }

  const rankingsByChartId = new Map<string, typeof rankings>();
  for (const ranking of rankings ?? []) {
    const chartId = String(ranking.chart_id);
    const existing = rankingsByChartId.get(chartId) ?? [];
    existing.push(ranking);
    rankingsByChartId.set(chartId, existing);
  }

  const candidates: DailyChallengeGoal[] = [];
  for (const event of eventTargets) {
    const summary = summariesByChartId.get(event.chartId);
    if (!summary) {
      continue;
    }

    const targetPlayerName =
      targetNamesByProfileId.get(event.targetProfileId) ?? "Unknown";
    const runMessages = notificationMessagesByRunId.get(event.ingestRunId) ?? [];
    if (
      !hasMatchingPersonalRankDropLog({
        messages: runMessages,
        chartTitle: String(summary.title),
        targetPlayerName,
      })
    ) {
      continue;
    }

    const chartLevel = String(summary.level);
    if (level !== "all" && chartLevel !== level) {
      continue;
    }

    const chartRankings = rankingsByChartId.get(event.chartId) ?? [];
    const current = chartRankings.find(
      (ranking) => String(ranking.profile_id) === profileId,
    );
    const target = chartRankings.find(
      (ranking) => String(ranking.profile_id) === event.targetProfileId,
    );

    if (!current || !target) {
      continue;
    }

    const currentDxScore = Number(current.dx_score);
    const targetDxScore = Number(target.dx_score);
    const currentRank = Number(current.rank);
    const targetRank = Number(target.rank);

    if (targetDxScore <= currentDxScore || targetRank >= currentRank) {
      continue;
    }

    candidates.push({
      chartTitle: String(summary.title),
      level: chartLevel,
      difficultyLabel: String(summary.difficulty_label),
      currentRank,
      currentDxScore,
      targetPlayerName,
      targetRank,
      targetDxScore,
    });
  }

  return {
    playerName,
    targetLabel,
    goals: pickRandomItems(candidates, count),
  };
}

async function fetchDailyTargetLabel(
  supabase: SupabaseClient,
  targetProfileId: string,
): Promise<string> {
  if (targetProfileId === "all") {
    return "전체 유저";
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("maimai_name, discord_username")
    .eq("id", targetProfileId)
    .maybeSingle();

  if (error || !data) {
    return "선택한 유저";
  }

  return String(data.maimai_name ?? data.discord_username ?? "선택한 유저");
}

function uniqueEventTargets(
  events: Array<{ chartId: string; targetProfileId: string; ingestRunId: string }>,
): Array<{ chartId: string; targetProfileId: string; ingestRunId: string }> {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.chartId}:${event.targetProfileId}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchSentPersonalLogMessagesByRunId(
  supabase: SupabaseClient,
  profileId: string,
  ingestRunIds: string[],
): Promise<Map<string, string[]>> {
  if (ingestRunIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("discord_notifications")
    .select("ingest_run_id, message")
    .eq("profile_id", profileId)
    .eq("notification_type", "personal_channel")
    .eq("status", "sent")
    .in("ingest_run_id", ingestRunIds);

  if (error) {
    throw error;
  }

  const messagesByRunId = new Map<string, string[]>();
  for (const row of data ?? []) {
    const runId = String(row.ingest_run_id);
    const message = typeof row.message === "string" ? row.message : "";
    const existing = messagesByRunId.get(runId) ?? [];
    existing.push(message);
    messagesByRunId.set(runId, existing);
  }

  return messagesByRunId;
}

function hasMatchingPersonalRankDropLog({
  messages,
  chartTitle,
  targetPlayerName,
}: {
  messages: string[];
  chartTitle: string;
  targetPlayerName: string;
}): boolean {
  const normalizedTitle = normalizeDiscordLogText(chartTitle);
  const normalizedTargetPlayerName = normalizeDiscordLogText(targetPlayerName);

  return messages.some((message) => {
    const normalizedMessage = normalizeDiscordLogText(message);
    return (
      normalizedMessage.includes(normalizedTitle) &&
      normalizedMessage.includes(normalizedTargetPlayerName)
    );
  });
}

function normalizeDiscordLogText(value: string): string {
  return value.replace(/[\\*_~`|<>]/g, "").replace(/\s+/g, " ").trim();
}
