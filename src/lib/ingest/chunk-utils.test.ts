import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "@/lib/ingest/chunk-utils";

describe("mapWithConcurrency", () => {
  it("preserves result order while limiting active work", async () => {
    let active = 0;
    let maxActive = 0;

    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return item * 10;
    });

    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
