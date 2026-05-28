import { describe, expect, it } from "vitest";

import { detectBulkRankingEvents } from "@/lib/ingest/bulk-ranking";

describe("bulk ranking event detection", () => {
  it("computes ranking changes for many charts from preloaded scores", () => {
    const result = detectBulkRankingEvents({
      actorUserId: "actor",
      updates: [
        { chartId: "chart-a", title: "Song A", difficultyLabel: "MASTER", dxScore: 1450 },
        { chartId: "chart-b", title: "Song B", difficultyLabel: "EXPERT", dxScore: 990 },
      ],
      beforeScoresByChartId: new Map([
        [
          "chart-a",
          [
            { userId: "alice", dxScore: 1500 },
            { userId: "bob", dxScore: 1400 },
          ],
        ],
        ["chart-b", [{ userId: "actor", dxScore: 900 }]],
      ]),
    });

    expect(result.changedChartIds).toEqual(new Set(["chart-a", "chart-b"]));
    expect(result.events).toContainEqual({
      type: "rank_dropped",
      chartId: "chart-a",
      userId: "bob",
      previousDxScore: 1400,
      nextDxScore: 1400,
      previousRank: 2,
      nextRank: 3,
    });
    expect(result.rankDropEvents).toEqual([
      expect.objectContaining({
        chartId: "chart-a",
        chartTitle: "Song A",
        difficultyLabel: "MASTER",
      }),
    ]);
  });
});
