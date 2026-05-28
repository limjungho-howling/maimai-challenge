import type { SupabaseClient, User } from "@supabase/supabase-js";

import { sendChannelLog } from "@/lib/discord/notifier";
import { requireCatalogJackets } from "@/lib/ingest/catalog";
import { mapWithConcurrency } from "@/lib/ingest/chunk-utils";
import {
  parseSongDetailHtml,
  parseSongDetailScoreHtml,
  parsePlayerDataHtml,
  parseSongScoreHtml,
  type ParsedSongScore,
} from "@/lib/maimai/parser";
import type { MaimaiCatalogPayload, MaimaiIngestPayload } from "@/lib/ingest/schema";
import { kstNowIsoString } from "@/lib/time";

const DB_CHUNK_SIZE = 500;
const DB_CHUNK_CONCURRENCY = 4;
const DB_FILTER_CHUNK_SIZE = 100;
const DB_SELECT_PAGE_SIZE = 1000;

interface IngestResult {
  ingestRunId: string;
  playerName: string;
  scoreCount: number;
  skippedChartCount: number;
  changedChartCount: number;
  rankDropCount: number;
}

interface LinkedDiscordProfile {
  discordUserId: string | null;
  discordUsername: string | null;
}

export interface IngestProgress {
  stage:
    | "parsing"
    | "songs"
    | "charts"
    | "catalog"
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
  const collectedAt = payload.collectedAt ?? kstNowIsoString();
  const discordProfile = getDiscordProfile(user);

  await upsertProfile(supabase, user.id, player, discordProfile);

  const run = await insertIngestRun(supabase, user.id, player.name);
  const detailScoresByKey = buildDetailScoresByKey(payload);
  const allScores = payload.scorePages.flatMap(({ difficulty, html }) =>
    parseSongScoreHtml(html, difficulty).map((score) => {
      const detailScore = score.officialIdx
        ? detailScoresByKey.get(detailScoreKey(score.officialIdx, difficulty))
        : null;

      return detailScore
        ? {
            ...score,
            achievementRate: detailScore.achievementRate ?? score.achievementRate,
            dxScore: detailScore.dxScore,
            maxDxScore: detailScore.maxDxScore,
          }
        : score;
    }),
  );
  const uniqueScores = dedupeScores(allScores);

