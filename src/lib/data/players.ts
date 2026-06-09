import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const SELECT_PAGE_SIZE = 1000;

export interface PlayerLeaderboardEntry {
  profileId: string;
  rank: number;
  influenceRank: number;
  fiveStarRank: number;
  monthlyChallengeRank: number;
  monthlyChallengePointRank: number;
  playerName: string;
  discordUsername: string | null;
  maimaiRating: number | null;
  firstPlaceCount: number;
  fiveStarCount: number;
  fiveStarPercent: number;
  influenceScore: number;
  influencePercent: number;
  monthlyChallengeCount: number;
  monthlyChallengePercent: number;
  monthlyChallengePointPercent: number;
  monthlyChallengePoints: number;
  scoreCount: number;
  latestUpdatedAt: string | null;
}

interface ProfileRow {
  id: string;
  discord_username: string | null;
  maimai_name: string | null;
  maimai_rating: number | null;
  updated_at: string | null;
}

interface RankingRow {
  dx_star_count: number | null;
  profile_id: string;
  rank: number;
  updated_at: string | null;
}

export interface MonthlyChallengeCountRow {
  profile_id: string;
  count: number;
}

export interface MonthlyChallengePointRow {
  profile_id: string;
  points: number;
}

interface DiscordNotificationRow {
  ingest_runs: { profile_id: string | null } | { profile_id: string | null }[] | null;
}

interface RankingEventRow {
  actor_profile_id: string | null;
  next_rank: number;
  previous_rank: number | null;
  profile_id: string;
}

const FIRST_CHALLENGE_MONTH = "2026-06";

export async function listPlayerLeaderboard(
  monthKey = getCurrentKstMonthKey(),
): Promise<PlayerLeaderboardEntry[]> {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const [
    profiles,
    rankings,
    monthlyChallengeCounts,
    monthlyChallengePoints,
    totalChartCount,
  ] = await Promise.all([
    fetchAllProfiles(supabase),
    fetchAllRankings(supabase),
    fetchMonthlyChallengeCounts(supabase, monthKey),
    fetchMonthlyChallengePoints(supabase, monthKey),
    fetchTotalChartCount(supabase),
  ]);
  const monthlyChallengeEntries = buildMonthlyChallengeLeaderboard(
    profiles,
    monthlyChallengeCounts,
  );
  const monthlyChallengePointEntries = buildMonthlyChallengePointLeaderboard(
    profiles,
    monthlyChallengePoints,
  );
  const monthlyChallengeByProfileId = new Map(
    monthlyChallengeEntries.map((entry) => [entry.profileId, entry]),
  );
  const monthlyChallengePointsByProfileId = new Map(
    monthlyChallengePointEntries.map((entry) => [entry.profileId, entry]),
  );
  const statsByProfileId = new Map<
    string,
    {
      firstPlaceCount: number;
      fiveStarCount: number;
      influenceScore: number;
      influenceBasisPoints: number;
      scoreCount: number;
      latestUpdatedAt: string | null;
    }
  >();

  for (const ranking of rankings) {
    const stats = statsByProfileId.get(ranking.profile_id) ?? {
      firstPlaceCount: 0,
      fiveStarCount: 0,
      influenceScore: 0,
      influenceBasisPoints: 0,
      scoreCount: 0,
      latestUpdatedAt: null,
    };

    stats.scoreCount += 1;
    const rank = Number(ranking.rank);
    if (rank === 1) {
      stats.firstPlaceCount += 1;
    }
    if (Number(ranking.dx_star_count) === 5) {
      stats.fiveStarCount += 1;
    }
    if (rank >= 1 && rank <= 5) {
      stats.influenceScore += 6 - rank;
    }
    if (
      ranking.updated_at &&
      (!stats.latestUpdatedAt ||
        new Date(ranking.updated_at).getTime() >
          new Date(stats.latestUpdatedAt).getTime())
    ) {
      stats.latestUpdatedAt = ranking.updated_at;
    }

    statsByProfileId.set(ranking.profile_id, stats);
  }
  assignInfluenceBasisPoints(statsByProfileId);

  const entries = profiles.map((profile) => {
    const monthlyChallenge = monthlyChallengeByProfileId.get(profile.id);
    const monthlyChallengePoint = monthlyChallengePointsByProfileId.get(profile.id);
    const stats = statsByProfileId.get(profile.id) ?? {
      firstPlaceCount: 0,
      fiveStarCount: 0,
      influenceScore: 0,
      influenceBasisPoints: 0,
      scoreCount: 0,
      latestUpdatedAt: profile.updated_at,
    };

    return {
      profileId: profile.id,
      rank: 0,
      influenceRank: 0,
      fiveStarRank: 0,
      monthlyChallengeRank: monthlyChallenge?.monthlyChallengeRank ?? 0,
      monthlyChallengePointRank:
        monthlyChallengePoint?.monthlyChallengePointRank ?? 0,
      playerName: profile.maimai_name ?? profile.discord_username ?? "미등록",
      discordUsername: profile.discord_username,
      maimaiRating: profile.maimai_rating,
      firstPlaceCount: stats.firstPlaceCount,
      fiveStarCount: stats.fiveStarCount,
      fiveStarPercent: 0,
      influenceScore: stats.influenceScore,
      influencePercent: stats.influenceBasisPoints / 100,
      monthlyChallengeCount: monthlyChallenge?.monthlyChallengeCount ?? 0,
      monthlyChallengePercent: monthlyChallenge?.monthlyChallengePercent ?? 0,
      monthlyChallengePointPercent:
        monthlyChallengePoint?.monthlyChallengePointPercent ?? 0,
      monthlyChallengePoints: monthlyChallengePoint?.monthlyChallengePoints ?? 0,
      scoreCount: stats.scoreCount,
      latestUpdatedAt: stats.latestUpdatedAt,
    };
  });

  if (totalChartCount > 0) {
    for (const entry of entries) {
      entry.fiveStarPercent = (entry.fiveStarCount / totalChartCount) * 100;
    }
  }

  assignCompetitionRanks(
    entries,
    (item) => item.influenceScore,
    (item, rank) => {
      item.influenceRank = rank;
    },
    (left, right) => left.playerName.localeCompare(right.playerName),
  );
  assignCompetitionRanks(
    entries,
    (item) => item.fiveStarCount,
    (item, rank) => {
      item.fiveStarRank = rank;
    },
    (left, right) => left.playerName.localeCompare(right.playerName),
  );

  const sortedEntries = entries.sort((left, right) => {
    if (right.firstPlaceCount !== left.firstPlaceCount) {
      return right.firstPlaceCount - left.firstPlaceCount;
    }
    if (right.scoreCount !== left.scoreCount) {
      return right.scoreCount - left.scoreCount;
    }
    return left.playerName.localeCompare(right.playerName);
  });

  assignCompetitionRanks(
    sortedEntries,
    (item) => item.firstPlaceCount,
    (item, rank) => {
      item.rank = rank;
    },
    (left, right) => {
      if (right.scoreCount !== left.scoreCount) {
        return right.scoreCount - left.scoreCount;
      }
      return left.playerName.localeCompare(right.playerName);
    },
  );

  return sortedEntries;
}

