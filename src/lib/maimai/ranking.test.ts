import { describe, expect, it } from "vitest";

import {
  calculateRanks,
  detectRankingEvents,
} from "@/lib/maimai/ranking";

describe("ranking calculations", () => {
  it("assigns tied users the same rank and skips the next rank", () => {
    expect(
      calculateRanks([
        { userId: "a", dxScore: 1000 },
        { userId: "b", dxScore: 1000 },
        { userId: "c", dxScore: 900 },
      ]),
    ).toEqual([
      { userId: "a", dxScore: 1000, rank: 1 },
      { userId: "b", dxScore: 1000, rank: 1 },
      { userId: "c", dxScore: 900, rank: 3 },
    ]);
  });

  it("reports score changes, rank changes, and does not treat ties as drops", () => {
    const events = detectRankingEvents({
      chartId: "chart-1",
      actorUserId: "actor",
      before: [
        { userId: "alice", dxScore: 1500 },
        { userId: "bob", dxScore: 1400 },
      ],
      after: [
        { userId: "alice", dxScore: 1500 },
        { userId: "actor", dxScore: 1450 },
        { userId: "bob", dxScore: 1400 },
      ],
      previousActorScore: null,
      nextActorScore: 1450,
    });

    expect(events).toContainEqual({
      type: "score_changed",
      chartId: "chart-1",
      userId: "actor",
      previousDxScore: null,
      nextDxScore: 1450,
      previousRank: null,
      nextRank: 2,
    });
    expect(events).toContainEqual({
      type: "rank_dropped",
      chartId: "chart-1",
      userId: "bob",
      previousDxScore: 1400,
      nextDxScore: 1400,
      previousRank: 2,
      nextRank: 3,
    });

    const tied = detectRankingEvents({
      chartId: "chart-2",
      actorUserId: "actor",
      before: [{ userId: "bob", dxScore: 1400 }],
      after: [
        { userId: "bob", dxScore: 1400 },
        { userId: "actor", dxScore: 1400 },
      ],
      previousActorScore: null,
      nextActorScore: 1400,
    });

    expect(tied.some((event) => event.type === "rank_dropped")).toBe(false);
  });
});