  try {
    await reportProgress(onProgress, {
      stage: "catalog",
      message: "등록된 곡 카탈로그와 점수를 매칭하는 중입니다.",
      current: 10,
      total: 100,
    });
    const chartsByKey = await listCatalogCharts(supabase);
    const { scoreUpdates, skippedScores } = matchScoresToCatalogCharts(
      uniqueScores,
      chartsByKey,
    );
    const chartIds = scoreUpdates.map((update) => update.chartId);

    await reportProgress(onProgress, {
      stage: "scores",
      message: "기존 점수를 확인하는 중입니다.",
      current: 48,
      total: 100,
    });
    const previousScoresByChartId = await listPlayerScoresForCharts(
      supabase,
      user.id,
      chartIds,
    );
    const changedChartIds = detectChangedChartIds(
      scoreUpdates,
      previousScoresByChartId,
    );

    await reportProgress(onProgress, {
      stage: "scores",
      message: "플레이어 점수를 묶음으로 저장하는 중입니다.",
      current: 66,
      total: 100,
    });
    await upsertPlayerScores(supabase, user.id, scoreUpdates, collectedAt);

    await reportProgress(onProgress, {
      stage: "events",
      message: "변동 차트 정보를 갱신하는 중입니다.",
      current: 82,
      total: 100,
    });
    if (changedChartIds.length > 0) {
      await markChartsChanged(supabase, changedChartIds);
    }

    await updateIngestRun(supabase, run.id, {
      status: "completed",
      score_count: scoreUpdates.length,
      changed_chart_count: changedChartIds.length,
      completed_at: kstNowIsoString(),
    });

    await reportProgress(onProgress, {
      stage: "notifications",
      message: "Discord 알림을 처리하는 중입니다.",
      current: 92,
      total: 100,
    });
    await notifyChannel(
      supabase,
      run.id,
      player.name,
      scoreUpdates.length,
      changedChartIds.length,
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
      scoreCount: scoreUpdates.length,
      skippedChartCount: skippedScores.length,
      changedChartCount: changedChartIds.length,
      rankDropCount: 0,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    await updateIngestRun(supabase, run.id, {
      status: "failed",
      error_message: errorMessage,
      completed_at: kstNowIsoString(),
    });
    throw new Error(errorMessage);
  }
}

export function matchScoresToCatalogCharts(
  scores: ParsedSongScore[],
  chartsByKey: Map<string, string>,
): {
  scoreUpdates: Array<{ chartId: string; score: ParsedSongScore }>;
  skippedScores: ParsedSongScore[];
} {
  const scoreUpdates: Array<{ chartId: string; score: ParsedSongScore }> = [];
  const skippedScores: ParsedSongScore[] = [];

  for (const score of scores) {
    const chartId = chartsByKey.get(chartKey(score));
    if (chartId) {
      scoreUpdates.push({ chartId, score });
    } else {
      skippedScores.push(score);
    }
  }

  return { scoreUpdates, skippedScores };
}

function buildDetailScoresByKey(
  payload: MaimaiIngestPayload,
): Map<string, { achievementRate: number | null; dxScore: number; maxDxScore: number }> {
  const detailScoresByKey = new Map<
    string,
    { achievementRate: number | null; dxScore: number; maxDxScore: number }
  >();
  const difficulties = payload.scorePages.map((page) => page.difficulty);

  for (const detail of payload.detailPages ?? []) {
    for (const difficulty of difficulties) {
      const detailScore = parseSongDetailScoreHtml(detail.html, difficulty);
      if (detailScore) {
        detailScoresByKey.set(detailScoreKey(detail.idx, difficulty), detailScore);
      }
    }
  }

  return detailScoresByKey;
}

export async function ingestMaimaiCatalogPayload(
  supabase: SupabaseClient,
  payload: MaimaiCatalogPayload,
  onProgress?: IngestProgressReporter,
): Promise<{ songCount: number; chartCount: number }> {
  await reportProgress(onProgress, {
    stage: "parsing",
    message: "곡 카탈로그 HTML을 파싱하는 중입니다.",
    current: 0,
    total: 100,
  });

  const allScores = payload.scorePages.flatMap(({ difficulty, html }) =>
    parseSongScoreHtml(html, difficulty),
  );
  const jacketUrlsByIdx = new Map(
    payload.detailPages
      .map(({ idx, html, jacketUrl }) => {
        const parsed = parseSongDetailHtml(html, idx);
        return {
          ...parsed,
          jacketUrl: jacketUrl ?? parsed.jacketUrl,
        };
      })
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
  requireCatalogJackets(uniqueScores);

  await reportProgress(onProgress, {
    stage: "songs",
    message: "곡 정보를 묶음으로 저장하는 중입니다.",
    current: 35,
    total: 100,
  });
  const songsByKey = await upsertSongs(supabase, uniqueScores);

  await reportProgress(onProgress, {
    stage: "charts",
    message: "난이도별 차트 정보를 묶음으로 저장하는 중입니다.",
    current: 70,
    total: 100,
  });
  await upsertCharts(supabase, uniqueScores, songsByKey);

  await reportProgress(onProgress, {
    stage: "completed",
    message: "곡 카탈로그 저장이 완료되었습니다.",
    current: 100,
    total: 100,
  });

  return {
    songCount: songsByKey.size,
    chartCount: uniqueScores.length,
  };
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
      updated_at: kstNowIsoString(),
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
      created_at: kstNowIsoString(),
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
      updated_at: kstNowIsoString(),
    })),
    (song) => songKey(song.title, song.kind),
  );
  const idsByKey = new Map<string, string>();

  const chunkResults = await mapWithConcurrency(
    chunks(songs, DB_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("songs")
        .upsert(chunk, { onConflict: "title,kind" })
        .select("id,title,kind");

      if (error || !data) {
        throw error ?? new Error("Failed to upsert songs");
      }

      return data;
    },
  );

  for (const data of chunkResults) {
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
    updated_at: kstNowIsoString(),
  }));
  const idsByKey = new Map<string, string>();

  const chunkResults = await mapWithConcurrency(
    chunks(charts, DB_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("song_charts")
        .upsert(chunk, { onConflict: "song_id,difficulty" })
        .select("id,song_id,difficulty");

      if (error || !data) {
        throw error ?? new Error("Failed to upsert charts");
      }

      return data;
    },
  );

  for (const data of chunkResults) {
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

async function listCatalogCharts(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let from = 0; ; from += DB_SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chart_leaderboard_summary")
      .select("chart_id,title,kind,difficulty")
      .in("difficulty", [3, 4])
      .range(from, from + DB_SELECT_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));

    if ((data ?? []).length < DB_SELECT_PAGE_SIZE) {
      break;
    }
  }

  const idsByKey = new Map<string, string>();
  for (const row of rows) {
    idsByKey.set(
      `${songKey(String(row.title), String(row.kind))}\u0000${Number(row.difficulty)}`,
      String(row.chart_id),
    );
  }

  return idsByKey;
}

async function listPlayerScoresForCharts(
  supabase: SupabaseClient,
  profileId: string,
  chartIds: string[],
): Promise<Map<string, number>> {
  const scoresByChartId = new Map<string, number>();

  const chunkResults = await mapWithConcurrency(
    chunks([...new Set(chartIds)], DB_FILTER_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("player_scores")
        .select("chart_id, dx_score")
        .eq("profile_id", profileId)
        .in("chart_id", chunk);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  );

  for (const data of chunkResults) {
    for (const row of data) {
      scoresByChartId.set(String(row.chart_id), Number(row.dx_score));
    }
  }

  return scoresByChartId;
}

function detectChangedChartIds(
  updates: Array<{ chartId: string; score: ParsedSongScore }>,
  previousScoresByChartId: Map<string, number>,
): string[] {
  return [
    ...new Set(
      updates
        .filter(({ chartId, score }) => previousScoresByChartId.get(chartId) !== score.dxScore)
        .map(({ chartId }) => chartId),
    ),
  ];
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
    updated_at: kstNowIsoString(),
  }));

  await mapWithConcurrency(chunks(rows, DB_CHUNK_SIZE), DB_CHUNK_CONCURRENCY, async (chunk) => {
    const { error } = await supabase
      .from("player_scores")
      .upsert(chunk, { onConflict: "profile_id,chart_id" });

    if (error) {
      throw error;
    }
  });
}

async function markChartsChanged(
  supabase: SupabaseClient,
  chartIds: string[],
): Promise<void> {
  if (chartIds.length === 0) {
    return;
  }

  const changedAt = kstNowIsoString();
  await mapWithConcurrency(chunks(chartIds, DB_FILTER_CHUNK_SIZE), DB_CHUNK_CONCURRENCY, async (chunk) => {
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
  });
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
      created_at: kstNowIsoString(),
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

function detailScoreKey(officialIdx: string, difficulty: number): string {
  return `${officialIdx}\u0000${difficulty}`;
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
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((part): part is string => typeof part === "string" && part.length > 0);

    if (parts.length > 0) {
      return parts.join(" / ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown ingest error";
    }
  }

  return "Unknown ingest error";
}
