import { describe, expect, it } from "vitest";

import {
  buildPersonalRankDropMessage,
  buildRankGoalMessage,
  type RankGoal,
} from "@/lib/discord/messages";

describe("Discord messages", () => {
  it("builds a personal channel rank drop message with chart and rank details", () => {
    expect(
      buildPersonalRankDropMessage({
        playerName: "CHANA",
        events: [
          {
            chartTitle: "Endless World",
            difficultyLabel: "Re:MASTER",
            previousRank: 1,
            nextRank: 2,
            previousDxScore: 2400,
            nextDxScore: 2400,
            actorDxScore: 2450,
            actorMaxDxScore: 2500,
          },
        ],
      }),
    ).toContain("Endless World [Re:MASTER]");
  });

  it("builds a rank goal message with higher scores above the user", () => {
    const goals: RankGoal[] = [
      {
        chartTitle: "Song A",
        difficultyLabel: "MASTER",
        currentRank: 4,
        currentDxScore: 2300,
        maxDxScore: 2500,
        higherScores: [
          { playerName: "A", dxScore: 2450, rank: 1 },
          { playerName: "B", dxScore: 2400, rank: 2 },
        ],
      },
    ];

    const message = buildRankGoalMessage("CHANA", goals);

    expect(message).toContain("CHANA님의 랜덤 갱신 목표 1개");
    expect(message).toContain("현재 #4");
    expect(message).toContain("#1 A: DX 2,450");
  });
});
