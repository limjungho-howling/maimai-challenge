"use client";

import {
  chartAccessibleName,
  RandomChartRow,
} from "@/components/random/random-chart-row";
import type { RandomPoolChart } from "@/lib/random/pool";

export interface RandomDrawnListProps {
  drawn: RandomPoolChart[];
  onClear: () => void;
  onRestore: (chartId: string) => void;
  onRestoreAll: () => void;
}

export function RandomDrawnList({
  drawn,
  onClear,
  onRestore,
  onRestoreAll,
}: RandomDrawnListProps) {
  const isEmpty = drawn.length === 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">
          뽑은 곡{" "}
          <span className="font-mono text-sm text-slate-400">{drawn.length}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-cyan-300/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10 disabled:border-white/10 disabled:text-slate-500 disabled:hover:bg-transparent"
            disabled={isEmpty}
            onClick={onRestoreAll}
            type="button"
          >
            전체 되돌리기
          </button>
          <button
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:text-slate-500 disabled:hover:bg-transparent"
            disabled={isEmpty}
            onClick={onClear}
            type="button"
          >
            전체 초기화
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-white/10 bg-slate-950/40">
        {drawn.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-300">
            아직 뽑은 곡이 없습니다.
          </p>
        ) : (
          <ol className="divide-y divide-white/10">
            {drawn.map((chart, index) => (
              <li key={chart.chartId}>
                <RandomChartRow
                  action={
                    <button
                      aria-label={`${chartAccessibleName(chart)} 풀로 되돌리기`}
                      className="h-9 shrink-0 rounded-md border border-white/15 px-3 text-xs text-slate-200 transition hover:bg-white/10"
                      onClick={() => onRestore(chart.chartId)}
                      type="button"
                    >
                      되돌리기
                    </button>
                  }
                  chart={chart}
                  leading={
                    <span className="w-6 shrink-0 text-center font-mono text-sm text-cyan-200">
                      {index + 1}
                    </span>
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
