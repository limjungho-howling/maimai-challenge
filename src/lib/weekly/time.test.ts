import { describe, expect, it } from "vitest";

import {
  formatWeeklyChallengeLabel,
  getCurrentWeeklyChallengeWindow,
  getWeeklyChallengeWindowByKey,
} from "@/lib/weekly/time";

describe("weekly challenge time windows", () => {
  it("starts the first challenge on 2026-06-08 07:00 KST and ends on 2026-06-15 04:00 KST", () => {
    const beforeStart = getCurrentWeeklyChallengeWindow(
      new Date("2026-06-07T21:59:59.000Z"),
    );
    const atStart = getCurrentWeeklyChallengeWindow(
      new Date("2026-06-07T22:00:00.000Z"),
    );
    const atEndBoundary = getCurrentWeeklyChallengeWindow(
      new Date("2026-06-14T19:00:00.000Z"),
    );

    expect(beforeStart).toBeNull();
    expect(atStart).toEqual({
      endsAt: "2026-06-15T04:00:00+09:00",
      key: "2026-06-08",
      label: "2026년 6월 2주차",
      startsAt: "2026-06-08T07:00:00+09:00",
    });
    expect(atEndBoundary).toBeNull();
  });

  it("does not create a new challenge during the Monday 04:00-07:00 KST gap", () => {
    const gap = getCurrentWeeklyChallengeWindow(
      new Date("2026-06-14T20:30:00.000Z"),
    );
    const nextStart = getCurrentWeeklyChallengeWindow(
      new Date("2026-06-14T22:00:00.000Z"),
    );

    expect(gap).toBeNull();
    expect(nextStart?.key).toBe("2026-06-15");
    expect(nextStart?.startsAt).toBe("2026-06-15T07:00:00+09:00");
    expect(nextStart?.endsAt).toBe("2026-06-22T04:00:00+09:00");
  });

  it("formats week labels by month and week-of-month in KST", () => {
    expect(formatWeeklyChallengeLabel("2026-06-08")).toBe("2026년 6월 2주차");
    expect(formatWeeklyChallengeLabel("2026-06-29")).toBe("2026년 7월 1주차");
    expect(formatWeeklyChallengeLabel("2026-07-06")).toBe("2026년 7월 2주차");
  });

  it("reconstructs stored weekly windows by key", () => {
    expect(getWeeklyChallengeWindowByKey("2026-07-06")).toEqual({
      endsAt: "2026-07-13T04:00:00+09:00",
      key: "2026-07-06",
      label: "2026년 7월 2주차",
      startsAt: "2026-07-06T07:00:00+09:00",
    });
  });

  it("ends the 2026-09-07 transition week at Monday 01:00 KST while keeping its start", () => {
    const active = getCurrentWeeklyChallengeWindow(
      new Date("2026-09-13T15:59:59.000Z"),
    );
    const atEndBoundary = getCurrentWeeklyChallengeWindow(
      new Date("2026-09-13T16:00:00.000Z"),
    );

    expect(active).toEqual({
      endsAt: "2026-09-14T01:00:00+09:00",
      key: "2026-09-07",
      label: "2026년 9월 2주차",
      startsAt: "2026-09-07T07:00:00+09:00",
    });
    expect(atEndBoundary).toBeNull();
  });

  it("does not create a new challenge during the Monday 01:00-02:00 KST gap", () => {
    expect(
      getCurrentWeeklyChallengeWindow(new Date("2026-09-13T16:30:00.000Z")),
    ).toBeNull();
  });

  it("starts weeks at Monday 02:00 KST and ends them at Monday 01:00 KST from 2026-09-14", () => {
    const firstNewWeek = getCurrentWeeklyChallengeWindow(
      new Date("2026-09-13T17:00:00.000Z"),
    );
    const followingWeek = getCurrentWeeklyChallengeWindow(
      new Date("2026-09-20T17:00:00.000Z"),
    );

    expect(firstNewWeek).toEqual({
      endsAt: "2026-09-21T01:00:00+09:00",
      key: "2026-09-14",
      label: "2026년 9월 3주차",
      startsAt: "2026-09-14T02:00:00+09:00",
    });
    expect(followingWeek).toEqual({
      endsAt: "2026-09-28T01:00:00+09:00",
      key: "2026-09-21",
      label: "2026년 9월 4주차",
      startsAt: "2026-09-21T02:00:00+09:00",
    });
  });

  it("keeps the new schedule for later weeks", () => {
    const laterWeek = getCurrentWeeklyChallengeWindow(
      new Date("2026-12-06T17:00:00.000Z"),
    );

    expect(laterWeek?.startsAt).toBe("2026-12-07T02:00:00+09:00");
    expect(laterWeek?.endsAt).toBe("2026-12-14T01:00:00+09:00");
  });

  it("reconstructs new-schedule windows by key", () => {
    expect(getWeeklyChallengeWindowByKey("2026-09-07")).toEqual({
      endsAt: "2026-09-14T01:00:00+09:00",
      key: "2026-09-07",
      label: "2026년 9월 2주차",
      startsAt: "2026-09-07T07:00:00+09:00",
    });
    expect(getWeeklyChallengeWindowByKey("2026-09-14")).toEqual({
      endsAt: "2026-09-21T01:00:00+09:00",
      key: "2026-09-14",
      label: "2026년 9월 3주차",
      startsAt: "2026-09-14T02:00:00+09:00",
    });
  });
});
