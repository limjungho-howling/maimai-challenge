import { describe, expect, it } from "vitest";

import {
  addManyToPool,
  addToPool,
  buildSpinSequence,
  drawFrom,
  MAX_POOL_SIZE,
  removeFromPool,
  spinFrameDelays,
  type RandomPoolChart,
} from "@/lib/random/pool";

function chart(chartId: string): RandomPoolChart {
  return {
    chartId,
    title: `song ${chartId}`,
    jacketUrl: null,
    kind: "DX",
    difficulty: 3,
    level: "13",
    versionName: "PRiSM",
  };
}

function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("addToPool", () => {
  it("appends a chart to the end of the pool", () => {
    expect(addToPool([chart("a")], chart("b")).map((item) => item.chartId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("ignores a chart that is already in the pool", () => {
    const pool = [chart("a"), chart("b")];
    expect(addToPool(pool, chart("a"))).toBe(pool);
  });

  it("refuses to grow past the pool size limit", () => {
    const pool = Array.from({ length: MAX_POOL_SIZE }, (_, index) =>
      chart(`c${index}`),
    );
    expect(addToPool(pool, chart("extra"))).toBe(pool);
  });
});

describe("addManyToPool", () => {
  it("appends every new chart in order", () => {
    const result = addManyToPool([chart("a")], [chart("b"), chart("c")]);
    expect(result.map((item) => item.chartId)).toEqual(["a", "b", "c"]);
  });

  it("skips charts that are already in the pool", () => {
    const result = addManyToPool([chart("a")], [chart("a"), chart("b"), chart("a")]);
    expect(result.map((item) => item.chartId)).toEqual(["a", "b"]);
  });

  it("stops at the pool size limit instead of overflowing", () => {
    const pool = Array.from({ length: MAX_POOL_SIZE - 1 }, (_, index) =>
      chart(`c${index}`),
    );
    const result = addManyToPool(pool, [chart("x"), chart("y"), chart("z")]);

    expect(result).toHaveLength(MAX_POOL_SIZE);
    expect(result[result.length - 1].chartId).toBe("x");
  });

  it("returns the original pool when there is nothing to add", () => {
    const pool = [chart("a")];
    expect(addManyToPool(pool, [])).toBe(pool);
  });
});

describe("removeFromPool", () => {
  it("removes only the matching chart", () => {
    const pool = [chart("a"), chart("b"), chart("c")];
    expect(removeFromPool(pool, "b").map((item) => item.chartId)).toEqual(["a", "c"]);
  });

  it("leaves the pool untouched when the chart is absent", () => {
    const pool = [chart("a")];
    expect(removeFromPool(pool, "zzz").map((item) => item.chartId)).toEqual(["a"]);
  });
});

describe("drawFrom", () => {
  it("returns null for an empty pool", () => {
    expect(drawFrom([])).toBeNull();
  });

  it("picks the chart at the index the random source points to", () => {
    const pool = [chart("a"), chart("b"), chart("c")];
    expect(drawFrom(pool, () => 0)?.chartId).toBe("a");
    expect(drawFrom(pool, () => 0.5)?.chartId).toBe("b");
    expect(drawFrom(pool, () => 0.99)?.chartId).toBe("c");
  });

  it("stays in range when the random source returns 1", () => {
    const pool = [chart("a"), chart("b")];
    expect(drawFrom(pool, () => 1)?.chartId).toBe("b");
  });
});

describe("buildSpinSequence", () => {
  const pool = [chart("a"), chart("b"), chart("c"), chart("d")];

  it("returns an empty sequence for an empty pool", () => {
    expect(buildSpinSequence([], chart("a"))).toEqual([]);
  });

  it("lands on the winner and only shows charts from the pool", () => {
    const sequence = buildSpinSequence(pool, chart("c"), sequenceRandom([0.1, 0.6, 0.9]));

    expect(sequence).toHaveLength(20);
    expect(sequence[sequence.length - 1].chartId).toBe("c");
    for (const frame of sequence) {
      expect(pool.some((item) => item.chartId === frame.chartId)).toBe(true);
    }
  });

  it("never repeats the same chart on consecutive frames", () => {
    const sequence = buildSpinSequence(pool, chart("a"), sequenceRandom([0, 0.3, 0.7, 0.95]));

    for (let index = 1; index < sequence.length; index += 1) {
      expect(sequence[index].chartId).not.toBe(sequence[index - 1].chartId);
    }
  });

  it("repeats the single chart when the pool has only one entry", () => {
    const sequence = buildSpinSequence([chart("solo")], chart("solo"));

    expect(sequence).toHaveLength(20);
    expect(sequence.every((frame) => frame.chartId === "solo")).toBe(true);
  });

  it("returns just the winner when a single frame is requested", () => {
    const sequence = buildSpinSequence(pool, chart("d"), Math.random, 1);
    expect(sequence.map((frame) => frame.chartId)).toEqual(["d"]);
  });
});

describe("spinFrameDelays", () => {
  it("adds up to exactly the requested duration", () => {
    const delays = spinFrameDelays(20, 3000);
    expect(delays.reduce((sum, delay) => sum + delay, 0)).toBe(3000);
  });

  it("slows down towards the end", () => {
    const delays = spinFrameDelays(20, 3000);

    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]).toBeGreaterThanOrEqual(delays[index - 1]);
    }
    expect(delays[0]).toBeGreaterThan(0);
  });

  it("returns an empty list for a non-positive frame count", () => {
    expect(spinFrameDelays(0)).toEqual([]);
  });
});
