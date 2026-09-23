"use client";

import {
  chartAccessibleName,
  RandomChartRow,
} from "@/components/random/random-chart-row";
import { MAX_POOL_SIZE, type RandomPoolChart } from "@/lib/random/pool";

export interface RandomPoolListProps {
  onClear: () => void;
  onRemove: (chartId: string) => void;
  pool: RandomPoolChart[];
}

export function RandomPoolList({ onClear, onRemove, pool }: RandomPoolListProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">
          선곡 풀{" "}
          <span className="font-mono text-sm text-slate-400">
            {pool.length} / {MAX_POOL_SIZE}
          </span>
        </h2>
        <button
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:text-slate-500 disabled:hover:bg-transparent"
          disabled={pool.length === 0}
          onClick={onClear}
          type="button"
        >
          전체 비우기
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-white/10 bg-slate-950/40">
        {pool.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-300">
            검색 결과에서 &ldquo;추가&rdquo;를 눌러 후보를 담으세요.
          </p>
        ) : (
          <div className="max-h-96 divide-y divide-white/10 overflow-y-auto">
            {pool.map((chart) => (
              <RandomChartRow
                action={
                  <button
                    aria-label={`${chartAccessibleName(chart)} 풀에서 빼기`}
                    className="h-9 shrink-0 rounded-md border border-white/15 px-3 text-xs text-slate-200 transition hover:bg-white/10"
                    onClick={() => onRemove(chart.chartId)}
                    type="button"
                  >
                    빼기
                  </button>
                }
                chart={chart}
                key={chart.chartId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
