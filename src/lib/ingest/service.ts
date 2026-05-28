import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  sendChannelLog,
  sendRankDropNotifications,
  type RankDropNotification,
} from "@/lib/discord/notifier";
import { detectBulkRankingEvents } from "@/lib/ingest/bulk-ranking";
import {
  parseSongDetailHtml,
  parsePlayerDataHtml,
  parseSongScoreHtml,
  type ParsedSongScore,
} from "@/lib/maimai/parser";
import type { RankingEvent, ScoreEntry } from "@/lib/maimai/ranking";
import type { MaimaiIngestPayload } from "@/lib/ingest/schema";

const DB_CHUNK_SIZE = 500;

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

export interface IngestProgress {
  stage:
    | "parsing"
    | "songs"
    | "charts"
    | "rankings"
    | "scores"
    | "events"
    | "notifications"
    | "completed";
  message: string;
  current: number;
  total: number;
}

export type IngestProgressReporter = (progress: IngestProgress) => void | Promise<void>;

export async function ingestMaimaiPayload(
  supabase: SupabaseClient,
  user: User,
  payload: MaimaiIngestPayload,
  onProgress?: IngestProgressReporter,
): Promise<IngestResult> {
  await reportProgress(onProgress, {
    stage: "parsing",
    message: "공식 페이지 HTML을 파싱하는 중입니다.",
    current: 0,
    total: 100,
  });

  const player = parsePlayerDataHtml(payload.playerHtml);
  const collectedAt = payload.collectedAt ?? new Date().toISOString();
  const discordProfile = getDiscordProfile(user);

  await upsertProfile(supabase, user.id, player, discordProfile);

  const run = await insertIngestRun(supabase, user.id, player.name);
  const allScores = payload.scorePages.flatMap(({ difficulty, html }) =>
    parseSongScoreHtml(html, difficulty),
  );
  const jacketUrlsByIdx = new Map(
    (payload.detailPages ?? [])
      .map(({ idx, html }) => parseSongDetailHtml(html, idx))
      .filter((detail) => detail.jacketUrl)
      .map((detail) => [detail.officialIdx, detail.jacketUrl] as const),
  );
  const uniqueScores = dedupeScores(
    allScores.map((score) => ({
      ...score,
      jacketUrl:
        score.jacketUrl ??
        (score.officialIdx ? jacketUrlsByIdx.get(score.officialIdx) ?? null : null),
    })),
  );

  try {
    await reportProgress(onProgress, {
      stage: "songs",
      message: "곡 정보를 묶음으로 저장하는 중입니다.",
      current: 10,
      total: 100,
    });
    const songsByKey = await upsertSongs(supabase, uniqueScores);

    await reportProgress(onProgress, {
      stage: "charts",
      message: "난이도별 차트 정보를 묶음으로 저장하는 중입니다.",
      current: 28,
      total: 100,
    });
    const chartsByKey = await upsertCharts(supabase, uniqueScores, songsByKey);
    const scoreUpdates = uniqueScores.map((score) => ({
      score,
      chartId: getRequiredMapValue(chartsByKey, chartKey(score)),
    }));
    const chartIds = scoreUpdates.map((update) => update.chartId);

    await reportProgress(onProgress, {
      stage: "rankings",
      message: "기존 랭킹을 한 번에 불러오는 중입니다.",
      current: 48,
      total: 100,
    });
    const beforeScoresByChartId = await listScoresForCharts(supabase, chartIds);
    const rankingResult = detectBulkRankingEvents({
      actorUserId: user.id,
      beforeScoresByChartId,
      updates: scoreUpdates.map(({ score, chartId }) => ({
        chartId,
        title: score.title,
        difficultyLabel: score.difficultyLabel,
        dxScore: score.dxScore,
      })),
    });

    await reportProgress(onProgress, {
      stage: "scores",
      message: "플레이어 점수를 묶음으로 저장하는 중입니다.",
      current: 66,
      total: 100,
    });
    await upsertPlayerScores(supabase, user.id, scoreUpdates, collectedAt);

    await reportProgress(onProgress, {
      stage: "events",
      message: "랭킹 변동 기록을 저장하는 중입니다.",
      current: 82,
      total: 100,
    });
    if (rankingResult.events.length > 0) {
      await markChartsChanged(supabase, [...rankingResult.changedChartIds]);
      await insertRankingEvents(supabase, run.id, user.id, rankingResult.events);
      await insertScoreSnapshots(supabase, run.id, rankingResult.events);
    }

    await updateIngestRun(supabase, run.id, {
      status: "completed",
      score_count: allScores.length,
      changed_chart_count: rankingResult.changedChartIds.size,
      completed_at: new Date().toISOString(),
    });

    await reportProgress(onProgress, {
      stage: "notifications",
      message: "Discord 알림을 처리하는 중입니다.",
      current: 92,
      total: 100,
    });
    await notifyRankDrops(supabase, run.id, rankingResult.rankDropEvents);
    await notifyChannel(
      supabase,
      run.id,
      player.name,
      allScores.length,
      rankingResult.changedChartIds.size,
    );

    await reportProgress(onProgress, {
      stage: "completed",
      message: "업로드 처리가 완료되었습니다.",
      current: 100,
      total: 100,
    });

    return {
      ingestRunId: run.id,
      playerName: player.name,
      scoreCount: allScores.length,
      changedChartCount: rankingResult.changedChartIds.size,
      rankDropCount: rankingResult.rankDropEvents.length,
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

async function upsertSongs(
  supabase: SupabaseClient,
  scores: ParsedSongScore[],
): Promise<Map<string, string>> {
  const songs = uniqueBy(
    scores.map((score) => ({
      title: score.title,
      kind: score.kind,
      jacket_url: score.jacketUrl,
      updated_at: new Date().toISOString(),
    })),
    (song) => songKey(song.title, song.kind),
  );
  const idsByKey = new Map<string, string>();

  for (const chunk of chunks(songs, DB_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("songs")
      .upsert(chunk, { onConflict: "title,kind" })
      .select("id,title,kind");

    if (error || !data) {
      throw error ?? new Error("Failed to upsert songs");
    }

    for (const row of data) {
      idsByKey.set(songKey(String(row.title), String(row.kind)), String(row.id));
    }
  }

  return idsByKey;
}

async function upsertCharts(
  supabase: SupabaseClient,
  scores: ParsedSongScore[],
  songsByKey: Map<string, string>,
): Promise<Map<string, string>> {
  const charts = scores.map((score) => ({
    song_id: getRequiredMapValue(songsByKey, songKey(score.title, score.kind)),
    difficulty: score.difficulty,
    difficulty_label: score.difficultyLabel,
    level: score.level,
    genre: score.genre,
    max_dx_score: score.maxDxScore,
    updated_at: new Date().toISOString(),
  }));
  const idsByKey = new Map<string, string>();

  for (const chunk of chunks(charts, DB_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("song_charts")
      .upsert(chunk, { onConflict: "song_id,difficulty" })
      .select("id,song_id,difficulty");

    if (error || !data) {
      throw error ?? new Error("Failed to upsert charts");
    }

    for (const row of data) {
      idsByKey.set(chartKeyFromParts(String(row.song_id), Number(row.difficulty)), String(row.id));
    }
  }

  const chartIdsByScoreKey = new Map<string, string>();
  for (const score of scores) {
    const songId = getRequiredMapValue(songsByKey, songKey(score.title, score.kind));
    chartIdsByScoreKey.set(
      chartKey(score),
      getRequiredMapValue(idsByKey, chartKeyFromParts(songId, score.difficulty)),
    );
  }

  return chartIdsByScoreKey;
}

async function listScoresForCharts(
  supabase: SupabaseClient,
  chartIds: string[],
): Promise<Map<string, ScoreEntry[]>> {
  const scoresByChartId = new Map<string, ScoreEntry[]>();

  for (const chunk of chunks([...new Set(chartIds)], DB_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("player_scores")
      .select("chart_id, profile_id, dx_score")
      .in("chart_id", chunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const chartId = String(row.chart_id);
      scoresByChartId.set(chartId, [
        ...(scoresByChartId.get(chartId) ?? []),
        {
          userId: String(row.profile_id),
          dxScore: Number(row.dx_score),
        },
      ]);
    }
  }

  return scoresByChartId;
}

async function upsertPlayerScores(
  supabase: SupabaseClient,
  profileId: string,
  updates: Array<{ chartId: string; score: ParsedSongScore }>,
  collectedAt: string,
): Promise<void> {
  const rows = updates.map(({ chartId, score }) => ({
    profile_id: profileId,
    chart_id: chartId,
    achievement_rate: score.achievementRate,
    dx_score: score.dxScore,
    max_dx_score: score.maxDxScore,
    official_idx: score.officialIdx,
    collected_at: collectedAt,
    updated_at: new Date().toISOString(),
  }));

  for (const chunk of chunks(rows, DB_CHUNK_SIZE)) {
    const { error } = await supabase
      .from("player_scores")
      .upsert(chunk, { onConflict: "profile_id,chart_id" });

    if (error) {
      throw error;
    }
  }
}

async function markChartsChanged(
  supabase: SupabaseClient,
  chartIds: string[],
): Promise<void> {
  if (chartIds.length === 0) {
    return;
  }

  const changedAt = new Date().toISOString();
  for (const chunk of chunks(chartIds, DB_CHUNK_SIZE)) {
    const { error } = await supabase
      .from("song_charts")
      .update({
        last_changed_at: changedAt,
        updated_at: changedAt,
      })
      .in("id", chunk);

    if (error) {
      throw error;
    }
  }
}

async function insertRankingEvents(
  supabase: SupabaseClient,
  ingestRunId: string,
  actorProfileId: string,
  events: RankingEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

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

  for (const chunk of chunks(rows, DB_CHUNK_SIZE)) {
    const { error } = await supabase.from("ranking_events").insert(chunk);

    if (error) {
      throw error;
    }
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
  for (const chunk of chunks(rows, DB_CHUNK_SIZE)) {
    const { error } = await supabase.from("score_snapshots").insert(chunk);

    if (error) {
      throw error;
    }
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
  const profilesById = await listProfilesForNotification(supabase, [...grouped.keys()]);

  for (const [profileId, profileEvents] of grouped) {
    const profile = profilesById.get(profileId);
    if (!profile) {
      continue;
    }

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

async function listProfilesForNotification(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<
  Map<
    string,
    {
      playerName: string;
      discordUserId: string | null;
      dmAlertsEnabled: boolean;
    }
  >
> {
  const profilesById = new Map<
    string,
    {
      playerName: string;
      discordUserId: string | null;
      dmAlertsEnabled: boolean;
    }
  >();

  if (profileIds.length === 0) {
    return profilesById;
  }

  for (const chunk of chunks(profileIds, DB_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, maimai_name, discord_user_id, dm_alerts_enabled")
      .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      profilesById.set(String(row.id), {
        playerName: row.maimai_name ?? "Unknown",
        discordUserId: row.discord_user_id,
        dmAlertsEnabled: Boolean(row.dm_alerts_enabled),
      });
    }
  }

  return profilesById;
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

function dedupeScores(scores: ParsedSongScore[]): ParsedSongScore[] {
  return [...new Map(scores.map((score) => [chartKey(score), score])).values()];
}

function songKey(title: string, kind: string): string {
  return `${kind}\u0000${title}`;
}

function chartKey(score: ParsedSongScore): string {
  return `${songKey(score.title, score.kind)}\u0000${score.difficulty}`;
}

function chartKeyFromParts(songId: string, difficulty: number): string {
  return `${songId}\u0000${difficulty}`;
}

function getRequiredMapValue(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Missing bulk ingest mapping for ${key}`);
  }

  return value;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [getKey(item), item])).values()];
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function reportProgress(
  reporter: IngestProgressReporter | undefined,
  progress: IngestProgress,
): Promise<void> {
  await reporter?.(progress);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown ingest error";
}
