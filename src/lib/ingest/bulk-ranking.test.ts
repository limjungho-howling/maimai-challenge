import { describe, expect, it } from "vitest";

import { detectBulkRankingEvents } from "@/lib/ingest/bulk-ranking";

describe("bulk ranking event detection", () => {
  it("computes ranking changes for many charts from preloaded scores", () => {
    const result = detectBulkRankingEvents({
      actorUserId: "actor",
      updates: [
        {
          chartId: "chart-a",
          title: "Song A",
          difficultyLabel: "MASTER",
          dxScore: 1450,
          maxDxScore: 1500,
        },
        {
          chartId: "chart-b",
          title: "Song B",
          difficultyLabel: "EXPERT",
          dxScore: 990,
          maxDxScore: 1000,
        },
        {
          chartId: "chart-c",
          title: "Song C",
          difficultyLabel: "Re:MASTER",
          dxScore: 1550,
          maxDxScore: 1600,
        },
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
        [
          "chart-c",
          [
            { userId: "alice", dxScore: 1500 },
            { userId: "actor", dxScore: 1400 },
          ],
        ],
      ]),
    });

    expect(result.changedChartIds).toEqual(new Set(["chart-a", "chart-b", "chart-c"]));
    expect(result.events).toContainEqual({
      type: "rank_dropped",
      chartId: "chart-a",
      userId: "bob",
      previousDxScore: 1400,
      nextDxScore: 1400,
      previousRank: 2,
      nextRank: 3,
    });
    expect(result.events).toContainEqual({
      type: "rank_dropped",
      chartId: "chart-c",
      userId: "alice",
      previousDxScore: 1500,
      nextDxScore: 1500,
      previousRank: 1,
      nextRank: 2,
    });
    expect(result.rankDropEvents).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        chartId: "chart-a",
      }),
    ]));
    expect(result.rankDropEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chartId: "chart-c",
        chartTitle: "Song C",
        difficultyLabel: "Re:MASTER",
        actorDxScore: 1550,
        actorMaxDxScore: 1600,
      }),
    ]));
    expect(result.rankUpEvents).toEqual([
      expect.objectContaining({
        chartId: "chart-c",
        chartTitle: "Song C",
        difficultyLabel: "Re:MASTER",
        previousRank: 2,
        nextRank: 1,
      }),
    ]);
  });
});
