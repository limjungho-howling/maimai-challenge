import { describe, expect, it } from "vitest";

import { catalogPayloadSchema, ingestPayloadSchema } from "@/lib/ingest/schema";

const html = "<html><body>fixture</body></html>";

describe("ingest payload schemas", () => {
  it("accepts a single Re:MASTER score page", () => {
    expect(() =>
      ingestPayloadSchema.parse({
        playerHtml: html,
        scorePages: [{ difficulty: 4, html }],
        detailPages: [{ idx: "remaster", html }],
      }),
    ).not.toThrow();
  });

  it("accepts a single Re:MASTER catalog page", () => {
    expect(() =>
      catalogPayloadSchema.parse({
        scorePages: [{ difficulty: 4, html, version: 25, versionName: "CiRCLE" }],
      }),
    ).not.toThrow();
  });

  it("accepts the full version catalog page set", () => {
    const scorePages = Array.from({ length: 26 }, (_, version) =>
      [3, 4].map((difficulty) => ({
        difficulty,
        html,
        version,
        versionName: `version-${version}`,
      })),
    ).flat();

    expect(() => catalogPayloadSchema.parse({ scorePages })).not.toThrow();
  });

  it("rejects duplicate difficulty pages", () => {
    expect(() =>
      ingestPayloadSchema.parse({
        playerHtml: html,
        scorePages: [
          { difficulty: 4, html },
          { difficulty: 4, html },
        ],
      }),
    ).toThrow(/duplicate difficulties/);
  });
});
