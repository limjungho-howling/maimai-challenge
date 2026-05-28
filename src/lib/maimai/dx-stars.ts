const DX_STAR_IMAGE_BASE =
  "https://maimaidx-eng.com/maimai-mobile/img/music_icon_dxstar_detail";

export function getDxStarImageUrl(starCount: number | null): string | null {
  if (!starCount || starCount < 1 || starCount > 5) {
    return null;
  }

  return `${DX_STAR_IMAGE_BASE}_${starCount}.png`;
}
