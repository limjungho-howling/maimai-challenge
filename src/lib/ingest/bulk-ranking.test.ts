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
          level: "13",
          versionName: "CiRCLE",
          kind: "DX",
          dxScore: 1450,
          maxDxScore: 1500,
        },
        {
          chartId: "chart-b",
          title: "Song B",
          difficultyLabel: "EXPERT",
          level: "12+",
          versionName: "PRiSM PLUS",
          kind: "STANDARD",
          dxScore: 990,
          maxDxScore: 1000,
        },
        {
          chartId: "chart-c",
          title: "Song C",
          difficultyLabel: "Re:MASTER",
          level: "14",
          versionName: null,
          kind: "DX",
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
      chartId: "chart-c",
      userId: "alice",
      previousDxScore: 1500,
      nextDxScore: 1500,
      previousRank: 1,
      nextRank: 2,
    });
    // 기존 기록이 없던 chart-a에 신규 진입하면서 bob을 강등시킨다.
    expect(result.events).toContainEqual({
      type: "rank_dropped",
      chartId: "chart-a",
      userId: "bob",
      previousDxScore: 1400,
      nextDxScore: 1400,
      previousRank: 2,
      nextRank: 3,
    });
    expect(result.rankDropEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chartId: "chart-c",
        chartTitle: "Song C",
        difficultyLabel: "Re:MASTER",
        actorDxScore: 1550,
        actorMaxDxScore: 1600,
      }),
      expect.objectContaining({
        chartId: "chart-a",
        chartTitle: "Song A",
        difficultyLabel: "MASTER",
        actorDxScore: 1450,
        actorMaxDxScore: 1500,
      }),
    ]));
    // 신규 진입으로 추월한 chart-a도 등수 상승(도전장) 로그 대상이며, 이전 순위는 null이다.
    expect(result.rankUpEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chartId: "chart-c",
        chartTitle: "Song C",
        difficultyLabel: "Re:MASTER",
        previousRank: 2,
        nextRank: 1,
      }),
      expect.objectContaining({
        chartId: "chart-a",
        chartTitle: "Song A",
        difficultyLabel: "MASTER",
        previousRank: null,
        nextRank: 2,
      }),
    ]));
    expect(result.rankUpEvents).toHaveLength(2);
  });

  it("skips charts with no previous actor score on the initial bulk ingest", () => {
    const result = detectBulkRankingEvents({
      actorUserId: "actor",
      isInitialIngest: true,
      updates: [
        {
          chartId: "chart-a",
          title: "Song A",
          difficultyLabel: "MASTER",
          level: "13",
          versionName: "CiRCLE",
          kind: "DX",
          dxScore: 1450,
          maxDxScore: 1500,
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
      ]),
    });

    expect(result.changedChartIds).toEqual(new Set());
    expect(result.events).toEqual([]);
    expect(result.rankUpEvents).toEqual([]);
    expect(result.rankDropEvents).toEqual([]);
  });
});
