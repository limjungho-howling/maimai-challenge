import { describe, expect, it } from "vitest";

import { isAllowedMaimaiMobileUrl } from "@/lib/bookmarklet-target";

describe("isAllowedMaimaiMobileUrl", () => {
  it("allows every page under the maimai-mobile official site path", () => {
    expect(
      isAllowedMaimaiMobileUrl("https://maimaidx-eng.com/maimai-mobile/"),
    ).toBe(true);
    expect(
      isAllowedMaimaiMobileUrl(
        "https://maimaidx-eng.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=3",
      ),
    ).toBe(true);
    expect(
      isAllowedMaimaiMobileUrl(
        "https://maimaidx-eng.com/maimai-mobile/playerData/",
      ),
    ).toBe(true);
  });

  it("rejects other origins and non-mobile official paths", () => {
    expect(isAllowedMaimaiMobileUrl("https://maimaidx-eng.com/")).toBe(false);
    expect(isAllowedMaimaiMobileUrl("http://maimaidx-eng.com/maimai-mobile/")).toBe(
      false,
    );
    expect(
      isAllowedMaimaiMobileUrl("https://maimaidx-eng.com.evil/maimai-mobile/"),
    ).toBe(false);
  });
});
