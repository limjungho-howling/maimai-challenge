import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildBookmarklet } from "@/lib/bookmarklet";

describe("buildBookmarklet", () => {
  it("returns a stable loader that fetches public bookmarklet.js", () => {
    const href = buildBookmarklet("https://example.com");
    const source = decodeURIComponent(href.replace(/^javascript:/, ""));

    expect(href).toMatch(/^javascript:/);
    expect(source).toContain("https://example.com/bookmarklet.js");
    expect(source).toContain("__MAIMAI_CHALLENGE_APP_ORIGIN");
    expect(source).toContain("__MAIMAI_CHALLENGE_RELAY_WINDOW");
    expect(source).toContain("window.open");
    expect(source).toContain("https://example.com/ingest/relay");
    expect(source).toContain("document.createElement('script')");
    expect(source).not.toContain("/maimai-mobile/record/musicGenre/search/");
  });

  it("returns a catalog loader that fetches public catalog-bookmarklet.js", () => {
    const href = buildBookmarklet("https://example.com", "catalog");
    const source = decodeURIComponent(href.replace(/^javascript:/, ""));

    expect(source).toContain("https://example.com/catalog-bookmarklet.js");
  });

  it("returns a new catalog loader that fetches public new-catalog-bookmarklet.js", () => {
    const href = buildBookmarklet("https://example.com", "new-catalog");
    const source = decodeURIComponent(href.replace(/^javascript:/, ""));

    expect(source).toContain("https://example.com/new-catalog-bookmarklet.js");
    expect(source).toContain("https://example.com/ingest/relay");
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
    expect(source).toContain("fetchPlayerHtml");
    expect(source).toContain("hasValidPlayerData");
    expect(source).toContain("PLAYER_DATA_RETRY_COUNT = 5");
    expect(source).toContain("__MAIMAI_CHALLENGE_RELAY_WINDOW");
  });

  it("collects catalog pages by version with a 0.1 second interval", () => {
    const source = readFileSync("public/catalog-bookmarklet-runner.js", "utf8");

    expect(source).toContain("musicVersion/search/?version=");
    expect(source).toContain("musicDetail/?idx=");
    expect(source).toContain("REQUEST_INTERVAL_MS = 100");
    expect(source).toContain("maimai-challenge:detail-progress");
    expect(source).toContain("failedDetails.push");
    expect(source).toContain("failedScorePages.push");
    expect(source).toContain("const text = await response.text()");
    expect(source).toContain("waitForUploadComplete");
    expect(source).toContain("RECOVERY_ROUND_COUNT");
    expect(source).toContain("collectScorePages");
    expect(source).toContain("maimai-challenge:collection-complete");
    expect(source).toContain("versionName");
    expect(source).toContain("uploadType: \"catalog\"");
    expect(source).toContain("__MAIMAI_CHALLENGE_RELAY_WINDOW");
  });

  it("collects only CiRCLE catalog pages from the new catalog loader", () => {
    const loader = readFileSync("public/new-catalog-bookmarklet.js", "utf8");
    const runner = readFileSync("public/catalog-bookmarklet-runner.js", "utf8");

    expect(loader).toContain("scope=circle");
    expect(loader).toContain("__MAIMAI_CHALLENGE_CATALOG_SCOPE");
    expect(loader).toContain("runner.onerror");
    expect(runner).toContain('RUNNER_SCOPE === "circle"');
    expect(runner).toContain("__MAIMAI_CHALLENGE_CATALOG_SCOPE");
    expect(runner).toContain('[[25, "CiRCLE"]]');
  });
});
