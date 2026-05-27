import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  sendChannelLog,
  sendRankDropNotifications,
  type RankDropNotification,
} from "@/lib/discord/notifier";
import { parsePlayerDataHtml, parseSongScoreHtml } from "@/lib/maimai/parser";
import {
  detectRankingEvents,
  type RankingEvent,
  type ScoreEntry,
} from "@/lib/maimai/ranking";
import type { MaimaiIngestPayload } from "@/lib/ingest/schema";

interface IngestResult {
  ingestRunId: string;
  playerName: string;
  scoreCount: number;
  changedChartCount: number;
  rankDropCount: number;
}

interface LinkedDiscordProfile {
  discordUserId: string | null;
  discordUsername: string | null;
}

interface ChartMeta {
  chartTitle: string;
  difficultyLabel: string;
}

export async function ingestMaimaiPayload(
  supabase: SupabaseClient,
  user: User,
  payload: MaimaiIngestPayload,
): Promise<IngestResult> {
  const player = parsePlayerDataHtml(payload.playerHtml);
  const collectedAt = payload.collectedAt ?? new Date().toISOString();
  const discordProfile = getDiscordProfile(user);

  await upsertProfile(supabase, user.id, player, discordProfile);

  const run = await insertIngestRun(supabase, user.id, player.name);
  const allScores = payload.scorePages.flatMap(({ difficulty, html }) =>
    parseSongScoreHtml(html, difficulty),
  );
  const changedCharts = new Set<string>();
  const allRankDropEvents: Array<RankingEvent & ChartMeta> = [];

  try {
    for (const score of allScores) {
      const songId = await upsertSong(supabase, score.title, score.kind);
      const chartId = await upsertChart(supabase, songId, score);
      const before = await listChartScores(supabase, chartId);
      const previousActorScore =
        before.find((entry) => entry.userId === user.id)?.dxScore ?? null;

      await upsertPlayerScore(supabase, user.id, chartId, score, collectedAt);

      const after = await listChartScores(supabase, chartId);
      const events = detectRankingEvents({
        chartId,
        actorUserId: user.id,
        before,
        after,
        previousActorScore,
        nextActorScore: score.dxScore,
      });

      if (events.length > 0) {
        changedCharts.add(chartId);
        await markChartChanged(supabase, chartId);
        await insertRankingEvents(supabase, run.id, user.id, events);
        await insertScoreSnapshots(supabase, run.id, events);
      }

      for (const event of events) {
        if (event.type === "rank_dropped") {
          allRankDropEvents.push({
            ...event,
            chartTitle: score.title,
            difficultyLabel: score.difficultyLabel,
          });
        }
      }
    }

    await updateIngestRun(supabase, run.id, {
      status: "completed",
      score_count: allScores.length,
      changed_chart_count: changedCharts.size,
      completed_at: new Date().toISOString(),
    });

    await notifyRankDrops(supabase, run.id, allRankDropEvents);
    await notifyChannel(supabase, run.id, player.name, allScores.length, changedCharts.size);

    return {
      ingestRunId: run.id,
      playerName: player.name,
      scoreCount: allScores.length,
      changedChartCount: changedCharts.size,
      rankDropCount: allRankDropEvents.length,
    };
  } catch (error) {
    await updateIngestRun(supabase, run.id, {
      status: "failed",
      error_message: getErrorMessage(error),
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}

function getDiscordProfile(user: User): LinkedDiscordProfile {
  const identity = user.identities?.find((item) => item.provider === "discord");
  const identityData = identity?.identity_data ?? {};

  return {
    discordUserId:
      readString(identityData, "id") ??
      readString(user.user_metadata, "provider_id") ??
      readString(user.user_metadata, "sub"),
    discordUsername:
      readString(identityData, "username") ??
      readString(identityData, "full_name") ??
      readString(user.user_metadata, "name"),
  };
}

async function upsertProfile(
  supabase: SupabaseClient,
  profileId: string,
  player: {
    name: string;
    rating: number | null;
    trophy: string | null;
    currentVersionPlayCount: number | null;
    totalPlayCount: number | null;
  },
  discordProfile: LinkedDiscordProfile,
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: profileId,
      discord_user_id: discordProfile.discordUserId,
      discord_username: discordProfile.discordUsername,
      maimai_name: player.name,
      maimai_rating: player.rating,
      trophy: player.trophy,
      current_version_play_count: player.currentVersionPlayCount,
      total_play_count: player.totalPlayCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

async function insertIngestRun(
  supabase: SupabaseClient,
  profileId: string,
  playerName: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("ingest_runs")
    .insert({
      profile_id: profileId,
      player_name: playerName,
      status: "started",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create ingest run");
  }

  return data;
}

async function upsertSong(
  supabase: SupabaseClient,
  title: string,
  kind: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("songs")
    .upsert({ title, kind, updated_at: new Date().toISOString() }, { onConflict: "title,kind" })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to upsert song");
  }

  return data.id;
}

async function upsertChart(
  supabase: SupabaseClient,
  songId: string,
  score: ReturnType<typeof parseSongScoreHtml>[number],
): Promise<string> {
  const { data, error } = await supabase
    .from("song_charts")
    .upsert(
      {
        song_id: songId,
        difficulty: score.difficulty,
        difficulty_label: score.difficultyLabel,
        level: score.level,
        genre: score.genre,
        max_dx_score: score.maxDxScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "song_id,difficulty" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to upsert chart");
  }

  return data.id;
}

async function listChartScores(
  supabase: SupabaseClient,
  chartId: string,
): Promise<ScoreEntry[]> {
  const { data, error } = await supabase
    .from("player_scores")
    .select("profile_id, dx_score")
    .eq("chart_id", chartId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => ({
    userId: String(entry.profile_id),
    dxScore: Number(entry.dx_score),
  }));
}

async function upsertPlayerScore(
  supabase: SupabaseClient,
  profileId: string,
  chartId: string,
  score: ReturnType<typeof parseSongScoreHtml>[number],
  collectedAt: string,
): Promise<void> {
  const { error } = await supabase.from("player_scores").upsert(
    {
      profile_id: profileId,
      chart_id: chartId,
      achievement_rate: score.achievementRate,
      dx_score: score.dxScore,
      max_dx_score: score.maxDxScore,
      official_idx: score.officialIdx,
      collected_at: collectedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,chart_id" },
  );

  if (error) {
    throw error;
  }
}

async function markChartChanged(
  supabase: SupabaseClient,
  chartId: string,
): Promise<void> {
  const { error } = await supabase
    .from("song_charts")
    .update({
      last_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chartId);

  if (error) {
    throw error;
  }
}

async function insertRankingEvents(
  supabase: SupabaseClient,
  ingestRunId: string,
  actorProfileId: string,
  events: RankingEvent[],
): Promise<void> {
  const rows = events.map((event) => ({
    chart_id: event.chartId,
    profile_id: event.userId,
    actor_profile_id: actorProfileId,
    ingest_run_id: ingestRunId,
    event_type: event.type,
    previous_dx_score: event.previousDxScore,
    next_dx_score: event.nextDxScore,
    previous_rank: event.previousRank,
    next_rank: event.nextRank,
  }));
  const { error } = await supabase.from("ranking_events").insert(rows);

  if (error) {
    throw error;
  }
}

async function insertScoreSnapshots(
  supabase: SupabaseClient,
  ingestRunId: string,
  events: RankingEvent[],
): Promise<void> {
  const scoreEvents = events.filter((event) => event.type === "score_changed");

  if (scoreEvents.length === 0) {
    return;
  }

  const rows = scoreEvents.map((event) => ({
    profile_id: event.userId,
    chart_id: event.chartId,
    ingest_run_id: ingestRunId,
    previous_dx_score: event.previousDxScore,
    next_dx_score: event.nextDxScore,
    previous_rank: event.previousRank,
    next_rank: event.nextRank,
  }));
  const { error } = await supabase.from("score_snapshots").insert(rows);

  if (error) {
    throw error;
  }
}

async function updateIngestRun(
  supabase: SupabaseClient,
  runId: string,
  values: Record<string, string | number | null>,
): Promise<void> {
  const { error } = await supabase.from("ingest_runs").update(values).eq("id", runId);

  if (error) {
    throw error;
  }
}

async function notifyRankDrops(
  supabase: SupabaseClient,
  ingestRunId: string,
  events: Array<RankingEvent & ChartMeta>,
): Promise<void> {
  const grouped = new Map<string, Array<RankingEvent & ChartMeta>>();

  for (const event of events) {
    grouped.set(event.userId, [...(grouped.get(event.userId) ?? []), event]);
  }

  const notifications: RankDropNotification[] = [];

  for (const [profileId, profileEvents] of grouped) {
    const profile = await getProfileForNotification(supabase, profileId);
    if (!profile.dmAlertsEnabled) {
      continue;
    }

    notifications.push({
      profileId,
      discordUserId: profile.discordUserId,
      playerName: profile.playerName,
      events: profileEvents,
    });
  }

  const results = await sendRankDropNotifications(notifications);
  await insertNotificationResults(supabase, ingestRunId, results);
}

async function notifyChannel(
  supabase: SupabaseClient,
  ingestRunId: string,
  playerName: string,
  scoreCount: number,
  changedChartCount: number,
): Promise<void> {
  const result = await sendChannelLog(
    `${playerName}님이 ${scoreCount}개 점수를 갱신했습니다. 변동 차트: ${changedChartCount}개`,
  );
  await insertNotificationResults(supabase, ingestRunId, [result]);
}

async function getProfileForNotification(
  supabase: SupabaseClient,
  profileId: string,
): Promise<{
  playerName: string;
  discordUserId: string | null;
  dmAlertsEnabled: boolean;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("maimai_name, discord_user_id, dm_alerts_enabled")
    .eq("id", profileId)
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to load notification profile");
  }

  return {
    playerName: data.maimai_name ?? "Unknown",
    discordUserId: data.discord_user_id,
    dmAlertsEnabled: Boolean(data.dm_alerts_enabled),
  };
}

async function insertNotificationResults(
  supabase: SupabaseClient,
  ingestRunId: string,
  results: Array<{
    type: "dm" | "channel";
    profileId: string | null;
    status: "sent" | "failed" | "skipped";
    message: string;
    errorMessage: string | null;
  }>,
): Promise<void> {
  if (results.length === 0) {
    return;
  }

  const { error } = await supabase.from("discord_notifications").insert(
    results.map((result) => ({
      profile_id: result.profileId,
      ingest_run_id: ingestRunId,
      notification_type: result.type,
      status: result.status,
      message: result.message,
      error_message: result.errorMessage,
    })),
  );

  if (error) {
    throw error;
  }
}

function readString(source: object, key: string): string | null {
  if (!Object.hasOwn(source, key)) {
    return null;
  }

  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown ingest error";
}
