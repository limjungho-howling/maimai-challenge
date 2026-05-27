export const DIFFICULTY_LABELS = {
  0: "BASIC",
  1: "ADVANCED",
  2: "EXPERT",
  3: "MASTER",
  4: "Re:MASTER",
} as const;

export const DIFFICULTIES = [0, 1, 2, 3, 4] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type DifficultyLabel = (typeof DIFFICULTY_LABELS)[Difficulty];
export type SongKind = "DX" | "STANDARD";

export function isDifficulty(value: number): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function getDifficultyLabel(difficulty: Difficulty): DifficultyLabel {
  return DIFFICULTY_LABELS[difficulty];
}
