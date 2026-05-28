import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const SELECT_PAGE_SIZE = 1000;

export interface PlayerLeaderboardEntry {
  profileId: string;
  rank: number;
  playerName: string;
  discordUsername: string | null;
  maimaiRating: number | null;
  firstPlaceCount: number;
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
      scoreCount: number;
      latestUpdatedAt: string | null;
    }
  >();

  for (const ranking of rankings) {
    const stats = statsByProfileId.get(ranking.profile_id) ?? {
      firstPlaceCount: 0,
      scoreCount: 0,
      latestUpdatedAt: null,
    };

    stats.scoreCount += 1;
    if (Number(ranking.rank) === 1) {
      stats.firstPlaceCount += 1;
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

  return profiles
    .map((profile) => {
      const stats = statsByProfileId.get(profile.id) ?? {
        firstPlaceCount: 0,
        scoreCount: 0,
        latestUpdatedAt: profile.updated_at,
      };

      return {
        profileId: profile.id,
        rank: 0,
        playerName: profile.maimai_name ?? "미등록",
        discordUsername: profile.discord_username,
        maimaiRating: profile.maimai_rating,
        firstPlaceCount: stats.firstPlaceCount,
        scoreCount: stats.scoreCount,
        latestUpdatedAt: stats.latestUpdatedAt,
      };
    })
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
