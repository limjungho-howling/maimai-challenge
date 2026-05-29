import type { ParsedSongScore } from "@/lib/maimai/parser";

export function summarizeMissingCatalogJackets(scores: ParsedSongScore[]): string | null {
  const missing = scores.filter((score) => !score.jacketUrl);

  if (missing.length === 0) {
    return null;
  }

  const examples = missing
    .slice(0, 5)
    .map((score) => `${score.title} ${score.difficultyLabel}`)
    .join(", ");
  return `곡 재킷 이미지를 가져오지 못한 항목 ${missing.length}개는 추후 수집으로 보강됩니다: ${examples}.`;
}