export function buildMonthlyChallengePointLeaderboard(
  profiles: ProfileRow[],
  challengePoints: MonthlyChallengePointRow[],
): Pick<
  PlayerLeaderboardEntry,
  | "profileId"
  | "playerName"
  | "discordUsername"
  | "maimaiRating"
  | "monthlyChallengePointPercent"
  | "monthlyChallengePointRank"
  | "monthlyChallengePoints"
>[] {
  const pointsByProfileId = new Map(
    challengePoints.map((row) => [row.profile_id, Number(row.points)]),
  );
  const entries = profiles.map((profile) => ({
    profileId: profile.id,
    playerName: profile.maimai_name ?? profile.discord_username ?? "미등록",
    discordUsername: profile.discord_username,
    maimaiRating: profile.maimai_rating,
    monthlyChallengePointPercent: 0,
    monthlyChallengePointRank: 0,
    monthlyChallengePoints: pointsByProfileId.get(profile.id) ?? 0,
  }));
  const totalPoints = entries.reduce(
    (sum, entry) => sum + entry.monthlyChallengePoints,
    0,
  );

  if (totalPoints > 0) {
    for (const entry of entries) {
      entry.monthlyChallengePointPercent =
        (entry.monthlyChallengePoints / totalPoints) * 100;
    }
  }

  assignCompetitionRanks(
    entries,
    (item) => item.monthlyChallengePoints,
    (item, rank) => {
      item.monthlyChallengePointRank = rank;
    },
    (left, right) => left.playerName.localeCompare(right.playerName),
  );

  return entries.sort((left, right) => {
    if (right.monthlyChallengePoints !== left.monthlyChallengePoints) {
      return right.monthlyChallengePoints - left.monthlyChallengePoints;
    }
    return left.playerName.localeCompare(right.playerName);
  });
}

export function buildMonthlyChallengeLeaderboard(
  profiles: ProfileRow[],
  challengeCounts: MonthlyChallengeCountRow[],
): Pick<
  PlayerLeaderboardEntry,
  | "profileId"
  | "playerName"
  | "discordUsername"
  | "maimaiRating"
  | "monthlyChallengeCount"
  | "monthlyChallengePercent"
  | "monthlyChallengeRank"
