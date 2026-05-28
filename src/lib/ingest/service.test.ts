import { describe, expect, it } from "vitest";

import { matchScoresToCatalogCharts } from "@/lib/ingest/service";
import type { ParsedSongScore } from "@/lib/maimai/parser";

const baseScore: ParsedSongScore = {
  title: "Endless World",
  difficulty: 4,
  difficultyLabel: "Re:MASTER",
  level: "14",
  kind: "DX",
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
    const chartsByKey = new Map([["DX\u0000Registered Song\u00004", "chart-1"]]);

    expect(matchScoresToCatalogCharts([registered, missing], chartsByKey)).toEqual({
      scoreUpdates: [{ chartId: "chart-1", score: registered }],
      skippedScores: [missing],
    });
  });
});
