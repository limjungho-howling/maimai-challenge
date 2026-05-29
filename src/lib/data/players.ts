import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const SELECT_PAGE_SIZE = 1000;

export interface PlayerLeaderboardEntry {
  profileId: string;
  rank: number;
  influenceRank: number;
  playerName: string;
  discordUsername: string | null;
  maimaiRating: number | null;
  firstPlaceCount: number;
  influenceScore: number;
  influencePercent: number;
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
  profile_id: string;
  rank: number;
  updated_at: string | null;
}

export async function listPlayerLeaderboard(): Promise<PlayerLeaderboardEntry[]> {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const [profiles, rankings] = await Promise.all([
    fetchAllProfiles(supabase),
    fetchAllRankings(supabase),
  ]);
  const statsByProfileId = new Map<
    string,
    {
      firstPlaceCount: number;
      influenceScore: number;
      influenceBasisPoints: number;
      scoreCount: number;
      latestUpdatedAt: string | null;
    }
  >();

  for (const ranking of rankings) {
    const stats = statsByProfileId.get(ranking.profile_id) ?? {
      firstPlaceCount: 0,
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
    const stats = statsByProfileId.get(profile.id) ?? {
      firstPlaceCount: 0,
      influenceScore: 0,
      influenceBasisPoints: 0,
      scoreCount: 0,
      latestUpdatedAt: profile.updated_at,
    };

    return {
      profileId: profile.id,
      rank: 0,
      influenceRank: 0,
      playerName: profile.maimai_name ?? profile.discord_username ?? "미등록",
      discordUsername: profile.discord_username,
      maimaiRating: profile.maimai_rating,
      firstPlaceCount: stats.firstPlaceCount,
      influenceScore: stats.influenceScore,
      influencePercent: stats.influenceBasisPoints / 100,
      scoreCount: stats.scoreCount,
      latestUpdatedAt: stats.latestUpdatedAt,
    };
  });

  assignCompetitionRanks(
    entries,
    (item) => item.influenceScore,
    (item, rank) => {
      item.influenceRank = rank;
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
      .select("profile_id, rank, updated_at", {
        count: withCount ? "exact" : undefined,
      })
      .range(from, to);

    return { count, data: (data ?? []) as RankingRow[], error };
  });
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
