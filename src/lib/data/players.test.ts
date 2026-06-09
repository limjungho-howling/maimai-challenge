import { describe, expect, it } from "vitest";

import {
  buildMonthlyChallengeLeaderboard,
  buildMonthlyChallengePointLeaderboard,
} from "@/lib/data/players";

describe("player leaderboard data", () => {
  it("builds monthly challenge counts with zero-count profiles and competition ranks", () => {
    const entries = buildMonthlyChallengeLeaderboard(
      [
        {
          id: "a",
          discord_username: "alpha",
          maimai_name: "ALPHA",
          maimai_rating: 15000,
          updated_at: "2026-06-03T00:00:00+09:00",
        },
        {
          id: "b",
          discord_username: "bravo",
          maimai_name: "BRAVO",
          maimai_rating: 14000,
          updated_at: "2026-06-04T00:00:00+09:00",
        },
        {
          id: "c",
          discord_username: "charlie",
          maimai_name: "CHARLIE",
          maimai_rating: 13000,
          updated_at: "2026-06-05T00:00:00+09:00",
        },
      ],
      [
        { profile_id: "a", count: 2 },
        { profile_id: "b", count: 2 },
      ],
    );

    expect(entries).toEqual([
      expect.objectContaining({
        profileId: "a",
        monthlyChallengeCount: 2,
        monthlyChallengeRank: 1,
        monthlyChallengePercent: 50,
      }),
      expect.objectContaining({
        profileId: "b",
        monthlyChallengeCount: 2,
        monthlyChallengeRank: 1,
        monthlyChallengePercent: 50,
      }),
      expect.objectContaining({
        profileId: "c",
        monthlyChallengeCount: 0,
        monthlyChallengeRank: 3,
        monthlyChallengePercent: 0,
      }),
    ]);
  });

  it("builds monthly challenge point ranks from summed rank-up distance", () => {
    const entries = buildMonthlyChallengePointLeaderboard(
      [
        {
          id: "a",
          discord_username: "alpha",
          maimai_name: "ALPHA",
          maimai_rating: 15000,
          updated_at: "2026-06-03T00:00:00+09:00",
        },
        {
          id: "b",
          discord_username: "bravo",
          maimai_name: "BRAVO",
          maimai_rating: 14000,
          updated_at: "2026-06-04T00:00:00+09:00",
        },
        {
          id: "c",
          discord_username: "charlie",
          maimai_name: "CHARLIE",
          maimai_rating: 13000,
          updated_at: "2026-06-05T00:00:00+09:00",
        },
      ],
      [
        { profile_id: "a", points: 7 },
        { profile_id: "b", points: 3 },
      ],
    );

    expect(entries).toEqual([
      expect.objectContaining({
        profileId: "a",
        monthlyChallengePointPercent: 70,
        monthlyChallengePointRank: 1,
        monthlyChallengePoints: 7,
      }),
      expect.objectContaining({
        profileId: "b",
        monthlyChallengePointPercent: 30,
        monthlyChallengePointRank: 2,
        monthlyChallengePoints: 3,
      }),
      expect.objectContaining({
        profileId: "c",
        monthlyChallengePointPercent: 0,
        monthlyChallengePointRank: 3,
        monthlyChallengePoints: 0,
      }),
    ]);
  });
});
