import type { RankingEvent } from "@/lib/maimai/ranking";

export interface PersonalRankDropEvent
  extends Pick<
    RankingEvent,
    "previousRank" | "nextRank" | "previousDxScore" | "nextDxScore"
  > {
  chartTitle: string;
  difficultyLabel: string;
  actorDxScore: number;
  actorMaxDxScore: number;
}

export interface RankGoal {
  chartTitle: string;
  difficultyLabel: string;
  currentRank: number;
  currentDxScore: number;
  maxDxScore: number;
  higherScores: Array<{
    playerName: string;
    dxScore: number;
    rank: number;
  }>;
}

export function buildPersonalRankDropMessage({
  playerName,
  events,
}: {
  playerName: string;
  events: PersonalRankDropEvent[];
}): string {
  const lines = events.map((event) => {
    const previousRank = event.previousRank === null ? "-" : `#${event.previousRank}`;
    return [
      `- ${event.chartTitle} [${event.difficultyLabel}]`,
      `  순위: ${previousRank} -> #${event.nextRank}`,
      `  내 DX: ${event.nextDxScore.toLocaleString("ko-KR")} / ${event.actorMaxDxScore.toLocaleString("ko-KR")}`,
      `  역전 기록: DX ${event.actorDxScore.toLocaleString("ko-KR")}`,
    ].join("\n");
  });

  return [
    `${playerName}님, 새 갱신으로 등수 하락이 발생했습니다.`,
    ...lines,
  ].join("\n");
}

export function buildRankGoalMessage(playerName: string, goals: RankGoal[]): string {
  if (goals.length === 0) {
    return `${playerName}님, 현재 추적 중인 역전 목표가 없습니다.`;
  }

  const lines = goals.flatMap((goal, index) => [
    `${index + 1}. ${goal.chartTitle} [${goal.difficultyLabel}]`,
    `   현재 #${goal.currentRank} · DX ${goal.currentDxScore.toLocaleString("ko-KR")} / ${goal.maxDxScore.toLocaleString("ko-KR")}`,
    ...goal.higherScores.map(
      (score) =>
        `   #${score.rank} ${score.playerName}: DX ${score.dxScore.toLocaleString("ko-KR")}`,
    ),
  ]);

  return [`${playerName}님의 랜덤 갱신 목표 ${goals.length}개`, ...lines].join("\n");
}
