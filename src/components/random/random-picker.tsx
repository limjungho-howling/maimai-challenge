"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { RandomDrawStage, type DrawPhase } from "@/components/random/random-draw-stage";
import { RandomDrawnList } from "@/components/random/random-drawn-list";
import { RandomPoolList } from "@/components/random/random-pool-list";
import { RandomSearchPanel } from "@/components/random/random-search-panel";
import {
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

export interface RandomPickerProps {
  levels: string[];
  versions: Array<{ number: number; name: string }>;
}

export function RandomPicker({ levels, versions }: RandomPickerProps) {
  const { pool, drawn } = useSyncExternalStore(
    subscribeRandomPoolStore,
    getRandomPoolSnapshot,
    getRandomPoolServerSnapshot,
  );
  const [phase, setPhase] = useState<DrawPhase>("idle");
  const [displayChart, setDisplayChart] = useState<RandomPoolChart | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [spin, setSpin] = useState<Spin | null>(null);

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

  const handleClearDrawn = () => {
    updateRandomPoolStore((current) => ({ ...current, drawn: [] }));

    // The result card would otherwise keep announcing a chart that is no
    // longer tracked anywhere.
    setDisplayChart(null);
    setPhase("idle");
    setSpin(null);
  };

  const handleDraw = () => {
    if (phase === "spinning") {
      return;
    }

    const winner = drawFrom(pool);
    if (!winner) {
      return;
    }

    const isReducedMotion = prefersReducedMotion();
    const sequence = isReducedMotion
      ? [winner]
      : buildSpinSequence(pool, winner);
    const delays = spinFrameDelays(
      sequence.length,
      isReducedMotion ? REDUCED_MOTION_DURATION_MS : SPIN_TOTAL_DURATION_MS,
    );

    setPhase("spinning");
    setSpin({ sequence, delays });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="flex flex-col gap-5">
        <RandomDrawStage
          chart={displayChart}
          frameKey={frameKey}
          onDraw={handleDraw}
          phase={phase}
          poolSize={pool.length}
        />
        <RandomSearchPanel
          drawnChartIds={drawnChartIds}
          isPoolFull={pool.length >= MAX_POOL_SIZE}
          levels={levels}
          onAdd={handleAdd}
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
        />
      </div>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
