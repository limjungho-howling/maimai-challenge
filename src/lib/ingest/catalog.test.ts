import { describe, expect, it } from "vitest";

import { requireCatalogJackets } from "@/lib/ingest/catalog";
import type { ParsedSongScore } from "@/lib/maimai/parser";

const baseScore: ParsedSongScore = {
  title: "Song",
  difficulty: 3,
  difficultyLabel: "MASTER",
  level: "13",
  kind: "DX",
  achievementRate: 100,
  dxScore: 1000,
  maxDxScore: 1200,
  officialIdx: "idx-1",
  genre: "Genre",
  jacketUrl: "https://maimaidx-eng.com/maimai-mobile/img/Music/000001.png",
};

describe("catalog ingest guards", () => {
  it("rejects catalog rows that would upsert a null jacket URL", () => {
    expect(() =>
      requireCatalogJackets([
        baseScore,
        { ...baseScore, title: "Missing Jacket", officialIdx: "idx-2", jacketUrl: null },
      ]),
    ).toThrow(/재킷 이미지를 가져오지 못했습니다/);
  });
});
