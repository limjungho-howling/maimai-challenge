import { unstable_cache } from "next/cache";

import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const SELECT_PAGE_SIZE = 1000;
export const PLAYER_LEADERBOARD_CACHE_TAG = "player-leaderboard";

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
  return cachedListPlayerLeaderboard();
}

const cachedListPlayerLeaderboard = unstable_cache(
  async (): Promise<PlayerLeaderboardEntry[]> => {
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
        new Date(ranking.updated_at).getTime() > new Date(stats.latestUpdatedAt).getTime())
    ) {
      stats.latestUpdatedAt = ranking.updated_at;
    }

    statsByProfileId.set(ranking.profile_id, stats);
  }
  assignInfluenceBasisPoints(statsByProfileId);

  const entries = profiles
    .map((profile) => {
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
        playerName: profile.maimai_name ?? "미등록",
        discordUsername: profile.discord_username,
        maimaiRating: profile.maimai_rating,
        firstPlaceCount: stats.firstPlaceCount,
        influenceScore: stats.influenceScore,
        influencePercent: stats.influenceBasisPoints / 100,
        scoreCount: stats.scoreCount,
        latestUpdatedAt: stats.latestUpdatedAt,
      };
    })
    .map((entry, _index, allEntries) => ({
      ...entry,
      influenceRank: calculateRank(
        entry,
        allEntries,
        (item) => item.influenceScore,
        (left, right) => left.playerName.localeCompare(right.playerName),
      ),
    }));

  return entries
    .sort((left, right) => {
      if (right.firstPlaceCount !== left.firstPlaceCount) {
        return right.firstPlaceCount - left.firstPlaceCount;
      }
      if (right.scoreCount !== left.scoreCount) {
        return right.scoreCount - left.scoreCount;
      }
      return left.playerName.localeCompare(right.playerName);
    })
    .map((entry, index, entries) => ({
      ...entry,
      rank:
        index > 0 &&
        entries[index - 1].firstPlaceCount === entry.firstPlaceCount
          ? entries[index - 1].rank
          : index + 1,
    }));
  },
  ["player-leaderboard"],
  { revalidate: 1800, tags: [PLAYER_LEADERBOARD_CACHE_TAG] },
);

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

function calculateRank<T>(
  entry: T,
  entries: T[],
  score: (entry: T) => number,
  tieBreak: (left: T, right: T) => number,
): number {
  const sorted = [...entries].sort((left, right) => {
    const scoreDiff = score(right) - score(left);
    return scoreDiff === 0 ? tieBreak(left, right) : scoreDiff;
  });
  const index = sorted.findIndex((item) => item === entry);

  if (index <= 0) {
    return 1;
  }

  const previous = sorted[index - 1];
  return score(previous) === score(entry)
    ? calculateRank(previous, sorted, score, tieBreak)
    : index + 1;
}

async function fetchAllProfiles(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, discord_username, maimai_name, maimai_rating, updated_at")
      .range(from, from + SELECT_PAGE_SIZE - 1);

    if (error) {
      console.error(error);
      return [];
    }

    rows.push(...((data ?? []) as ProfileRow[]));
    if ((data ?? []).length < SELECT_PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchAllRankings(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<RankingRow[]> {
  const rows: RankingRow[] = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chart_rankings")
      .select("profile_id, rank, updated_at")
      .range(from, from + SELECT_PAGE_SIZE - 1);

    if (error) {
      console.error(error);
      return [];
    }

    rows.push(...((data ?? []) as RankingRow[]));
    if ((data ?? []).length < SELECT_PAGE_SIZE) {
      return rows;
    }
  }
}
