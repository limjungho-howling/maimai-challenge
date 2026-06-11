import { describe, expect, it } from "vitest";

import { mapChartRankingRows } from "@/lib/data/charts";

describe("chart ranking data", () => {
  it("uses each player's own score updated_at for the chart updated time", () => {
    const rankings = mapChartRankingRows([
      {
        achievement_rate: 100.1234,
        chart_id: "chart-1",
        discord_username: "jaehaen_xxx",
        dx_score: 2400,
        dx_star_count: 5,
        max_dx_score: 2500,
        player_name: "ＪａｅＨａｅｎ",
        profile_id: "jaehaen",
        rank: 1,
        updated_at: "2026-06-11T10:00:00+09:00",
      },
      {
        achievement_rate: 99.1234,
        chart_id: "chart-1",
        discord_username: "other_user",
        dx_score: 2300,
        dx_star_count: 4,
        max_dx_score: 2500,
        player_name: "OTHER",
        profile_id: "other",
        rank: 2,
        updated_at: "2026-06-01T10:00:00+09:00",
      },
    ]);

    expect(rankings).toMatchObject([
      {
        profileId: "jaehaen",
        updatedAt: "2026-06-11T10:00:00+09:00",
      },
      {
        profileId: "other",
        updatedAt: "2026-06-01T10:00:00+09:00",
      },
    ]);
  });
});
