import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  ensurePersonalChannel,
  sendChannelLog,
  sendChannelRankUpLogs,
  sendPersonalRankDropNotifications,
  type DiscordNotificationResult,
  type PersonalChannelNotification,
} from "@/lib/discord/notifier";
import { summarizeMissingCatalogJackets } from "@/lib/ingest/catalog";
import { detectBulkRankingEvents } from "@/lib/ingest/bulk-ranking";
import { mapWithConcurrency } from "@/lib/ingest/chunk-utils";
import type { SongKind } from "@/lib/maimai/constants";
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

interface CatalogChart {
  chartId: string;
  title: string;
  difficultyLabel: string;
}

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
  if (!player.name) {
    throw new Error(
      "플레이어 이름을 가져오지 못했습니다. 공식 홈페이지의 playerData 페이지가 정상적으로 로드되는지 확인한 뒤 다시 갱신해주세요.",
    );
  }

  const collectedAt = payload.collectedAt ?? kstNowIsoString();
  const discordProfile = getDiscordProfile(user);

  await upsertProfile(supabase, user.id, player, discordProfile);

  const run = await insertIngestRun(supabase, user.id, player.name);
  const personalChannelResult = await ensureProfilePersonalChannel(
    supabase,
    user.id,
    player.name,
    discordProfile,
  );
  if (personalChannelResult) {
    await persistPersonalChannelIds(supabase, [personalChannelResult]);
    await insertNotificationResults(supabase, run.id, [personalChannelResult]);
  }
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
    const isInitialScoreIngest = previousScoresByChartId.size === 0;
    const changedChartIds = detectChangedChartIds(
      scoreUpdates,
      previousScoresByChartId,
    );
    const rankingScoresByChartId = await listScoresForCharts(supabase, chartIds);
    const rankingResult = detectBulkRankingEvents({
      actorUserId: user.id,
      updates: scoreUpdates.map(({ chartId, score, chart }) => ({
        chartId,
        title: chart.title,
        difficultyLabel: chart.difficultyLabel,
        dxScore: score.dxScore,
        maxDxScore: score.maxDxScore,
      })),
      beforeScoresByChartId: rankingScoresByChartId,
    });

    await reportProgress(onProgress, {
      stage: "scores",
      message: "플레이어 점수를 묶음으로 저장하는 중입니다.",
      current: 66,
      total: 100,
    });
    await upsertPlayerScores(supabase, user.id, scoreUpdates, collectedAt);

    await reportProgress(onProgress, {
      stage: "scores",
      message: "차트 최대 DX 점수를 보정하는 중입니다.",
      current: 74,
      total: 100,
    });
    await fillMissingChartMaxDxScores(
      supabase,
      scoreUpdates.map((update) => update.chartId),
    );

    await reportProgress(onProgress, {
      stage: "events",
      message: "변동 차트 정보를 갱신하는 중입니다.",
      current: 82,
      total: 100,
    });
    const actualChangedChartIds = [
      ...new Set([...changedChartIds, ...rankingResult.changedChartIds]),
    ];

    if (actualChangedChartIds.length > 0) {
      await markChartsChanged(supabase, actualChangedChartIds);
    }

    if (rankingResult.events.length > 0) {
      await insertRankingEvents(supabase, run.id, user.id, rankingResult.events);
    }

    await updateIngestRun(supabase, run.id, {
      status: "completed",
      score_count: scoreUpdates.length,
      changed_chart_count: actualChangedChartIds.length,
      completed_at: kstNowIsoString(),
    });

    if (isInitialScoreIngest) {
      await reportProgress(onProgress, {
        stage: "notifications",
        message: "최초 갱신이므로 Discord 알림을 건너뜁니다.",
        current: 92,
        total: 100,
      });
    } else {
      await reportProgress(onProgress, {
        stage: "notifications",
        message: "Discord 알림을 처리하는 중입니다.",
        current: 92,
        total: 100,
      });
      await notifyChannel(
        supabase,
        run.id,
        user.id,
        player.name,
        scoreUpdates.length,
        actualChangedChartIds.length,
        rankingResult.rankUpEvents,
        rankingResult.rankDropEvents,
      );
    }

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
      changedChartCount: actualChangedChartIds.length,
      rankDropCount: rankingResult.rankDropEvents.length,
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
  chartsByKey: Map<string, CatalogChart>,
): {
  scoreUpdates: Array<{ chartId: string; chart: CatalogChart; score: ParsedSongScore }>;
  skippedScores: ParsedSongScore[];
} {
  const scoreUpdates: Array<{ chartId: string; chart: CatalogChart; score: ParsedSongScore }> = [];
  const skippedScores: ParsedSongScore[] = [];

  for (const score of scores) {
    const chart = chartsByKey.get(chartKey(score));
    if (chart) {
      scoreUpdates.push({ chartId: chart.chartId, chart, score });
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

  const allScores = payload.scorePages.flatMap(({ difficulty, html, version, versionName }) =>
    parseSongScoreHtml(html, difficulty, {
      includeNoRecord: true,
      versionNumber: version ?? null,
      versionName: versionName ?? null,
    }),
  );
  const detailScoresByKey = new Map(
    payload.detailPages.flatMap((detail) =>
      payload.scorePages.flatMap((page) => {
        const score = parseSongDetailScoreHtml(detail.html, page.difficulty);
        return score
          ? [[detailScoreKey(detail.idx, page.difficulty), score] as const]
          : [];
      }),
    ),
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
      maxDxScore:
        score.maxDxScore > 0
          ? score.maxDxScore
          : score.officialIdx
            ? detailScoresByKey.get(detailScoreKey(score.officialIdx, score.difficulty))
                ?.maxDxScore ?? score.maxDxScore
            : score.maxDxScore,
      jacketUrl:
        score.jacketUrl ??
        (score.officialIdx ? jacketUrlsByIdx.get(score.officialIdx) ?? null : null),
    })),
  );
  const missingJacketSummary = summarizeMissingCatalogJackets(uniqueScores);
  if (missingJacketSummary) {
    console.warn(missingJacketSummary);
  }

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

