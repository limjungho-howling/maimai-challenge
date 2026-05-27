export interface ScoreEntry {
  userId: string;
  dxScore: number;
}

export interface RankedScoreEntry extends ScoreEntry {
  rank: number;
}

export type RankingEventType = "score_changed" | "rank_changed" | "rank_dropped";

export interface RankingEvent {
  type: RankingEventType;
  chartId: string;
  userId: string;
  previousDxScore: number | null;
  nextDxScore: number;
  previousRank: number | null;
  nextRank: number;
}

export interface DetectRankingEventsInput {
  chartId: string;
  actorUserId: string;
  before: ScoreEntry[];
  after: ScoreEntry[];
  previousActorScore: number | null;
  nextActorScore: number;
}

export function calculateRanks(scores: ScoreEntry[]): RankedScoreEntry[] {
  const sorted = [...scores].sort((a, b) => {
    if (b.dxScore !== a.dxScore) {
      return b.dxScore - a.dxScore;
    }

    return a.userId.localeCompare(b.userId);
  });

  let previousScore: number | null = null;
  let previousRank = 0;

  return sorted.map((score, index) => {
    const rank =
      previousScore !== null && score.dxScore === previousScore
        ? previousRank
        : index + 1;

    previousScore = score.dxScore;
    previousRank = rank;

    return { ...score, rank };
  });
}

export function detectRankingEvents({
  chartId,
  actorUserId,
  before,
  after,
  previousActorScore,
  nextActorScore,
}: DetectRankingEventsInput): RankingEvent[] {
  const beforeRanks = indexByUser(calculateRanks(before));
  const afterRanks = indexByUser(calculateRanks(after));
  const events: RankingEvent[] = [];
  const actorAfter = afterRanks.get(actorUserId);

  if (!actorAfter) {
    return events;
  }

  if (previousActorScore !== nextActorScore) {
    events.push({
      type: "score_changed",
      chartId,
      userId: actorUserId,
      previousDxScore: previousActorScore,
      nextDxScore: nextActorScore,
      previousRank: beforeRanks.get(actorUserId)?.rank ?? null,
      nextRank: actorAfter.rank,
    });
  }

  for (const afterScore of afterRanks.values()) {
    const beforeScore = beforeRanks.get(afterScore.userId);

    if (!beforeScore || beforeScore.rank === afterScore.rank) {
      continue;
    }

    events.push({
      type:
        afterScore.rank > beforeScore.rank && afterScore.userId !== actorUserId
          ? "rank_dropped"
          : "rank_changed",
      chartId,
      userId: afterScore.userId,
      previousDxScore: beforeScore.dxScore,
      nextDxScore: afterScore.dxScore,
      previousRank: beforeScore.rank,
      nextRank: afterScore.rank,
    });
  }

  return events;
}

function indexByUser(scores: RankedScoreEntry[]): Map<string, RankedScoreEntry> {
  return new Map(scores.map((score) => [score.userId, score]));
}
