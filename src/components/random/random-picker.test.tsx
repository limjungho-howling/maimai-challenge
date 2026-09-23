import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RandomPicker } from "@/components/random/random-picker";
import { SPIN_TOTAL_DURATION_MS, type RandomPoolChart } from "@/lib/random/pool";
import { RANDOM_POOL_STORAGE_KEY } from "@/lib/random/storage";
import { resetRandomPoolStore } from "@/lib/random/store";

const searchRandomPoolCharts = vi.hoisted(() => vi.fn());

vi.mock("@/app/random/actions", () => ({ searchRandomPoolCharts }));

function chart(chartId: string, title: string): RandomPoolChart {
  return {
    chartId,
    title,
    jacketUrl: null,
    kind: "DX",
    difficulty: 3,
    level: "13",
    versionName: "PRiSM",
  };
}

const CHARTS = [chart("a", "Alpha"), chart("b", "Bravo"), chart("c", "Charlie")];

function renderPicker() {
  render(<RandomPicker levels={["13"]} versions={[{ number: 23, name: "PRiSM" }]} />);
  // Flush the mount-time search and the localStorage restore.
  return act(async () => {});
}

function click(name: string) {
  return act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/** Walks the whole draw animation, which runs on chained setTimeout calls. */
function runSpin() {
  return act(async () => {
    await vi.advanceTimersByTimeAsync(SPIN_TOTAL_DURATION_MS + 50);
  });
}

function poolSection() {
  return screen.getByRole("heading", { name: /선곡 풀/ }).closest("section")!;
}

function drawnSection() {
  return screen.getByRole("heading", { name: /뽑은 곡/ }).closest("section")!;
}

function titlesIn(section: HTMLElement): string[] {
  return within(section)
    .queryAllByText(/^(Alpha|Bravo|Charlie)$/)
    .map((node) => node.textContent ?? "");
}

describe("RandomPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    resetRandomPoolStore();
    searchRandomPoolCharts.mockReset();
    searchRandomPoolCharts.mockResolvedValue({
      charts: CHARTS,
      page: 1,
      pageCount: 1,
      count: CHARTS.length,
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a searched chart to the pool and marks it as added", async () => {
    await renderPicker();

    await click("Alpha DX MASTER 풀에 추가");

    expect(titlesIn(poolSection())).toEqual(["Alpha"]);
    expect(screen.getByRole("heading", { name: /선곡 풀/ })).toHaveTextContent("1 / 200");
    expect(screen.getByRole("button", { name: "Alpha DX MASTER 추가됨" })).toBeDisabled();
  });

  it("moves the drawn chart out of the pool and into the drawn list", async () => {
    await renderPicker();

    await click("Alpha DX MASTER 풀에 추가");
    await click("Bravo DX MASTER 풀에 추가");
    await click("랜덤 선곡");
    await runSpin();

    expect(titlesIn(poolSection())).toHaveLength(1);
    expect(titlesIn(drawnSection())).toHaveLength(1);
    expect(titlesIn(poolSection())).not.toEqual(titlesIn(drawnSection()));
  });

  it("never draws the same chart twice", async () => {
    await renderPicker();

    await click("Alpha DX MASTER 풀에 추가");
    await click("Bravo DX MASTER 풀에 추가");

    await click("랜덤 선곡");
    await runSpin();
    await click("랜덤 선곡");
    await runSpin();

    expect(titlesIn(drawnSection()).sort()).toEqual(["Alpha", "Bravo"]);
    expect(titlesIn(poolSection())).toEqual([]);
  });

  it("disables the draw button once the pool is empty", async () => {
    await renderPicker();

    expect(screen.getByRole("button", { name: "랜덤 선곡" })).toBeDisabled();

    await click("Alpha DX MASTER 풀에 추가");
    expect(screen.getByRole("button", { name: "랜덤 선곡" })).toBeEnabled();

    await click("랜덤 선곡");
    await runSpin();

    expect(screen.getByRole("button", { name: "랜덤 선곡" })).toBeDisabled();
    expect(
      screen.getByText("풀에 남은 곡이 없습니다. 곡을 추가하거나 초기화하세요."),
    ).toBeInTheDocument();
  });

  it("restores a drawn chart back into the pool", async () => {
    await renderPicker();

    await click("Alpha DX MASTER 풀에 추가");
    await click("랜덤 선곡");
    await runSpin();
    await click("Alpha DX MASTER 풀로 되돌리기");

    expect(titlesIn(poolSection())).toEqual(["Alpha"]);
    expect(titlesIn(drawnSection())).toEqual([]);
  });

  it("restores the pool from localStorage on mount", async () => {
    window.localStorage.setItem(
      RANDOM_POOL_STORAGE_KEY,
      JSON.stringify({ pool: [chart("a", "Alpha")], drawn: [chart("b", "Bravo")] }),
    );

    await renderPicker();

    expect(titlesIn(poolSection())).toEqual(["Alpha"]);
    expect(titlesIn(drawnSection())).toEqual(["Bravo"]);
  });

  it("persists the pool to localStorage", async () => {
    await renderPicker();

    await click("Charlie DX MASTER 풀에 추가");

    const stored = JSON.parse(
      window.localStorage.getItem(RANDOM_POOL_STORAGE_KEY) ?? "null",
    );
    expect(stored.pool).toHaveLength(1);
    expect(stored.pool[0].title).toBe("Charlie");
  });
});
