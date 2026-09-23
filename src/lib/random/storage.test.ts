import { describe, expect, it } from "vitest";

import { MAX_POOL_SIZE, type RandomPoolChart } from "@/lib/random/pool";
import { parseStoredState } from "@/lib/random/storage";

function chart(chartId: string): RandomPoolChart {
  return {
    chartId,
    title: `song ${chartId}`,
    jacketUrl: "https://example.com/jacket.png",
    kind: "STANDARD",
    difficulty: 4,
    level: "14+",
    versionName: "FESTiVAL",
  };
}

describe("parseStoredState", () => {
  it("round-trips a stored state", () => {
    const state = { pool: [chart("a"), chart("b")], drawn: [chart("c")] };

    expect(parseStoredState(JSON.stringify(state))).toEqual(state);
  });

  it("returns an empty state for missing storage", () => {
    expect(parseStoredState(null)).toEqual({ pool: [], drawn: [] });
  });

  it("returns an empty state for broken JSON", () => {
    expect(parseStoredState("{not json")).toEqual({ pool: [], drawn: [] });
  });

  it("returns an empty state when a chart is missing required fields", () => {
    const raw = JSON.stringify({ pool: [{ chartId: "a", title: "song a" }], drawn: [] });

    expect(parseStoredState(raw)).toEqual({ pool: [], drawn: [] });
  });

  it("returns an empty state when the lists are not arrays", () => {
    expect(parseStoredState(JSON.stringify({ pool: "a", drawn: [] }))).toEqual({
      pool: [],
      drawn: [],
    });
  });

  it("returns an empty state when the stored lists exceed the pool cap", () => {
    const raw = JSON.stringify({
      pool: Array.from({ length: MAX_POOL_SIZE }, (_, index) => chart(`p${index}`)),
      drawn: [chart("over")],
    });

    expect(parseStoredState(raw)).toEqual({ pool: [], drawn: [] });
  });

  it("normalizes a missing jacket or version to null", () => {
    const raw = JSON.stringify({
      pool: [{ chartId: "a", title: "song a", kind: "DX", level: "13", difficulty: 3 }],
      drawn: [],
    });

    expect(parseStoredState(raw).pool[0]).toEqual({
      chartId: "a",
      title: "song a",
      jacketUrl: null,
      kind: "DX",
      difficulty: 3,
      level: "13",
      versionName: null,
    });
  });
});
