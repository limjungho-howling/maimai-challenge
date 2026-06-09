import type { SupabaseClient } from "@supabase/supabase-js";

import { mapWithConcurrency } from "@/lib/ingest/chunk-utils";
import {
  buildWeeklyEntryUpserts,
  getWeeklyChallengeLevelGroup,
  type ExistingWeeklyEntry,
  type WeeklyPickReference,
  type WeeklyScoreUpdate,
} from "@/lib/weekly/entries";
import {
  getCurrentWeeklyChallengeWindow,
  type WeeklyChallengeWindow,
} from "@/lib/weekly/time";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { kstNowIsoString } from "@/lib/time";

const SELECT_PAGE_SIZE = 1000;
const DB_CHUNK_SIZE = 500;
const DB_CHUNK_CONCURRENCY = 4;

export interface WeeklyChallengeOption {
  label: string;
  value: string;
}

export interface WeeklyChallengeData {
  selectedWeek: WeeklyChallengeWeek | null;
  weekOptions: WeeklyChallengeOption[];
}

export interface WeeklyChallengeWeek {
  endsAt: string;
  finalizedAt: string | null;
  id: string;
  key: string;
  label: string;
  picks: WeeklyChallengePick[];
  startsAt: string;
}

export interface WeeklyChallengePick {
  category: "low" | "middle";
  chart: WeeklyChallengeChart;
  id: string;
  rankings: WeeklyChallengeRanking[];
}

export interface WeeklyChallengeChart {
  chartId: string;
  difficulty: number;
  jacketUrl: string | null;
  kind: string;
  leaderCount: number;
  leaderDxScore: number | null;
  leaderName: string | null;
  level: string;
  maxDxScore: number;
  title: string;
  versionName: string | null;
}

export interface WeeklyChallengeRanking {
  achievementRate: number | null;
  discordUsername: string | null;
  dxScore: number;
  dxStarCount: number;
  maxDxScore: number;
  playerName: string;
  profileId: string;
  rank: number;
  submittedAt: string;
}

interface WeekRow {
  ends_at: string;
  finalized_at: string | null;
  id: string;
  label: string;
  starts_at: string;
  week_key: string;
}

interface PickRow {
  category: "low" | "middle";
  chart_id: string;
  id: string;
  leader_count_snapshot: number | null;
  leader_dx_score_snapshot: number | null;
  leader_name_snapshot: string | null;
  week_id: string;
}

interface ChartSummaryRow {
  chart_id: string;
  difficulty: number;
  jacket_url: string | null;
  kind: string;
  leader_count: number | null;
  leader_dx_score: number | null;
  leader_name: string | null;
  level: string;
  max_dx_score: number;
  title: string;
  version_name: string | null;
}

interface WeeklyEntryRow {
  achievement_rate: number | null;
  dx_score: number;
  dx_star_count: number | null;
  max_dx_score: number;
  pick_id: string;
  profile_id: string;
  profiles:
    | { discord_username: string | null; maimai_name: string | null }
    | { discord_username: string | null; maimai_name: string | null }[]
    | null;
  rank?: number;
  submitted_at: string;
}

export async function getWeeklyChallengeData(
  selectedWeekKey?: string,
): Promise<WeeklyChallengeData> {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { selectedWeek: null, weekOptions: [] };
  }

  const supabase = createSupabaseServiceClient();
  try {
    await ensureWeeklyChallengeState(supabase);

    const weeks = await listWeeks(supabase);
    const selected = weeks.find((week) => week.week_key === selectedWeekKey) ?? weeks[0] ?? null;

    return {
      selectedWeek: selected ? await buildWeeklyChallengeWeek(supabase, selected) : null,
      weekOptions: weeks.map((week) => ({ label: week.label, value: week.week_key })),
    };
  } catch (error) {
    if (isMissingWeeklyChallengeTable(error)) {
      console.error(error);
      return { selectedWeek: null, weekOptions: [] };
    }

    throw error;
  }
}

