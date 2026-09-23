"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  RandomDrawStage,
  type DrawMode,
  type DrawPhase,
} from "@/components/random/random-draw-stage";
import { RandomDrawnList } from "@/components/random/random-drawn-list";
import { RandomPoolList } from "@/components/random/random-pool-list";
import { RandomSearchPanel } from "@/components/random/random-search-panel";
import { RandomVerifiedPanel } from "@/components/random/random-verified-panel";
import { commitRandomDraw, revealRandomDraw } from "@/app/random/draw-actions";
import type { RandomDrawRecord } from "@/lib/data/draws";
import {
  addManyToPool,
  addToPool,
  buildSpinSequence,
  drawFrom,
  MAX_POOL_SIZE,
  REDUCED_MOTION_DURATION_MS,
  removeFromPool,
  SPIN_TOTAL_DURATION_MS,
  spinFrameDelays,
  type RandomPoolChart,
} from "@/lib/random/pool";
import {
  getRandomPoolServerSnapshot,
  getRandomPoolSnapshot,
  subscribeRandomPoolStore,
  updateRandomPoolStore,
} from "@/lib/random/store";

interface Spin {
  sequence: RandomPoolChart[];
  delays: number[];
}

/** Flicker cadence while waiting for the beacon round to be published. */
const WAITING_FRAME_MS = 110;
/** Small cushion so we do not ask drand for a round the instant it is due. */
const REVEAL_BUFFER_MS = 1200;
/** Deceleration onto an already-decided winner. */
const LANDING_FRAME_COUNT = 10;
const LANDING_DURATION_MS = 1400;

export interface RandomPickerProps {
  isLoggedIn: boolean;
  levels: string[];
  versions: Array<{ number: number; name: string }>;
}

