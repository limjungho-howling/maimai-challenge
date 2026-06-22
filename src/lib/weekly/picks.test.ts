import { describe, expect, it } from "vitest";

import { selectWeeklyChallengeCandidate } from "@/lib/weekly/picks";

describe("weekly challenge picks", () => {
  it("excludes charts that were already selected in earlier weeks", () => {
    const selected = selectWeeklyChallengeCandidate(
      [
        {
          chart_id: "chart-used",
          level: "12+",
        },
        {
          chart_id: "chart-new",
          level: "12",
        },
        {
          chart_id: "chart-middle",
          level: "13",
        },
      ],
      {
        category: "low",
        random: () => 0,
        usedChartIds: new Set(["chart-used"]),
      },
    );

    expect(selected?.chart_id).toBe("chart-new");
  });

  it("falls back to all category candidates when every chart was already used", () => {
    const selected = selectWeeklyChallengeCandidate(
      [
        {
          chart_id: "chart-used-a",
          level: "12+",
        },
        {
          chart_id: "chart-used-b",
          level: "12",
        },
      ],
      {
        category: "low",
        random: () => 0.99,
        usedChartIds: new Set(["chart-used-a", "chart-used-b"]),
      },
    );

    expect(selected?.chart_id).toBe("chart-used-b");
  });
});