export async function recordWeeklyChallengeEntries(
  supabase: SupabaseClient,
  {
    ingestRunId,
    profileId,
    submittedAt,
    updates,
  }: {
    ingestRunId: string;
    profileId: string;
    submittedAt: string;
    updates: WeeklyScoreUpdate[];
  },
): Promise<void> {
  try {
    const activeWindow = getCurrentWeeklyChallengeWindow(new Date(submittedAt));
    if (!activeWindow || updates.length === 0) {
      return;
    }

    const week = await ensureWeek(supabase, activeWindow);
    const picks = await ensureWeekPicks(supabase, week.id);
    const picksByChartId = new Map<string, WeeklyPickReference>(
      picks.map((pick) => [
        pick.chart_id,
        {
          category: pick.category,
          pickId: pick.id,
          weekId: pick.week_id,
        },
      ]),
    );
    const matchedPickIds = [
      ...new Set(
        updates
          .map((update) => picksByChartId.get(update.chartId)?.pickId)
          .filter((pickId): pickId is string => Boolean(pickId)),
      ),
    ];

    if (matchedPickIds.length === 0) {
      return;
    }

    const existingEntriesByPickId = await listExistingEntriesForProfile(
      supabase,
      profileId,
      matchedPickIds,
    );
    const rows = buildWeeklyEntryUpserts({
      existingEntriesByPickId,
      ingestRunId,
      picksByChartId,
      profileId,
      submittedAt,
      updates,
    });

    if (rows.length === 0) {
      return;
    }

    const { error } = await supabase
      .from("weekly_challenge_entries")
      .upsert(
        rows.map((row) => ({
          ...row,
          updated_at: kstNowIsoString(),
        })),
        { onConflict: "week_id,pick_id,profile_id" },
      );

    if (error) {
      throw error;
    }
  } catch (error) {
    if (isMissingWeeklyChallengeTable(error)) {
      console.error(error);
      return;
    }

    throw error;
  }
}

export async function ensureWeeklyChallengeState(
  supabase = createSupabaseServiceClient(),
  now = new Date(),
): Promise<void> {
  await finalizeEndedWeeks(supabase, now);

  const currentWindow = getCurrentWeeklyChallengeWindow(now);
  if (!currentWindow) {
    return;
  }

  const week = await ensureWeek(supabase, currentWindow);
  await ensureWeekPicks(supabase, week.id);
}

async function listWeeks(supabase: SupabaseClient): Promise<WeekRow[]> {
  return fetchAllPagedRows<WeekRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("weekly_challenge_weeks")
      .select("id,week_key,label,starts_at,ends_at,finalized_at")
      .order("starts_at", { ascending: false })
      .range(from, to);

    return { data: (data ?? []) as WeekRow[], error };
  });
}

async function buildWeeklyChallengeWeek(
  supabase: SupabaseClient,
  week: WeekRow,
): Promise<WeeklyChallengeWeek> {
  const picks = await listPicks(supabase, week.id);
  const chartIds = picks.map((pick) => pick.chart_id);
  const chartsById = await listChartSummariesById(supabase, chartIds);
  const rowsByPickId = week.finalized_at
    ? await listFinalResultsByPickId(supabase, week.id)
    : await listCurrentEntriesByPickId(supabase, week.id);

  return {
    endsAt: week.ends_at,
    finalizedAt: week.finalized_at,
    id: week.id,
    key: week.week_key,
    label: week.label,
    picks: picks
      .sort((left, right) => categoryOrder(left.category) - categoryOrder(right.category))
      .map((pick) => {
        const chart = chartsById.get(pick.chart_id);
        const rankings = rowsByPickId.get(pick.id) ?? [];

        return {
          category: pick.category,
          chart: {
            chartId: chart?.chart_id ?? pick.chart_id,
            difficulty: Number(chart?.difficulty ?? 3),
            jacketUrl: chart?.jacket_url ?? null,
            kind: chart?.kind ?? "DX",
            leaderCount: week.finalized_at
              ? Number(pick.leader_count_snapshot ?? 0)
              : Number(chart?.leader_count ?? 0),
            leaderDxScore: week.finalized_at
              ? pick.leader_dx_score_snapshot
              : chart?.leader_dx_score ?? null,
            leaderName: week.finalized_at
              ? pick.leader_name_snapshot
              : chart?.leader_name ?? null,
            level: chart?.level ?? "-",
            maxDxScore: Number(chart?.max_dx_score ?? 0),
            title: chart?.title ?? "알 수 없는 곡",
            versionName: chart?.version_name ?? null,
          },
          id: pick.id,
          rankings,
        };
      }),
    startsAt: week.starts_at,
  };
}

async function ensureWeek(
  supabase: SupabaseClient,
  window: WeeklyChallengeWindow,
): Promise<WeekRow> {
  const { data, error } = await supabase
    .from("weekly_challenge_weeks")
    .upsert(
      {
        ends_at: window.endsAt,
        label: window.label,
        starts_at: window.startsAt,
        week_key: window.key,
      },
      { onConflict: "week_key" },
    )
    .select("id,week_key,label,starts_at,ends_at,finalized_at")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to ensure weekly challenge week");
  }

  return data as WeekRow;
}