>[] {
  const countsByProfileId = new Map(
    challengeCounts.map((row) => [row.profile_id, Number(row.count)]),
  );
  const entries = profiles.map((profile) => ({
    profileId: profile.id,
    playerName: profile.maimai_name ?? profile.discord_username ?? "미등록",
    discordUsername: profile.discord_username,
    maimaiRating: profile.maimai_rating,
    monthlyChallengeCount: countsByProfileId.get(profile.id) ?? 0,
    monthlyChallengePercent: 0,
    monthlyChallengeRank: 0,
  }));
  const totalCount = entries.reduce(
    (sum, entry) => sum + entry.monthlyChallengeCount,
    0,
  );

  if (totalCount > 0) {
    for (const entry of entries) {
      entry.monthlyChallengePercent =
        (entry.monthlyChallengeCount / totalCount) * 100;
    }
  }

  assignCompetitionRanks(
    entries,
    (item) => item.monthlyChallengeCount,
    (item, rank) => {
      item.monthlyChallengeRank = rank;
    },
    (left, right) => left.playerName.localeCompare(right.playerName),
  );

  return entries.sort((left, right) => {
    if (right.monthlyChallengeCount !== left.monthlyChallengeCount) {
      return right.monthlyChallengeCount - left.monthlyChallengeCount;
    }
    return left.playerName.localeCompare(right.playerName);
  });
}

function assignInfluenceBasisPoints(
  statsByProfileId: Map<
    string,
    {
      firstPlaceCount: number;
      influenceScore: number;
      influenceBasisPoints: number;
      scoreCount: number;
      latestUpdatedAt: string | null;
    }
  >,
): void {
  const stats = [...statsByProfileId.values()];
  const totalScore = stats.reduce((sum, item) => sum + item.influenceScore, 0);

  if (totalScore <= 0) {
    return;
  }

  const rawValues = stats.map((item) => {
    const rawBasisPoints = (item.influenceScore / totalScore) * 10000;
    const flooredBasisPoints = Math.floor(rawBasisPoints);
    item.influenceBasisPoints = flooredBasisPoints;
    return {
      item,
      remainder: rawBasisPoints - flooredBasisPoints,
    };
  });
  let remainingBasisPoints =
    10000 - stats.reduce((sum, item) => sum + item.influenceBasisPoints, 0);

  for (const { item } of rawValues.sort((left, right) => right.remainder - left.remainder)) {
    if (remainingBasisPoints <= 0) {
      break;
    }

    item.influenceBasisPoints += 1;
    remainingBasisPoints -= 1;
  }
}

function assignCompetitionRanks<T>(
  entries: T[],
  score: (entry: T) => number,
  assign: (entry: T, rank: number) => void,
  tieBreak: (left: T, right: T) => number,
): void {
  const sorted = [...entries].sort((left, right) => {
    const scoreDiff = score(right) - score(left);
    return scoreDiff === 0 ? tieBreak(left, right) : scoreDiff;
  });
  let currentRank = 0;
  let previousScore: number | null = null;

  sorted.forEach((entry, index) => {
    const currentScore = score(entry);
    if (previousScore === null || currentScore !== previousScore) {
      currentRank = index + 1;
      previousScore = currentScore;
    }

    assign(entry, currentRank);
  });
}

export function listChallengeMonthOptions(
  now = new Date(),
): Array<{ value: string; label: string }> {
  const currentMonth = getCurrentKstMonthKey(now);
  const months: Array<{ value: string; label: string }> = [];
  let cursor = FIRST_CHALLENGE_MONTH;

  while (cursor <= currentMonth) {
    months.push({ value: cursor, label: formatMonthLabel(cursor) });
    cursor = getNextMonthKey(cursor);
  }

  return months.reverse();
}

export function normalizeChallengeMonth(value: string | undefined): string {
  const options = listChallengeMonthOptions();
  const latestMonth = options[0]?.value ?? FIRST_CHALLENGE_MONTH;
  const matchedMonth = options.find((option) => option.value === value);

  return matchedMonth?.value ?? latestMonth;
}

