import { describe, expect, it } from "vitest";

import {
  currentRoundAt,
  DRAND_GENESIS_TIME_SECONDS,
  DRAND_PERIOD_SECONDS,
  roundAvailableAtMs,
  targetRoundAt,
} from "@/lib/random/drand";

const GENESIS_MS = DRAND_GENESIS_TIME_SECONDS * 1000;

describe("currentRoundAt", () => {
  it("starts at round 1 at genesis", () => {
    expect(currentRoundAt(GENESIS_MS)).toBe(1);
  });

  it("advances one round per period", () => {
    expect(currentRoundAt(GENESIS_MS + DRAND_PERIOD_SECONDS * 1000)).toBe(2);
    expect(currentRoundAt(GENESIS_MS + DRAND_PERIOD_SECONDS * 1000 * 10)).toBe(11);
  });

  it("matches the live chain for a known round", () => {
    // Round 32442415 was published on the public quicknet chain.
    expect(currentRoundAt(roundAvailableAtMs(32442415))).toBe(32442415);
  });

  it("does not go negative before genesis", () => {
    expect(currentRoundAt(GENESIS_MS - 10_000)).toBe(0);
  });
});

describe("roundAvailableAtMs", () => {
  it("round-trips with currentRoundAt", () => {
    for (const round of [1, 2, 1000, 32442415]) {
      expect(currentRoundAt(roundAvailableAtMs(round))).toBe(round);
    }
  });
});

describe("targetRoundAt", () => {
  it("always points strictly into the future", () => {
    const now = GENESIS_MS + 5_000_000;
    expect(targetRoundAt(now)).toBeGreaterThan(currentRoundAt(now));
  });

  it("is only available after the commit moment", () => {
    const now = GENESIS_MS + 5_000_000;
    expect(roundAvailableAtMs(targetRoundAt(now))).toBeGreaterThan(now);
  });

  it("never uses an offset below one round", () => {
    const now = GENESIS_MS + 5_000_000;
    expect(targetRoundAt(now, 0)).toBe(currentRoundAt(now) + 1);
    expect(targetRoundAt(now, -5)).toBe(currentRoundAt(now) + 1);
  });
});