async function ensureWeekPicks(
  supabase: SupabaseClient,
  weekId: string,
): Promise<PickRow[]> {
  const existing = await listPicks(supabase, weekId);
  const existingCategories = new Set(existing.map((pick) => pick.category));
  const missingCategories = (["low", "middle"] as const).filter(
    (category) => !existingCategories.has(category),
  );

  for (const category of missingCategories) {
    const chart = await pickRandomChartForCategory(supabase, category);
    if (!chart) {
      continue;
    }

    const { error } = await supabase
      .from("weekly_challenge_picks")
      .insert({
        category,
        chart_id: chart.chart_id,
        week_id: weekId,
      });

    if (error && !isUniqueViolation(error)) {
      throw error;
    }
  }

  return listPicks(supabase, weekId);
}

async function listPicks(
  supabase: SupabaseClient,
  weekId: string,
): Promise<PickRow[]> {
  const { data, error } = await supabase
    .from("weekly_challenge_picks")
    .select(
      "id,week_id,category,chart_id,leader_dx_score_snapshot,leader_name_snapshot,leader_count_snapshot",
    )
    .eq("week_id", weekId);

  if (error) {
    throw error;
  }

  return (data ?? []) as PickRow[];
}

async function pickRandomChartForCategory(
  supabase: SupabaseClient,
  category: "low" | "middle",
): Promise<ChartSummaryRow | null> {
  const candidates = (await fetchAllChartSummaries(supabase)).filter(
    (chart) => getWeeklyChallengeLevelGroup(chart.level) === category,
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

async function fetchAllChartSummaries(
  supabase: SupabaseClient,
): Promise<ChartSummaryRow[]> {
  return fetchAllPagedRows<ChartSummaryRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("chart_leaderboard_summary")
      .select(
        "chart_id,title,jacket_url,kind,version_name,difficulty,level,max_dx_score,leader_dx_score,leader_name,leader_count",
      )
      .in("difficulty", [3, 4])
      .range(from, to);

    return { data: (data ?? []) as ChartSummaryRow[], error };
  });
}

async function listChartSummariesById(
  supabase: SupabaseClient,
  chartIds: string[],
): Promise<Map<string, ChartSummaryRow>> {
  const rows = await mapWithConcurrency(
    chunks([...new Set(chartIds)], 100),
    DB_CHUNK_CONCURRENCY,
    async (chunk) => {
      const { data, error } = await supabase
        .from("chart_leaderboard_summary")
        .select(
          "chart_id,title,jacket_url,kind,version_name,difficulty,level,max_dx_score,leader_dx_score,leader_name,leader_count",
        )
        .in("chart_id", chunk);

      if (error) {
        throw error;
      }

      return (data ?? []) as ChartSummaryRow[];
    },
  );

  return new Map(rows.flat().map((row) => [row.chart_id, row]));
}

async function listExistingEntriesForProfile(
  supabase: SupabaseClient,
  profileId: string,
  pickIds: string[],
): Promise<Map<string, ExistingWeeklyEntry>> {
  const { data, error } = await supabase
    .from("weekly_challenge_entries")
    .select("pick_id,achievement_rate,dx_score,max_dx_score,submitted_at")
    .eq("profile_id", profileId)
    .in("pick_id", pickIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => [
      String(row.pick_id),
      {
        achievementRate:
          row.achievement_rate === null ? null : Number(row.achievement_rate),
        dxScore: Number(row.dx_score),
        maxDxScore: Number(row.max_dx_score),
        submittedAt: String(row.submitted_at),
      },
    ]),
  );
}

async function listCurrentEntriesByPickId(
  supabase: SupabaseClient,
  weekId: string,
): Promise<Map<string, WeeklyChallengeRanking[]>> {
  const rows = await fetchAllPagedRows<WeeklyEntryRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("weekly_challenge_entries")
      .select(
        "pick_id,profile_id,achievement_rate,dx_score,max_dx_score,dx_star_count,submitted_at,profiles(maimai_name,discord_username)",
      )
      .eq("week_id", weekId)
      .order("dx_score", { ascending: false })
      .order("submitted_at", { ascending: true })
      .range(from, to);

    return { data: (data ?? []) as WeeklyEntryRow[], error };
  });

  return groupRankingsByPickId(rows);
}

async function listFinalResultsByPickId(
  supabase: SupabaseClient,
  weekId: string,
): Promise<Map<string, WeeklyChallengeRanking[]>> {
  const rows = await fetchAllPagedRows<WeeklyEntryRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("weekly_challenge_results")
      .select(
        "pick_id,profile_id,achievement_rate,dx_score,max_dx_score,dx_star_count,rank,submitted_at,profiles(maimai_name,discord_username)",
      )
      .eq("week_id", weekId)
      .order("rank", { ascending: true })
      .order("dx_score", { ascending: false })
      .range(from, to);

    return { data: (data ?? []) as WeeklyEntryRow[], error };
  });

  const grouped = new Map<string, WeeklyChallengeRanking[]>();
  for (const row of rows) {
    const entries = grouped.get(row.pick_id) ?? [];
    entries.push(mapWeeklyRanking(row, Number(row.rank ?? entries.length + 1)));
    grouped.set(row.pick_id, entries);
  }

  return grouped;
}

