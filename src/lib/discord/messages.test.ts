import { describe, expect, it } from "vitest";

import {
  buildChannelRankUpMessages,
  buildDailyChallengeMessage,
  buildPersonalRankDropMessages,
  buildRankGoalMessage,
  buildRecommendMessage,
  type DailyChallengeGoal,
  type RankGoal,
  type RecommendedChart,
} from "@/lib/discord/messages";

describe("Discord messages", () => {
  it("builds separate personal channel rank drop messages with chart links", () => {
    expect(
      buildPersonalRankDropMessages({
        playerName: "CHANA",
        actorName: "E.HOWL",
        events: [
          {
            chartId: "chart-1",
            chartTitle: "Endless World",
            difficultyLabel: "Re:MASTER",
            level: "14+",
            versionName: "CiRCLE",
            kind: "DX",
            previousRank: 1,
            nextRank: 2,
            previousDxScore: 2400,
            nextDxScore: 2400,
            actorDxScore: 2450,
            actorMaxDxScore: 2500,
          },
        ],
        appUrl: "https://maimai-challenge.vercel.app",
      }),
    ).toEqual([
      expect.stringContaining("**Endless World** [Re:MASTER]"),
    ]);
    const message = buildPersonalRankDropMessages({
      playerName: "CHANA",
      actorName: "E.HOWL",
      events: [
        {
          chartId: "chart-1",
          chartTitle: "Endless World",
          difficultyLabel: "Re:MASTER",
          level: "14+",
          versionName: "CiRCLE",
          kind: "DX",
          previousRank: 1,
          nextRank: 2,
          previousDxScore: 2400,
          nextDxScore: 2400,
          actorDxScore: 2450,
          actorMaxDxScore: 2500,
        },
      ],
      appUrl: "https://maimai-challenge.vercel.app",
    })[0];

    expect(message).toContain("## **다음 유저에 의해 해당 곡의 디럭스 스코어 등수가 하락하였습니다.**");
    expect(message).toContain("---\n유저 : **E.HOWL**");
    expect(message).toContain("유저 : **E.HOWL**");
    expect(message).toContain("**Endless World** [Re:MASTER] · Lv 14+ · CiRCLE · DX");
    expect(message).toContain("내 DX 스코어");
    expect(message).toContain("역전 기록: DX 2,450 (+50)");
    expect(message).toContain("<https://maimai-challenge.vercel.app/charts/chart-1>");
  });

  it("uses a custom personal channel rank drop title", () => {
    const message = buildPersonalRankDropMessages({
      playerName: "CHANA",
      actorName: "E.HOWL",
      title: "도전장이 도착했습니다.",
      events: [
        {
          chartId: "chart-1",
          chartTitle: "Endless World",
          difficultyLabel: "Re:MASTER",
          level: "14+",
          versionName: "CiRCLE",
          kind: "DX",
          previousRank: 1,
          nextRank: 2,
          previousDxScore: 2400,
          nextDxScore: 2400,
          actorDxScore: 2450,
          actorMaxDxScore: 2500,
        },
      ],
      appUrl: "https://maimai-challenge.vercel.app",
    })[0];

    expect(message.startsWith("## **도전장이 도착했습니다.**\n---\n유저 : **E.HOWL**")).toBe(true);
  });

  it("builds separate channel rank up messages", () => {
    const message = buildChannelRankUpMessages({
      actorName: "E.HOWL",
      events: [
        {
          chartId: "chart-2",
          chartTitle: "Song B",
          difficultyLabel: "MASTER",
          level: "13",
          versionName: "PRiSM PLUS",
          kind: "STANDARD",
          previousRank: 3,
          nextRank: 1,
          actorDxScore: 2400,
          actorMaxDxScore: 2500,
        },
      ],
      appUrl: "https://maimai-challenge.vercel.app",
    })[0];

    expect(message).toContain("## **E.HOWL의 기록 갱신으로 다음 곡의 등수가 상승하였습니다.**");
    expect(message).toContain("---\n**Song B** [MASTER] · Lv 13 · PRiSM PLUS · STANDARD");
    expect(message).toContain("순위: #3 -> #1");
    expect(message).toContain("DX 스코어: 2,400 / 2,500");
    expect(message).toContain("<https://maimai-challenge.vercel.app/charts/chart-2>");
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

    expect(message).toContain("## **CHANA님의 랜덤 갱신 목표 1개**");
    expect(message).toContain("---");
    expect(message).toContain("Song A [MASTER]\n현재 순위: #4");
    expect(message).toContain("현재 DX 스코어: 2,300 / 2,500");
    expect(message).toContain("나보다 높은 유저\n#1 **A** · DX 2,450");
    expect(message).toContain("#2 **B** · DX 2,400");
  });

  it("escapes Discord markdown in bold user names", () => {
    const message = buildRankGoalMessage("A*B", []);

    expect(message).toContain("## **A\\*B님, 현재 추적 중인 역전 목표가 없습니다.**");
  });

  it("builds daily challenge messages with current and target records", () => {
    const goals: DailyChallengeGoal[] = [
      {
        chartTitle: "Endless World",
        level: "14+",
        difficultyLabel: "Re:MASTER",
        currentRank: 3,
        currentDxScore: 2400,
        targetPlayerName: "E.HOWL",
        targetRank: 2,
        targetDxScore: 2450,
      },
    ];

    const message = buildDailyChallengeMessage({
      playerName: "CHANA",
      levelLabel: "14+",
      targetLabel: "E.HOWL",
      goals,
    });

    expect(message).toContain("## **CHANA님의 오늘의 도전장 1개**");
    expect(message).toContain("---\n레벨: 14+");
    expect(message).toContain("Endless World [Re:MASTER] · Lv 14+");
    expect(message).toContain("내 기록: #3 · DX 2,400");
    expect(message).toContain("목표: #2 **E.HOWL** · DX 2,450");
  });

  it("builds recommend messages with chart metadata and top scores", () => {
    const recommendations: RecommendedChart[] = [
      {
        chartId: "chart-1",
        chartTitle: "Endless World",
        level: "14+",
        versionName: "CiRCLE",
        kind: "DX",
        difficultyLabel: "Re:MASTER",
        currentDxScore: 2300,
        maxDxScore: 2451,
        topScores: [
          { playerName: "E.HOWL", dxScore: 2451, rank: 1 },
          { playerName: "CHANA", dxScore: 2400, rank: 2 },
        ],
      },
    ];

    const message = buildRecommendMessage({
      playerName: "SILIVARY",
      levelLabel: "14+",
      recommendations,
      appUrl: "https://maimai-challenge.vercel.app",
    });

    expect(message).toContain("## **SILIVARY님의 추천 곡 1개**");
    expect(message).toContain("---\n레벨: 14+");
    expect(message).toContain("1. **Endless World** [Re:MASTER]");
    expect(message).toContain("Lv 14+ · CiRCLE · DX");
    expect(message).toContain("내 DX: 2,300 / 2,451");
    expect(message).toContain("곡 랭킹: <https://maimai-challenge.vercel.app/charts/chart-1>");
    expect(message).toContain("상위 5명:");
    expect(message).toContain("- #1 **E.HOWL** · DX 2,451");
    expect(message).toContain("- #2 **CHANA** · DX 2,400");
  });
});
