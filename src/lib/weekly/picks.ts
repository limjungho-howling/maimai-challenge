import { getWeeklyChallengeLevelGroup } from "@/lib/weekly/entries";

export interface WeeklyChallengePickCandidate {
  chart_id: string;
  level: string;
}

export function selectWeeklyChallengeCandidate<T extends WeeklyChallengePickCandidate>(
  candidates: T[],
  {
    category,
    random = Math.random,
    usedChartIds,
  }: {
    category: "low" | "middle";
    random?: () => number;
    usedChartIds: Set<string>;
  },
): T | null {
  const categoryCandidates = candidates.filter(
    (candidate) => getWeeklyChallengeLevelGroup(candidate.level) === category,
  );
  const unusedCandidates = categoryCandidates.filter(
    (candidate) => !usedChartIds.has(candidate.chart_id),
  );
  const pool = unusedCandidates.length > 0 ? unusedCandidates : categoryCandidates;

  if (pool.length === 0) {
    return null;
  }

  const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);
  return pool[index] ?? null;
}