function groupRankingsByPickId(
  rows: WeeklyEntryRow[],
): Map<string, WeeklyChallengeRanking[]> {
  const grouped = new Map<string, WeeklyEntryRow[]>();
  for (const row of rows) {
    const entries = grouped.get(row.pick_id) ?? [];
    entries.push(row);
    grouped.set(row.pick_id, entries);
  }

  const ranked = new Map<string, WeeklyChallengeRanking[]>();
  for (const [pickId, entries] of grouped) {
    let previousScore: number | null = null;
    let currentRank = 0;
    const rankings = entries
      .sort((left, right) => {
        if (right.dx_score !== left.dx_score) {
          return right.dx_score - left.dx_score;
        }
        return left.submitted_at.localeCompare(right.submitted_at);
      })
      .map((entry, index) => {
        if (previousScore === null || entry.dx_score !== previousScore) {
          currentRank = index + 1;
          previousScore = entry.dx_score;
        }

        return mapWeeklyRanking(entry, currentRank);
      });

    ranked.set(pickId, rankings);
  }

  return ranked;
}

function mapWeeklyRanking(row: WeeklyEntryRow, rank: number): WeeklyChallengeRanking {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    achievementRate:
      row.achievement_rate === null ? null : Number(row.achievement_rate),
    discordUsername: profile?.discord_username ?? null,
    dxScore: Number(row.dx_score),
    dxStarCount: Number(row.dx_star_count ?? 0),
    maxDxScore: Number(row.max_dx_score),
    playerName:
      profile?.maimai_name ?? profile?.discord_username ?? "미등록",
    profileId: String(row.profile_id),
    rank,
    submittedAt: String(row.submitted_at),
  };
}

async function finalizeEndedWeeks(
  supabase: SupabaseClient,
  now: Date,
): Promise<void> {
  const nowIso = kstNowIsoString(now);
  const { data, error } = await supabase
    .from("weekly_challenge_weeks")
    .select("id,week_key,label,starts_at,ends_at,finalized_at")
    .is("finalized_at", null)
    .lte("ends_at", nowIso);

  if (error) {
    throw error;
  }

  for (const week of (data ?? []) as WeekRow[]) {
    await finalizeWeek(supabase, week);
  }
}

async function finalizeWeek(supabase: SupabaseClient, week: WeekRow): Promise<void> {
  const picks = await listPicks(supabase, week.id);
  const chartsById = await listChartSummariesById(
    supabase,
    picks.map((pick) => pick.chart_id),
  );
  const entriesByPickId = await listCurrentEntriesByPickId(supabase, week.id);
  const resultRows = [];

  for (const pick of picks) {
    const chart = chartsById.get(pick.chart_id);
    await supabase
      .from("weekly_challenge_picks")
      .update({
        leader_count_snapshot: Number(chart?.leader_count ?? 0),
        leader_dx_score_snapshot: chart?.leader_dx_score ?? null,
        leader_name_snapshot: chart?.leader_name ?? null,
      })
      .eq("id", pick.id);

    for (const ranking of entriesByPickId.get(pick.id) ?? []) {
      resultRows.push({
        achievement_rate: ranking.achievementRate,
        dx_score: ranking.dxScore,
        max_dx_score: ranking.maxDxScore,
        pick_id: pick.id,
        profile_id: ranking.profileId,
        rank: ranking.rank,
        submitted_at: ranking.submittedAt,
        week_id: week.id,
      });
    }
  }

  await mapWithConcurrency(chunks(resultRows, DB_CHUNK_SIZE), DB_CHUNK_CONCURRENCY, async (chunk) => {
    if (chunk.length === 0) {
      return;
    }

    const { error } = await supabase
      .from("weekly_challenge_results")
      .upsert(chunk, { onConflict: "week_id,pick_id,profile_id" });

    if (error) {
      throw error;
    }
  });

  const { error } = await supabase
    .from("weekly_challenge_weeks")
    .update({ finalized_at: kstNowIsoString() })
    .eq("id", week.id);

  if (error) {
    throw error;
  }
}

function categoryOrder(category: "low" | "middle"): number {
  return category === "low" ? 0 : 1;
}

async function fetchAllPagedRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[]; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + SELECT_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    rows.push(...data);

    if (data.length < SELECT_PAGE_SIZE) {
      return rows;
    }
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function isMissingWeeklyChallengeTable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? (error as { code?: string }).code : null;
  const message =
    "message" in error ? String((error as { message?: unknown }).message) : "";

  return (
    code === "42P01" ||
    message.includes("weekly_challenge_") ||
    message.includes("Could not find the table")
  );
}