async function fetchAllProfiles(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<ProfileRow[]> {
  return fetchAllPagedRows<ProfileRow>(async (from, to, withCount) => {
    const { data, count, error } = await supabase
      .from("profiles")
      .select("id, discord_username, maimai_name, maimai_rating, updated_at", {
        count: withCount ? "exact" : undefined,
      })
      .range(from, to);

    return { count, data: (data ?? []) as ProfileRow[], error };
  });
}

async function fetchAllRankings(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<RankingRow[]> {
  return fetchAllPagedRows<RankingRow>(async (from, to, withCount) => {
    const { data, count, error } = await supabase
      .from("chart_rankings")
      .select("profile_id, rank, dx_star_count, updated_at", {
        count: withCount ? "exact" : undefined,
      })
      .range(from, to);

    return { count, data: (data ?? []) as RankingRow[], error };
  });
}

async function fetchTotalChartCount(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<number> {
  const { count, error } = await supabase
    .from("song_charts")
    .select("id", { count: "exact", head: true })
    .in("difficulty", [3, 4]);

  if (error) {
    console.error(error);
    return 0;
  }

  return count ?? 0;
}

async function fetchMonthlyChallengeCounts(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  monthKey: string,
): Promise<MonthlyChallengeCountRow[]> {
  const { start, end } = getKstMonthRange(monthKey);
  const rows = await fetchAllPagedRows<DiscordNotificationRow>(
    async (from, to, withCount) => {
      const { data, count, error } = await supabase
        .from("discord_notifications")
        .select("ingest_runs(profile_id)", {
          count: withCount ? "exact" : undefined,
        })
        .eq("notification_type", "channel")
        .eq("status", "sent")
        .ilike("message", "%등수가 상승하였습니다.%")
        .gte("created_at", start)
        .lt("created_at", end)
        .not("ingest_run_id", "is", null)
        .range(from, to);

      return { count, data: (data ?? []) as DiscordNotificationRow[], error };
    },
  );
  const countsByProfileId = new Map<string, number>();

  for (const row of rows) {
    const run = Array.isArray(row.ingest_runs)
      ? row.ingest_runs[0]
      : row.ingest_runs;
    const profileId = run?.profile_id;

    if (!profileId) {
      continue;
    }

    countsByProfileId.set(profileId, (countsByProfileId.get(profileId) ?? 0) + 1);
  }

  return [...countsByProfileId.entries()].map(([profile_id, count]) => ({
    profile_id,
    count,
  }));
}

async function fetchMonthlyChallengePoints(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  monthKey: string,
): Promise<MonthlyChallengePointRow[]> {
  const { start, end } = getKstMonthRange(monthKey);
  const rows = await fetchAllPagedRows<RankingEventRow>(
    async (from, to, withCount) => {
      const { data, count, error } = await supabase
        .from("ranking_events")
        .select("profile_id, actor_profile_id, previous_rank, next_rank", {
          count: withCount ? "exact" : undefined,
        })
        .eq("event_type", "rank_changed")
        .gte("created_at", start)
        .lt("created_at", end)
        .not("previous_rank", "is", null)
        .range(from, to);

      return { count, data: (data ?? []) as RankingEventRow[], error };
    },
  );
  const pointsByProfileId = new Map<string, number>();

  for (const row of rows) {
    const previousRank = row.previous_rank;

    if (
      previousRank === null ||
      row.next_rank >= previousRank ||
      row.actor_profile_id !== row.profile_id
    ) {
      continue;
    }

    const points = previousRank - row.next_rank;
    pointsByProfileId.set(
      row.profile_id,
      (pointsByProfileId.get(row.profile_id) ?? 0) + points,
    );
  }

  return [...pointsByProfileId.entries()].map(([profile_id, points]) => ({
    profile_id,
    points,
  }));
}

async function fetchAllPagedRows<T>(
  fetchPage: (
    from: number,
    to: number,
    withCount: boolean,
  ) => Promise<{ count: number | null; data: T[]; error: unknown }>,
): Promise<T[]> {
  const firstPage = await fetchPage(0, SELECT_PAGE_SIZE - 1, true);

  if (firstPage.error) {
    console.error(firstPage.error);
    return [];
  }

  const totalCount = firstPage.count ?? firstPage.data.length;
  if (totalCount <= SELECT_PAGE_SIZE || firstPage.data.length < SELECT_PAGE_SIZE) {
    return firstPage.data;
  }

  const pageRanges = [];
  for (let from = SELECT_PAGE_SIZE; from < totalCount; from += SELECT_PAGE_SIZE) {
    pageRanges.push([from, Math.min(from + SELECT_PAGE_SIZE - 1, totalCount - 1)] as const);
  }

  const pages = await Promise.all(
    pageRanges.map(([from, to]) => fetchPage(from, to, false)),
  );
  const rows = [...firstPage.data];

  for (const page of pages) {
    if (page.error) {
      console.error(page.error);
      return [];
    }
    rows.push(...page.data);
  }

  return rows;
}

function getCurrentKstMonthKey(now = new Date()): string {
  const kstFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  });

  return kstFormatter.format(now);
}

function getKstMonthRange(monthKey: string): { start: string; end: string } {
  return {
    start: `${monthKey}-01T00:00:00+09:00`,
    end: `${getNextMonthKey(monthKey)}-01T00:00:00+09:00`,
  };
}

function getNextMonthKey(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");

  return `${year}년 ${Number(month)}월`;
}
