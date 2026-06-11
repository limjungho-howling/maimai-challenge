import { describe, expect, it } from "vitest";

import { buildWeeklyEntryUpserts, getWeeklyChallengeLevelGroup } from "@/lib/weekly/entries";

describe("weekly challenge entries", () => {
  it("matches levels to weekly challenge groups", () => {
    expect(getWeeklyChallengeLevelGroup("11+")).toBe("low");
    expect(getWeeklyChallengeLevelGroup("12")).toBe("low");
    expect(getWeeklyChallengeLevelGroup("12+")).toBe("low");
    expect(getWeeklyChallengeLevelGroup("13")).toBe("middle");
    expect(getWeeklyChallengeLevelGroup("13+")).toBe("middle");
    expect(getWeeklyChallengeLevelGroup("14")).toBeNull();
  });

  it("builds entries for weekly picks even when the submitted score is below the previous best", () => {
    const entries = buildWeeklyEntryUpserts({
      existingEntriesByPickId: new Map([
        [
          "pick-low",
          {
            dxScore: 2400,
            submittedAt: "2026-06-09T12:00:00+09:00",
          },
        ],
      ]),
      ingestRunId: "run-1",
      picksByChartId: new Map([
        [
          "chart-low",
          {
            category: "low",
            pickId: "pick-low",
            weekId: "week-1",
          },
        ],
      ]),
      profileId: "profile-1",
      submittedAt: "2026-06-10T12:00:00+09:00",
      updates: [
        {
          achievementRate: 99.1234,
          chartId: "chart-low",
          dxScore: 2380,
          maxDxScore: 2451,
        },
      ],
    });

    expect(entries).toEqual([
      {
        achievement_rate: 99.1234,
        dx_score: 2400,
        ingest_run_id: "run-1",
        max_dx_score: 2451,
        pick_id: "pick-low",
        profile_id: "profile-1",
        submitted_at: "2026-06-10T12:00:00+09:00",
        week_id: "week-1",
      },
    ]);
  });

  it("keeps the highest submitted weekly score for each pick", () => {
    const entries = buildWeeklyEntryUpserts({
      existingEntriesByPickId: new Map([
        [
          "pick-middle",
          {
            dxScore: 2300,
            submittedAt: "2026-06-09T12:00:00+09:00",
          },
        ],
      ]),
      ingestRunId: "run-2",
      picksByChartId: new Map([
        [
          "chart-middle",
          {
            category: "middle",
            pickId: "pick-middle",
            weekId: "week-1",
          },
        ],
      ]),
      profileId: "profile-1",
      submittedAt: "2026-06-10T12:00:00+09:00",
      updates: [
        {
          achievementRate: 100.1234,
          chartId: "chart-middle",
          dxScore: 2350,
          maxDxScore: 2451,
        },
      ],
    });

    expect(entries[0]?.dx_score).toBe(2350);
    expect(entries[0]?.submitted_at).toBe("2026-06-10T12:00:00+09:00");
  });

  it("uses the recent play time when building weekly entries", () => {
    const entries = buildWeeklyEntryUpserts({
      existingEntriesByPickId: new Map(),
      ingestRunId: "run-3",
      picksByChartId: new Map([
        [
          "chart-low",
          {
            category: "low",
            pickId: "pick-low",
            weekId: "week-1",
          },
        ],
      ]),
      profileId: "profile-1",
      submittedAt: "2026-06-10T12:00:00+09:00",
      updates: [
        {
          achievementRate: 100.9545,
          chartId: "chart-low",
          dxScore: 2106,
          maxDxScore: 2172,
          playedAt: "2026-06-10T01:31:00+09:00",
        },
      ],
    });

    expect(entries[0]?.submitted_at).toBe("2026-06-10T01:31:00+09:00");
  });
});
