import { describe, expect, it } from "vitest";

import { getDxStarImageUrl } from "@/lib/maimai/dx-stars";

describe("DX star assets", () => {
  it("returns the official DX star image URL for star counts from 1 to 5", () => {
    expect(getDxStarImageUrl(1)).toBe(
      "https://maimaidx-eng.com/maimai-mobile/img/music_icon_dxstar_detail_1.png",
    );
    expect(getDxStarImageUrl(5)).toBe(
      "https://maimaidx-eng.com/maimai-mobile/img/music_icon_dxstar_detail_5.png",
    );
  });

  it("returns null when a score has no DX star", () => {
    expect(getDxStarImageUrl(0)).toBeNull();
    expect(getDxStarImageUrl(null)).toBeNull();
  });
});
