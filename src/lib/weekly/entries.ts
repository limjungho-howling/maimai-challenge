export type WeeklyChallengeCategory = "low" | "middle";

export interface WeeklyPickReference {
  category: WeeklyChallengeCategory;
  pickId: string;
  weekId: string;
}

export interface ExistingWeeklyEntry {
  achievementRate?: number | null;
  dxScore: number;
  maxDxScore?: number;
  submittedAt: string;
}

export interface WeeklyScoreUpdate {
  achievementRate: number | null;
  chartId: string;
  dxScore: number;
  maxDxScore: number;
}

export interface WeeklyEntryUpsert {
  achievement_rate: number | null;
  dx_score: number;
  ingest_run_id: string;
  max_dx_score: number;
  pick_id: string;
  profile_id: string;
  submitted_at: string;
  week_id: string;
}

export function getWeeklyChallengeLevelGroup(
  level: string,
): WeeklyChallengeCategory | null {
  const value = parseLevelValue(level);

  if (value <= 12.5) {
    return "low";
  }

  if (value === 13 || value === 13.5) {
    return "middle";
  }

  return null;
}

export function buildWeeklyEntryUpserts({
  existingEntriesByPickId,
  ingestRunId,
  picksByChartId,
  profileId,
  submittedAt,
  updates,
}: {
  existingEntriesByPickId: Map<string, ExistingWeeklyEntry>;
  ingestRunId: string;
  picksByChartId: Map<string, WeeklyPickReference>;
  profileId: string;
  submittedAt: string;
  updates: WeeklyScoreUpdate[];
}): WeeklyEntryUpsert[] {
  const rows: WeeklyEntryUpsert[] = [];

  for (const update of updates) {
    const pick = picksByChartId.get(update.chartId);
    if (!pick) {
      continue;
    }

    const existing = existingEntriesByPickId.get(pick.pickId);
    const existingToKeep =
      existing && existing.dxScore > update.dxScore ? existing : null;

    rows.push({
      achievement_rate: existingToKeep
        ? existingToKeep.achievementRate ?? update.achievementRate
        : update.achievementRate,
      dx_score: existingToKeep ? existingToKeep.dxScore : update.dxScore,
      ingest_run_id: ingestRunId,
      max_dx_score: existingToKeep
        ? existingToKeep.maxDxScore ?? update.maxDxScore
        : update.maxDxScore,
      pick_id: pick.pickId,
      profile_id: profileId,
      submitted_at: submittedAt,
      week_id: pick.weekId,
    });
  }

  return rows;
}

function parseLevelValue(level: string): number {
  const trimmed = level.trim();
  const numeric = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(numeric)) {
    return Number.POSITIVE_INFINITY;
  }

  return trimmed.endsWith("+") ? numeric + 0.5 : numeric;
}