async function ensureProfilePersonalChannel(
  supabase: SupabaseClient,
  profileId: string,
  playerName: string,
  discordProfile: LinkedDiscordProfile,
): Promise<DiscordNotificationResult | null> {
  if (!discordProfile.discordUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("discord_personal_channel_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return ensurePersonalChannel({
    profileId,
    discordUserId: discordProfile.discordUserId,
    discordUsername: discordProfile.discordUsername,
    personalChannelId:
      typeof data?.discord_personal_channel_id === "string"
        ? data.discord_personal_channel_id
        : null,
    playerName,
  });
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
      version_number: score.versionNumber,
      version_name: score.versionName,
      updated_at: kstNowIsoString(),
    })),
    (song) => songKey(song.title, song.kind),
  );
  const songsWithJackets = songs.filter((song) => song.jacket_url);
  const songsWithoutJackets = songs
    .filter((song) => !song.jacket_url)
    .map(({ jacket_url: _jacketUrl, ...song }) => song);
  const idsByKey = new Map<string, string>();

  const upsertSongChunks = async <T extends { title: string; kind: SongKind }>(
    rows: T[],
  ) =>
    mapWithConcurrency(
      chunks(rows, DB_CHUNK_SIZE),
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

  const chunkResults = [
    ...(await upsertSongChunks(songsWithJackets)),
    ...(await upsertSongChunks(songsWithoutJackets)),
  ];

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
  const chartRows = scores.map((score) => ({
    song_id: getRequiredMapValue(songsByKey, songKey(score.title, score.kind)),
    difficulty: score.difficulty,
    difficulty_label: score.difficultyLabel,
    level: score.level,
    genre: score.genre,
    max_dx_score: score.maxDxScore,
    updated_at: kstNowIsoString(),
  }));
  const chartsWithKnownMax = chartRows.filter((chart) => chart.max_dx_score > 0);
  const chartsWithPendingMax = chartRows.filter((chart) => chart.max_dx_score <= 0);
  const existingPendingCharts = await findExistingChartIds(
    supabase,
    chartsWithPendingMax.map((chart) => ({
      songId: chart.song_id,
      difficulty: chart.difficulty,
    })),
  );
  const pendingChartInserts = chartsWithPendingMax.filter(
    (chart) =>
      !existingPendingCharts.has(chartKeyFromParts(chart.song_id, chart.difficulty)),
  );
  const pendingChartUpdates = chartsWithPendingMax.filter((chart) =>
    existingPendingCharts.has(chartKeyFromParts(chart.song_id, chart.difficulty)),
  );
  const idsByKey = new Map<string, string>();

  const chunkResults = await mapWithConcurrency(
    chunks([...chartsWithKnownMax, ...pendingChartInserts], DB_CHUNK_SIZE),
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

  const updateResults = await mapWithConcurrency(
    chunks(pendingChartUpdates, DB_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const rows = [];
      for (const chart of chunk) {
        const { data, error } = await supabase
          .from("song_charts")
          .update({
            difficulty_label: chart.difficulty_label,
            level: chart.level,
            genre: chart.genre,
            updated_at: chart.updated_at,
          })
          .eq("song_id", chart.song_id)
          .eq("difficulty", chart.difficulty)
          .select("id,song_id,difficulty")
          .single();

        if (error || !data) {
          throw error ?? new Error("Failed to update pending-max chart");
        }

        rows.push(data);
      }
      return rows;
    },
  );

  for (const data of updateResults) {
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

async function findExistingChartIds(
  supabase: SupabaseClient,
  charts: Array<{ songId: string; difficulty: number }>,
): Promise<Set<string>> {
  if (charts.length === 0) {
    return new Set();
  }

  const keys = new Set(
    charts.map((chart) => chartKeyFromParts(chart.songId, chart.difficulty)),
  );
  const songIds = [...new Set(charts.map((chart) => chart.songId))];
  const results = await mapWithConcurrency(
    chunks(songIds, DB_FILTER_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("song_charts")
        .select("song_id,difficulty")
        .in("song_id", chunk);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  );

  return new Set(
    results
      .flat()
      .map((row) => chartKeyFromParts(String(row.song_id), Number(row.difficulty)))
      .filter((key) => keys.has(key)),
  );
}

async function listCatalogCharts(
  supabase: SupabaseClient,
): Promise<Map<string, CatalogChart>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let from = 0; ; from += DB_SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chart_leaderboard_summary")
      .select("chart_id,title,kind,difficulty,difficulty_label")
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

  const idsByKey = new Map<string, CatalogChart>();
  for (const row of rows) {
    idsByKey.set(
      `${songKey(String(row.title), String(row.kind))}\u0000${Number(row.difficulty)}`,
      {
        chartId: String(row.chart_id),
        title: String(row.title),
        difficultyLabel: String(row.difficulty_label),
      },
    );
  }

  return idsByKey;
}

async function listScoresForCharts(
  supabase: SupabaseClient,
  chartIds: string[],
): Promise<Map<string, Array<{ userId: string; dxScore: number }>>> {
  const scoresByChartId = new Map<string, Array<{ userId: string; dxScore: number }>>();

  const chunkResults = await mapWithConcurrency(
    chunks([...new Set(chartIds)], DB_FILTER_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("player_scores")
        .select("chart_id, profile_id, dx_score")
        .in("chart_id", chunk);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  );

  for (const data of chunkResults) {
    for (const row of data) {
      const chartId = String(row.chart_id);
      const entries = scoresByChartId.get(chartId) ?? [];
      entries.push({
        userId: String(row.profile_id),
        dxScore: Number(row.dx_score),
      });
      scoresByChartId.set(chartId, entries);
    }
  }

  return scoresByChartId;
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

async function fillMissingChartMaxDxScores(
  supabase: SupabaseClient,
  chartIds: string[],
): Promise<void> {
  const uniqueChartIds = [...new Set(chartIds)];
  if (uniqueChartIds.length === 0) {
    return;
  }

  const missingChartIds = await listChartsMissingMaxDxScore(supabase, uniqueChartIds);
  if (missingChartIds.length === 0) {
    return;
  }

  const scoreRows = await mapWithConcurrency(
    chunks(missingChartIds, DB_FILTER_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("player_scores")
        .select("chart_id, max_dx_score")
        .in("chart_id", chunk)
        .gt("max_dx_score", 0);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  );
  const maxByChartId = new Map<string, number>();

  for (const row of scoreRows.flat()) {
    const chartId = String(row.chart_id);
    const maxDxScore = Number(row.max_dx_score);
    const previousMaxDxScore = maxByChartId.get(chartId) ?? 0;
    if (maxDxScore > previousMaxDxScore) {
      maxByChartId.set(chartId, maxDxScore);
    }
  }

  const candidates = [...maxByChartId.entries()].map(([chartId, maxDxScore]) => ({
    chartId,
    maxDxScore,
  }));

  await mapWithConcurrency(
    chunks(candidates, DB_FILTER_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      for (const item of chunk) {
        const { error } = await supabase
          .from("song_charts")
          .update({
            max_dx_score: item.maxDxScore,
            updated_at: kstNowIsoString(),
          })
          .eq("id", item.chartId)
          .lte("max_dx_score", 0);

        if (error) {
          throw error;
        }
      }
    },
  );
}

async function listChartsMissingMaxDxScore(
  supabase: SupabaseClient,
  chartIds: string[],
): Promise<string[]> {
  const results = await mapWithConcurrency(
    chunks(chartIds, DB_FILTER_CHUNK_SIZE),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("song_charts")
        .select("id")
        .in("id", chunk)
        .lte("max_dx_score", 0);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  );

  return results.flat().map((row) => String(row.id));
}

async function insertRankingEvents(
  supabase: SupabaseClient,
  ingestRunId: string,
  actorProfileId: string,
  events: Array<{
    chartId: string;
    userId: string;
    type: string;
    previousDxScore: number | null;
    nextDxScore: number;
    previousRank: number | null;
    nextRank: number;
  }>,
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
    created_at: kstNowIsoString(),
  }));

  await mapWithConcurrency(chunks(rows, DB_CHUNK_SIZE), DB_CHUNK_CONCURRENCY, async (chunk) => {
    const { error } = await supabase.from("ranking_events").insert(chunk);

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
  actorProfileId: string,
  playerName: string,
  scoreCount: number,
  changedChartCount: number,
  rankUpEvents: Array<{
    chartId: string;
    userId: string;
    chartTitle: string;
    difficultyLabel: string;
    previousDxScore: number | null;
    nextDxScore: number;
    previousRank: number | null;
    nextRank: number;
    actorDxScore: number;
    actorMaxDxScore: number;
  }>,
  rankDropEvents: Array<{
    chartId: string;
    userId: string;
    chartTitle: string;
    difficultyLabel: string;
    previousDxScore: number | null;
    nextDxScore: number;
    previousRank: number | null;
    nextRank: number;
    actorDxScore: number;
    actorMaxDxScore: number;
  }>,
): Promise<void> {
  const channelResults =
    rankUpEvents.length > 0
      ? await sendChannelRankUpLogs({
          actorName: playerName,
          events: rankUpEvents.map((event) => ({
            chartId: event.chartId,
            chartTitle: event.chartTitle,
            difficultyLabel: event.difficultyLabel,
            previousRank: event.previousRank,
            nextRank: event.nextRank,
            actorDxScore: event.actorDxScore,
            actorMaxDxScore: event.actorMaxDxScore,
          })),
        })
      : [
          await sendChannelLog(
            `${playerName}님이 ${scoreCount}개 점수를 갱신했습니다. 변동 차트: ${changedChartCount}개`,
          ),
        ];
  const personalResults =
    rankDropEvents.length > 0
      ? await sendPersonalRankDropNotifications(
          await buildPersonalChannelNotifications(
            supabase,
            actorProfileId,
            playerName,
            rankDropEvents,
          ),
        )
      : [];
  await persistPersonalChannelIds(supabase, personalResults);
  await insertNotificationResults(supabase, ingestRunId, [
    ...channelResults,
    ...personalResults,
  ]);
}

async function buildPersonalChannelNotifications(
  supabase: SupabaseClient,
  actorProfileId: string,
  actorName: string,
  rankDropEvents: Array<{
    chartId: string;
    userId: string;
    chartTitle: string;
    difficultyLabel: string;
    previousDxScore: number | null;
    nextDxScore: number;
    previousRank: number | null;
    nextRank: number;
    actorDxScore: number;
    actorMaxDxScore: number;
  }>,
): Promise<PersonalChannelNotification[]> {
  const profileIds = [...new Set(rankDropEvents.map((event) => event.userId))];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, discord_user_id, discord_username, discord_personal_channel_id, maimai_name")
    .in("id", profileIds);

  if (error) {
    throw error;
  }

  const profilesById = new Map((data ?? []).map((profile) => [String(profile.id), profile]));
  const titleByTargetProfileId = await fetchRankDropMessageTitles(
    supabase,
    actorProfileId,
    profileIds,
  );

  return profileIds.map((profileId) => {
    const profile = profilesById.get(profileId);
    return {
      profileId,
      discordUserId:
        typeof profile?.discord_user_id === "string" ? profile.discord_user_id : null,
      discordUsername:
        typeof profile?.discord_username === "string" ? profile.discord_username : null,
      personalChannelId:
        typeof profile?.discord_personal_channel_id === "string"
          ? profile.discord_personal_channel_id
          : null,
      playerName:
        typeof profile?.maimai_name === "string" ? profile.maimai_name : "Unknown",
      actorName,
      rankDropTitle: titleByTargetProfileId.get(profileId) ?? null,
      events: rankDropEvents
        .filter((event) => event.userId === profileId)
        .map((event) => ({
          chartId: event.chartId,
          chartTitle: event.chartTitle,
          difficultyLabel: event.difficultyLabel,
          previousDxScore: event.previousDxScore,
          nextDxScore: event.nextDxScore,
          previousRank: event.previousRank,
          nextRank: event.nextRank,
          actorDxScore: event.actorDxScore,
          actorMaxDxScore: event.actorMaxDxScore,
        })),
    };
  });
}

async function fetchRankDropMessageTitles(
  supabase: SupabaseClient,
  actorProfileId: string,
  targetProfileIds: string[],
): Promise<Map<string, string>> {
  if (targetProfileIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("rank_drop_message_titles")
    .select("target_profile_id, title")
    .eq("actor_profile_id", actorProfileId)
    .in("target_profile_id", targetProfileIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => [String(row.target_profile_id), String(row.title)]),
  );
}

async function persistPersonalChannelIds(
  supabase: SupabaseClient,
  results: Array<{
    type: string;
    profileId: string | null;
    status: string;
    channelId?: string | null;
  }>,
): Promise<void> {
  for (const result of results) {
    if (
      result.type !== "personal_channel" ||
      result.status !== "sent" ||
      !result.profileId ||
      !result.channelId
    ) {
      continue;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        discord_personal_channel_id: result.channelId,
        updated_at: kstNowIsoString(),
      })
      .eq("id", result.profileId);

    if (error) {
      throw error;
    }
  }
}

async function insertNotificationResults(
  supabase: SupabaseClient,
  ingestRunId: string,
    results: Array<{
    type: "dm" | "channel" | "personal_channel";
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
