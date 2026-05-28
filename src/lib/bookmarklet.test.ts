import { readFileSync } from "node:fs";
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
});

describe("bookmarklet runner", () => {
  it("waits until the relay is ready before collecting score pages", () => {
    const source = readFileSync("public/bookmarklet-runner.js", "utf8");
    const readyIndex = source.indexOf("await waitForRelayReady()");
    const fetchIndex = source.indexOf("MASTER/Re:MASTER 점수 목록을 수집");

    expect(readyIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeGreaterThan(-1);
    expect(readyIndex).toBeLessThan(fetchIndex);
    expect(source).toContain("maimai-challenge:relay-ready");
    expect(source).toContain("maimai-challenge:hello");
  });
});
