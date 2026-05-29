import type { RankingEvent } from "@/lib/maimai/ranking";

export interface PersonalRankDropEvent
  extends Pick<
    RankingEvent,
    "previousRank" | "nextRank" | "previousDxScore" | "nextDxScore"
  > {
  chartId: string;
  chartTitle: string;
  difficultyLabel: string;
  actorDxScore: number;
  actorMaxDxScore: number;
}

export interface ChannelRankUpEvent
  extends Pick<RankingEvent, "previousRank" | "nextRank"> {
  chartId: string;
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

export interface DailyChallengeGoal {
  chartTitle: string;
  level: string;
  difficultyLabel: string;
  currentRank: number;
  currentDxScore: number;
  targetPlayerName: string;
  targetRank: number;
  targetDxScore: number;
}

const DEFAULT_PERSONAL_RANK_DROP_TITLE =
  "다음 유저에 의해 해당 곡의 디럭스 스코어 등수가 하락하였습니다.";

export function buildPersonalRankDropMessages({
  actorName,
  events,
  appUrl,
  title,
}: {
  playerName: string;
  actorName: string;
  events: PersonalRankDropEvent[];
  appUrl: string;
  title?: string | null;
}): string[] {
  const boldActorName = boldDiscordText(actorName);
  const messageTitle = title?.trim() || DEFAULT_PERSONAL_RANK_DROP_TITLE;
  return events.map((event) => {
    const previousRank = event.previousRank === null ? "-" : `#${event.previousRank}`;
    return [
      formatDiscordTitle(messageTitle),
      "---",
      `유저 : ${boldActorName}`,
      `${event.chartTitle} [${event.difficultyLabel}]`,
      `  순위: ${previousRank} -> #${event.nextRank}`,
      `  내 DX 스코어: ${event.nextDxScore.toLocaleString("ko-KR")} / ${event.actorMaxDxScore.toLocaleString("ko-KR")}`,
      `  역전 기록: DX ${event.actorDxScore.toLocaleString("ko-KR")} (${formatSignedDifference(event.actorDxScore - event.nextDxScore)})`,
      `  곡 랭킹: <${trimTrailingSlash(appUrl)}/charts/${event.chartId}>`,
    ].join("\n");
  });
}

export function buildChannelRankUpMessages({
  actorName,
  events,
  appUrl,
}: {
  actorName: string;
  events: ChannelRankUpEvent[];
  appUrl: string;
}): string[] {
  const boldActorName = boldDiscordText(actorName);
  return events.map((event) => {
    const previousRank = event.previousRank === null ? "-" : `#${event.previousRank}`;
    return [
      formatDiscordTitle(
        `${actorName}의 기록 갱신으로 다음 곡의 등수가 상승하였습니다.`,
      ),
      "---",
      `${event.chartTitle} [${event.difficultyLabel}]`,
      `  순위: ${previousRank} -> #${event.nextRank}`,
      `  DX 스코어: ${event.actorDxScore.toLocaleString("ko-KR")} / ${event.actorMaxDxScore.toLocaleString("ko-KR")}`,
      `  곡 랭킹: <${trimTrailingSlash(appUrl)}/charts/${event.chartId}>`,
    ].join("\n");
  });
}

export function buildRankGoalMessage(playerName: string, goals: RankGoal[]): string {
  if (goals.length === 0) {
    return formatDiscordTitle(`${playerName}님, 현재 추적 중인 역전 목표가 없습니다.`);
  }

  const lines = goals.flatMap((goal, index) => [
    "",
    `${index + 1}. ${goal.chartTitle} [${goal.difficultyLabel}]`,
    `현재 순위: #${goal.currentRank}`,
    `현재 DX 스코어: ${goal.currentDxScore.toLocaleString("ko-KR")} / ${goal.maxDxScore.toLocaleString("ko-KR")}`,
    "나보다 높은 유저",
    ...(goal.higherScores.length > 0
      ? goal.higherScores.map(
          (score) =>
            `#${score.rank} ${boldDiscordText(score.playerName)} · DX ${score.dxScore.toLocaleString("ko-KR")}`,
        )
      : ["없음"]),
  ]);

  return [
    formatDiscordTitle(`${playerName}님의 랜덤 갱신 목표 ${goals.length}개`),
    "---",
    ...lines,
  ].join("\n");
}

export function buildDailyChallengeMessage({
  playerName,
  levelLabel,
  targetLabel,
  goals,
}: {
  playerName: string;
  levelLabel: string;
  targetLabel: string;
  goals: DailyChallengeGoal[];
}): string {
  if (goals.length === 0) {
    return [
      formatDiscordTitle(`${playerName}님, 선택한 조건의 도전장 목표가 없습니다.`),
      "---",
      `레벨: ${levelLabel}`,
      `대상: ${targetLabel}`,
      "현재 기록이 이미 역전 로그의 상대 기록보다 높거나 같은 곡은 제외했습니다.",
    ].join("\n");
  }

  const lines = goals.flatMap((goal, index) => [
    `${index + 1}. ${goal.chartTitle} [${goal.difficultyLabel}] · Lv ${goal.level}`,
    `   내 기록: #${goal.currentRank} · DX ${goal.currentDxScore.toLocaleString("ko-KR")}`,
    `   목표: #${goal.targetRank} ${boldDiscordText(goal.targetPlayerName)} · DX ${goal.targetDxScore.toLocaleString("ko-KR")}`,
  ]);

  return [
    formatDiscordTitle(`${playerName}님의 오늘의 도전장 ${goals.length}개`),
    "---",
    `레벨: ${levelLabel}`,
    `대상: ${targetLabel}`,
    ...lines,
  ].join("\n");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function formatSignedDifference(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toLocaleString("ko-KR")}`;
}

function formatDiscordTitle(value: string): string {
  return `## ${boldDiscordText(value)}`;
}

function boldDiscordText(value: string): string {
  return `**${value.replace(/([\\*_~`|])/g, "\\$1")}**`;
}
