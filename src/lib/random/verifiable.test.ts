import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildPoolMessage, hashPool, pickWinnerIndex } from "@/lib/random/verifiable";

const IDS = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333"];
// A real drand quicknet round: round 32442415 on chain 52db9ba7...
const RANDOMNESS = "664dd5da61646b5f7080d3d65668470993d76e172a486af62bb5ced253524e85";

describe("hashPool", () => {
  it("matches an independent SHA-256 of the joined ids", async () => {
    const expected = createHash("sha256").update(IDS.join("\n")).digest("hex");

    expect(await hashPool(IDS)).toBe(expected);
  });

  it("changes when the order changes, so the committed order is binding", async () => {
    const forward = await hashPool(IDS);
    const reversed = await hashPool([...IDS].reverse());

    expect(forward).not.toBe(reversed);
  });
});

describe("pickWinnerIndex", () => {
  it("matches an independent HMAC-SHA-256 computation", async () => {
    const digest = createHmac("sha256", Buffer.from(RANDOMNESS, "hex"))
      .update(buildPoolMessage(IDS))
      .digest("hex");
    const expected = Number(BigInt(`0x${digest}`) % BigInt(IDS.length));

    expect(await pickWinnerIndex(RANDOMNESS, IDS)).toBe(expected);
  });

  it("is deterministic for the same inputs", async () => {
    const first = await pickWinnerIndex(RANDOMNESS, IDS);
    const second = await pickWinnerIndex(RANDOMNESS, IDS);

    expect(first).toBe(second);
  });

  it("always lands inside the pool", async () => {
    for (let size = 1; size <= 40; size += 1) {
      const pool = Array.from({ length: size }, (_, index) => `chart-${index}`);
      const index = await pickWinnerIndex(RANDOMNESS, pool);

      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(size);
    }
  });

  it("spreads results across the pool for different randomness", async () => {
    const pool = Array.from({ length: 8 }, (_, index) => `chart-${index}`);
    const seen = new Set<number>();

    for (let round = 0; round < 60; round += 1) {
      const randomness = createHash("sha256").update(`round-${round}`).digest("hex");
      seen.add(await pickWinnerIndex(randomness, pool));
    }

    expect(seen.size).toBeGreaterThan(4);
  });

  it("rejects an empty pool", async () => {
    await expect(pickWinnerIndex(RANDOMNESS, [])).rejects.toThrow(/empty pool/);
  });

  it("rejects malformed randomness", async () => {
    await expect(pickWinnerIndex("not-hex", IDS)).rejects.toThrow(/hex/);
    await expect(pickWinnerIndex("abc", IDS)).rejects.toThrow(/hex/);
  });
});
