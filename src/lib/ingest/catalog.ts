import type { ParsedSongScore } from "@/lib/maimai/parser";

export function requireCatalogJackets(scores: ParsedSongScore[]): void {
  const missing = scores.filter((score) => !score.jacketUrl);

  if (missing.length === 0) {
    return;
  }

  const examples = missing
    .slice(0, 5)
    .map((score) => `${score.title} ${score.difficultyLabel}`)
    .join(", ");
  throw new Error(
    `곡 재킷 이미지를 가져오지 못했습니다. 누락 ${missing.length}개: ${examples}. 네트워크가 안정적인 상태에서 곡 정보 수집 북마클릿을 다시 실행해주세요.`,
  );
}
