export const DIFFICULTY_LABELS = {
  0: "BASIC",
  1: "ADVANCED",
  2: "EXPERT",
  3: "MASTER",
  4: "Re:MASTER",
} as const;

export const DIFFICULTIES = [0, 1, 2, 3, 4] as const;
export const RANKING_DIFFICULTIES = [3, 4] as const;

export const MAIMAI_VERSIONS = [
  { number: 0, name: "maimai" },
  { number: 1, name: "maimai PLUS" },
  { number: 2, name: "GreeN" },
  { number: 3, name: "GreeN PLUS" },
  { number: 4, name: "ORANGE" },
  { number: 5, name: "ORANGE PLUS" },
  { number: 6, name: "PiNK" },
  { number: 7, name: "PiNK PLUS" },
  { number: 8, name: "MURASAKi" },
  { number: 9, name: "MURASAKi PLUS" },
  { number: 10, name: "MiLK" },
  { number: 11, name: "MiLK PLUS" },
  { number: 12, name: "FiNALE" },
  { number: 13, name: "でらっくす" },
  { number: 14, name: "でらっくす PLUS" },
  { number: 15, name: "スプラッシュ" },
  { number: 16, name: "スプラッシュ PLUS" },
  { number: 17, name: "UNiVERSE" },
  { number: 18, name: "UNiVERSE PLUS" },
  { number: 19, name: "FESTiVAL" },
  { number: 20, name: "FESTiVAL PLUS" },
  { number: 21, name: "BUDDiES" },
  { number: 22, name: "BUDDiES PLUS" },
  { number: 23, name: "PRiSM" },
  { number: 24, name: "PRiSM PLUS" },
  { number: 25, name: "CiRCLE" },
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type DifficultyLabel = (typeof DIFFICULTY_LABELS)[Difficulty];
export type SongKind = "DX" | "STANDARD";

export function isDifficulty(value: number): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function getDifficultyLabel(difficulty: Difficulty): DifficultyLabel {
  return DIFFICULTY_LABELS[difficulty];
}
