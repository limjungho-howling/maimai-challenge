import { describe, expect, it } from "vitest";

import { buildPlayerScoreRows, matchScoresToCatalogCharts } from "@/lib/ingest/service";
import type { ParsedSongScore } from "@/lib/maimai/parser";

const baseScore: ParsedSongScore = {
  title: "Endless World",
  difficulty: 4,
  difficultyLabel: "Re:MASTER",
  level: "14",
  kind: "DX",
  versionNumber: null,
  versionName: null,
  achievementRate: 100,
  dxScore: 2000,
  maxDxScore: 2000,
  officialIdx: "idx",
  genre: null,
  jacketUrl: null,
};

describe("matchScoresToCatalogCharts", () => {
  it("skips scores whose charts are not registered yet", () => {
    const registered = { ...baseScore, title: "Registered Song" };
    const missing = { ...baseScore, title: "Missing Song" };
    const chart = {
      chartId: "chart-1",
      title: "Registered Song",
      difficultyLabel: "Re:MASTER",
    };
    const chartsByKey = new Map([["DX\u0000Registered Song\u00004", chart]]);

    expect(matchScoresToCatalogCharts([registered, missing], chartsByKey)).toEqual({
      scoreUpdates: [{ chartId: "chart-1", chart, score: registered }],
      skippedScores: [missing],
    });
  });
});

describe("buildPlayerScoreRows", () => {
  it("keeps updated_at for unchanged existing scores", () => {
    const rows = buildPlayerScoreRows({
      collectedAt: "2026-06-11T12:00:00+09:00",
      now: "2026-06-11T12:00:05+09:00",
      previousScoresByChartId: new Map([
        [
          "chart-1",
          {
            dxScore: 2400,
            updatedAt: "2026-06-01T10:00:00+09:00",
          },
        ],
        [
          "chart-2",
          {
            dxScore: 2300,
            updatedAt: "2026-06-01T10:00:00+09:00",
          },
        ],
      ]),
      profileId: "profile-1",
      updates: [
        {
          chartId: "chart-1",
          score: {
            ...baseScore,
            dxScore: 2400,
          },
        },
        {
          chartId: "chart-2",
          score: {
            ...baseScore,
            dxScore: 2350,
          },
        },
      ],
    });

    expect(
      rows.map((row) => ({
        chart_id: row.chart_id,
        updated_at: row.updated_at,
      })),
    ).toEqual([
      {
        chart_id: "chart-1",
        updated_at: "2026-06-01T10:00:00+09:00",
      },
      {
        chart_id: "chart-2",
        updated_at: "2026-06-11T12:00:05+09:00",
      },
    ]);
  });
});
