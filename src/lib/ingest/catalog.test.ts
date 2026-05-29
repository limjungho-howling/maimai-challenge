import { describe, expect, it } from "vitest";

import { summarizeMissingCatalogJackets } from "@/lib/ingest/catalog";
import type { ParsedSongScore } from "@/lib/maimai/parser";

const baseScore: ParsedSongScore = {
  title: "Song",
  difficulty: 3,
  difficultyLabel: "MASTER",
  level: "13",
  kind: "DX",
  versionNumber: 25,
  versionName: "CiRCLE",
  achievementRate: 100,
  dxScore: 1000,
  maxDxScore: 1200,
  officialIdx: "idx-1",
  genre: "Genre",
  jacketUrl: "https://maimaidx-eng.com/maimai-mobile/img/Music/000001.png",
};

describe("catalog ingest guards", () => {
  it("summarizes catalog rows that could not fetch a jacket URL", () => {
    expect(
      summarizeMissingCatalogJackets([
        baseScore,
        { ...baseScore, title: "Missing Jacket", officialIdx: "idx-2", jacketUrl: null },
      ]),
    ).toMatch(/재킷 이미지를 가져오지 못한 항목 1개/);
  });
});
