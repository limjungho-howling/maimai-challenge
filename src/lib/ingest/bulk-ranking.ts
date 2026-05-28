import {
  detectRankingEvents,
  type RankingEvent,
  type ScoreEntry,
} from "@/lib/maimai/ranking";

export interface BulkRankingUpdate {
  chartId: string;
  title: string;
  difficultyLabel: string;
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
      actorDxScore: number;
      actorMaxDxScore: number;
    }
  >;
  rankDropEvents: Array<
    RankingEvent & {
      chartTitle: string;
      difficultyLabel: string;
      actorDxScore: number;
      actorMaxDxScore: number;
    }
  >;
}

export function detectBulkRankingEvents({
  actorUserId,
  updates,
  beforeScoresByChartId,
}: {
  actorUserId: string;
  updates: BulkRankingUpdate[];
  beforeScoresByChartId: Map<string, ScoreEntry[]>;
}): BulkRankingResult {
  const changedChartIds = new Set<string>();
  const events: RankingEvent[] = [];
  const rankUpEvents: BulkRankingResult["rankUpEvents"] = [];
  const rankDropEvents: BulkRankingResult["rankDropEvents"] = [];

  for (const update of updates) {
    const before = beforeScoresByChartId.get(update.chartId) ?? [];
    const previousActorScore =
      before.find((entry) => entry.userId === actorUserId)?.dxScore ?? null;
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

    for (const event of chartEvents) {
      if (
        event.type === "rank_changed" &&
        event.userId === actorUserId &&
        event.previousRank !== null &&
        event.nextRank < event.previousRank
      ) {
        rankUpEvents.push({
          ...event,
          chartTitle: update.title,
          difficultyLabel: update.difficultyLabel,
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
