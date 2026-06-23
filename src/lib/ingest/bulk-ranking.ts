import {
  detectRankingEvents,
  type RankingEvent,
  type ScoreEntry,
} from "@/lib/maimai/ranking";

export interface BulkRankingUpdate {
  chartId: string;
  title: string;
  difficultyLabel: string;
  level: string;
  versionName: string | null;
  kind: string;
  dxScore: number;
  maxDxScore: number;
}

export interface BulkRankingResult {
  changedChartIds: Set<string>;
  events: RankingEvent[];
  rankUpEvents: Array<
    RankingEvent & {
      chartTitle: string;
      difficultyLabel: string;
      level: string;
      versionName: string | null;
      kind: string;
      actorDxScore: number;
      actorMaxDxScore: number;
    }
  >;
  rankDropEvents: Array<
    RankingEvent & {
      chartTitle: string;
      difficultyLabel: string;
      level: string;
      versionName: string | null;
      kind: string;
      actorDxScore: number;
      actorMaxDxScore: number;
    }
  >;
}

export function detectBulkRankingEvents({
  actorUserId,
  updates,
  beforeScoresByChartId,
  isInitialIngest = false,
}: {
  actorUserId: string;
  updates: BulkRankingUpdate[];
  beforeScoresByChartId: Map<string, ScoreEntry[]>;
  isInitialIngest?: boolean;
}): BulkRankingResult {
  const changedChartIds = new Set<string>();
  const events: RankingEvent[] = [];
  const rankUpEvents: BulkRankingResult["rankUpEvents"] = [];
  const rankDropEvents: BulkRankingResult["rankDropEvents"] = [];

  for (const update of updates) {
    const before = beforeScoresByChartId.get(update.chartId) ?? [];
    const previousActorScore =
      before.find((entry) => entry.userId === actorUserId)?.dxScore ?? null;

    // 최초 대량 갱신일 때만 기존 기록이 없는 곡을 건너뛴다. 그 외에는 기록이 없던
    // 곡에 새 점수가 들어오면 신규 진입으로 보고 랭킹 이벤트를 생성한다.
    if (previousActorScore === null && isInitialIngest) {
      continue;
    }

    const after = applyActorScore(before, actorUserId, update.dxScore);
    const chartEvents = detectRankingEvents({
      chartId: update.chartId,
      actorUserId,
      before,
      after,
      previousActorScore,
      nextActorScore: update.dxScore,
    });

    if (chartEvents.length === 0) {
      continue;
    }

    changedChartIds.add(update.chartId);
    events.push(...chartEvents);

    // 신규 진입(기존 기록 없음)으로 다른 유저보다 위에 들어가 한 명이라도 강등시키면
    // 액터의 등수 상승(도전장 로그) 대상으로 본다.
    const actorOvertookSomeone = chartEvents.some(
      (event) => event.type === "rank_dropped",
    );

    for (const event of chartEvents) {
      const isExistingRankUp =
        event.type === "rank_changed" &&
        event.userId === actorUserId &&
        event.previousRank !== null &&
        event.nextRank < event.previousRank;
      const isNewEntryRankUp =
        event.type === "score_changed" &&
        event.userId === actorUserId &&
        event.previousRank === null &&
        actorOvertookSomeone;

      if (isExistingRankUp || isNewEntryRankUp) {
        rankUpEvents.push({
          ...event,
          // 신규 진입은 그 곡에 기록이 없어 순위가 없었으므로, 변동 이전 순위를
          // 기존 유저 전원보다 아래(미등록=최하위)인 `기존 유저 수 + 1`로 표시한다.
          previousRank: isNewEntryRankUp ? before.length + 1 : event.previousRank,
          chartTitle: update.title,
          difficultyLabel: update.difficultyLabel,
          level: update.level,
          versionName: update.versionName,
          kind: update.kind,
          actorDxScore: update.dxScore,
          actorMaxDxScore: update.maxDxScore,
        });
      }

      if (event.type !== "rank_dropped") {
        continue;
      }

      rankDropEvents.push({
        ...event,
        chartTitle: update.title,
        difficultyLabel: update.difficultyLabel,
        level: update.level,
        versionName: update.versionName,
        kind: update.kind,
        actorDxScore: update.dxScore,
        actorMaxDxScore: update.maxDxScore,
      });
    }
  }

  return { changedChartIds, events, rankUpEvents, rankDropEvents };
}

function applyActorScore(
  before: ScoreEntry[],
  actorUserId: string,
  nextDxScore: number,
): ScoreEntry[] {
  let foundActor = false;
  const after = before.map((entry) => {
    if (entry.userId !== actorUserId) {
      return entry;
    }

    foundActor = true;
    return { ...entry, dxScore: nextDxScore };
  });

  if (!foundActor) {
    after.push({ userId: actorUserId, dxScore: nextDxScore });
  }

  return after;
}