export function RandomPicker({ isLoggedIn, levels, versions }: RandomPickerProps) {
  const { pool, drawn } = useSyncExternalStore(
    subscribeRandomPoolStore,
    getRandomPoolSnapshot,
    getRandomPoolServerSnapshot,
  );
  const [phase, setPhase] = useState<DrawPhase>("idle");
  const [displayChart, setDisplayChart] = useState<RandomPoolChart | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [spin, setSpin] = useState<Spin | null>(null);
  const [mode, setMode] = useState<DrawMode>("quick");
  const [draw, setDraw] = useState<RandomDrawRecord | null>(null);
  const [earlierDrawCount, setEarlierDrawCount] = useState(0);
  const [verifiedError, setVerifiedError] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (!spin) {
      return;
    }

    const { sequence, delays } = spin;
    const winner = sequence[sequence.length - 1];
    let index = 0;
    let timerId: ReturnType<typeof setTimeout>;

    const step = () => {
      setDisplayChart(sequence[index]);
      setFrameKey((value) => value + 1);

      if (index >= sequence.length - 1) {
        updateRandomPoolStore((current) => ({
          pool: removeFromPool(current.pool, winner.chartId),
          drawn: [...current.drawn, winner],
        }));
        setPhase("result");
        setSpin(null);
        return;
      }

      index += 1;
      timerId = setTimeout(step, delays[index]);
    };

    timerId = setTimeout(step, delays[0]);

    return () => clearTimeout(timerId);
  }, [spin]);

  // While the committed beacon round is still in the future there is no winner
  // to land on yet, so the card just keeps flicking through the pool.
  useEffect(() => {
    if (phase !== "waiting" || pool.length === 0) {
      return;
    }

    const timerId = setInterval(() => {
      setDisplayChart(pool[Math.floor(Math.random() * pool.length)]);
      setFrameKey((value) => value + 1);
    }, WAITING_FRAME_MS);

    return () => clearInterval(timerId);
  }, [phase, pool]);

  const poolChartIds = useMemo(
    () => new Set(pool.map((chart) => chart.chartId)),
    [pool],
  );
  const drawnChartIds = useMemo(
    () => new Set(drawn.map((chart) => chart.chartId)),
    [drawn],
  );

  const handleAdd = (chart: RandomPoolChart) => {
    if (drawnChartIds.has(chart.chartId)) {
      return;
    }

    updateRandomPoolStore((current) => ({
      ...current,
      pool: addToPool(current.pool, chart),
    }));
  };

  const handleAddMany = (charts: RandomPoolChart[]) => {
    updateRandomPoolStore((current) => {
      const drawnIds = new Set(current.drawn.map((item) => item.chartId));

      return {
        ...current,
        pool: addManyToPool(
          current.pool,
          charts.filter((chart) => !drawnIds.has(chart.chartId)),
        ),
      };
    });
  };

  const handleRemove = (chartId: string) => {
    updateRandomPoolStore((current) => ({
      ...current,
      pool: removeFromPool(current.pool, chartId),
    }));
  };

  const handleClearPool = () => {
    updateRandomPoolStore((current) => ({ ...current, pool: [] }));
  };

  const handleRestore = (chartId: string) => {
    updateRandomPoolStore((current) => {
      const chart = current.drawn.find((item) => item.chartId === chartId);
      if (!chart) {
        return current;
      }

      return {
        pool: addToPool(current.pool, chart),
        drawn: current.drawn.filter((item) => item.chartId !== chartId),
      };
    });

    // The result card would otherwise still announce a chart that is back in
    // the running.
    if (displayChart?.chartId === chartId) {
      setDisplayChart(null);
      setPhase("idle");
    }
  };

  const handleRestoreAll = () => {
    updateRandomPoolStore((current) => {
      const pool = addManyToPool(current.pool, current.drawn);
      const pooledIds = new Set(pool.map((item) => item.chartId));

      // Anything that did not fit stays in the drawn list rather than vanishing.
      return {
        pool,
        drawn: current.drawn.filter((item) => !pooledIds.has(item.chartId)),
      };
    });

    setDisplayChart(null);
    setPhase("idle");
    setSpin(null);
  };

  const handleClearDrawn = () => {
    updateRandomPoolStore((current) => ({ ...current, drawn: [] }));

    // The result card would otherwise keep announcing a chart that is no
    // longer tracked anywhere.
    setDisplayChart(null);
    setPhase("idle");
    setSpin(null);
  };

  const startLanding = (winner: RandomPoolChart) => {
    const isReducedMotion = prefersReducedMotion();
    const sequence = isReducedMotion
      ? [winner]
      : buildSpinSequence(pool, winner, Math.random, LANDING_FRAME_COUNT);
    const delays = spinFrameDelays(
      sequence.length,
      isReducedMotion ? REDUCED_MOTION_DURATION_MS : LANDING_DURATION_MS,
    );

    setPhase("spinning");
    setSpin({ sequence, delays });
  };

  const handleQuickDraw = () => {
    const winner = drawFrom(pool);
    if (!winner) {
      return;
    }

    const isReducedMotion = prefersReducedMotion();
    const sequence = isReducedMotion ? [winner] : buildSpinSequence(pool, winner);
    const delays = spinFrameDelays(
      sequence.length,
      isReducedMotion ? REDUCED_MOTION_DURATION_MS : SPIN_TOTAL_DURATION_MS,
    );

    setPhase("spinning");
    setSpin({ sequence, delays });
  };

  const finishReveal = (revealed: RandomDrawRecord) => {
    setDraw(revealed);

    const winner = pool.find((chart) => chart.chartId === revealed.winnerChartId);

    if (!winner) {
      setPhase("idle");
      setVerifiedError("선정된 곡이 현재 풀에 없습니다. 기록 링크에서 확인하세요.");
      return;
    }

    startLanding(winner);
  };

  const handleVerifiedDraw = async () => {
    setVerifiedError(null);
    setDraw(null);
    setEarlierDrawCount(0);
    setPhase("waiting");

    let committed: RandomDrawRecord;
    try {
      const result = await commitRandomDraw({
        chartIds: pool.map((chart) => chart.chartId),
      });
      committed = result.draw;
      setDraw(result.draw);
      setEarlierDrawCount(result.earlierDrawCount);
    } catch (error) {
      setPhase("idle");
      setVerifiedError(toMessage(error, "선곡을 기록하지 못했습니다."));
      return;
    }

    const waitMs =
      new Date(committed.beaconAvailableAt).getTime() - Date.now() + REVEAL_BUFFER_MS;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    try {
      finishReveal(await revealRandomDraw(committed.id));
    } catch (error) {
      setPhase("idle");
      setVerifiedError(toMessage(error, "결과를 공개하지 못했습니다."));
    }
  };

  const handleRetryReveal = async () => {
    if (!draw || isRevealing) {
      return;
    }

    setIsRevealing(true);
    setVerifiedError(null);

    try {
      finishReveal(await revealRandomDraw(draw.id));
    } catch (error) {
      setVerifiedError(toMessage(error, "결과를 공개하지 못했습니다."));
    } finally {
      setIsRevealing(false);
    }
  };

  const handleDraw = () => {
    if (phase === "spinning" || phase === "waiting" || pool.length === 0) {
      return;
    }

    if (mode === "verified") {
      void handleVerifiedDraw();
      return;
    }

    handleQuickDraw();
  };

  const handleModeChange = (next: DrawMode) => {
    setMode(next);
    setVerifiedError(null);

    if (next === "quick") {
      setDraw(null);
      setEarlierDrawCount(0);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="flex flex-col gap-5">
        <RandomDrawStage
          chart={displayChart}
          frameKey={frameKey}
          isLoggedIn={isLoggedIn}
          mode={mode}
          onDraw={handleDraw}
          onModeChange={handleModeChange}
          phase={phase}
          poolSize={pool.length}
        />
        {mode === "verified" ? (
          <RandomVerifiedPanel
            draw={draw}
            earlierDrawCount={earlierDrawCount}
            error={verifiedError}
            isRevealing={isRevealing}
            onRetryReveal={handleRetryReveal}
          />
        ) : null}
        <RandomSearchPanel
          drawnChartIds={drawnChartIds}
          isPoolFull={pool.length >= MAX_POOL_SIZE}
          levels={levels}
          onAdd={handleAdd}
          onAddMany={handleAddMany}
          poolChartIds={poolChartIds}
          versions={versions}
        />
      </div>
      <div className="flex flex-col gap-5">
        <RandomPoolList onClear={handleClearPool} onRemove={handleRemove} pool={pool} />
        <RandomDrawnList
          drawn={drawn}
          onClear={handleClearDrawn}
          onRestore={handleRestore}
          onRestoreAll={handleRestoreAll}
        />
      </div>
    </div>
  );
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
