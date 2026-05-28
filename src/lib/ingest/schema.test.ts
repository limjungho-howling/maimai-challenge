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
        scorePages: [{ difficulty: 4, html }],
        detailPages: [{ idx: "remaster", html, jacketUrl: null }],
      }),
    ).not.toThrow();
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
