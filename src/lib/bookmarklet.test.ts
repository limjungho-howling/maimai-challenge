import { describe, expect, it } from "vitest";

import { buildBookmarklet } from "@/lib/bookmarklet";

describe("buildBookmarklet", () => {
  it("returns a stable loader that fetches public bookmarklet.js", () => {
    const href = buildBookmarklet("https://example.com");
    const source = decodeURIComponent(href.replace(/^javascript:/, ""));

    expect(href).toMatch(/^javascript:/);
    expect(source).toContain("https://example.com/bookmarklet.js");
    expect(source).toContain("document.createElement('script')");
    expect(source).not.toContain("/maimai-mobile/record/musicGenre/search/");
  });

  it("can build a separate catalog bookmarklet loader", () => {
    const href = buildBookmarklet("https://example.com/", "catalog");
    const source = decodeURIComponent(href.replace(/^javascript:/, ""));

    expect(source).toContain("https://example.com/catalog-bookmarklet.js");
  });
});
