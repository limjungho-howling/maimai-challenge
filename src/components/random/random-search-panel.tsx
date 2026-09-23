"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  chartAccessibleName,
  RandomChartRow,
} from "@/components/random/random-chart-row";
import {
  searchRandomPoolCharts,
  type RandomSearchResult,
} from "@/app/random/actions";
import { DIFFICULTY_LABELS, RANKING_DIFFICULTIES } from "@/lib/maimai/constants";
import type { RandomPoolChart } from "@/lib/random/pool";

const EMPTY_RESULT: RandomSearchResult = {
  charts: [],
  page: 1,
  pageCount: 1,
  count: 0,
};

export interface RandomSearchPanelProps {
  drawnChartIds: Set<string>;
  isPoolFull: boolean;
  levels: string[];
  onAdd: (chart: RandomPoolChart) => void;
  poolChartIds: Set<string>;
  versions: Array<{ number: number; name: string }>;
}

export function RandomSearchPanel({
  drawnChartIds,
  isPoolFull,
  levels,
  onAdd,
  poolChartIds,
  versions,
}: RandomSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [version, setVersion] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [result, setResult] = useState<RandomSearchResult>(EMPTY_RESULT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Server Functions resolve out of order when the user searches again before
  // the previous call lands, so only the newest request may touch state.
  const requestIdRef = useRef(0);

  const runSearch = (page: number) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    startTransition(async () => {
      try {
        const next = await searchRandomPoolCharts({
          q: query,
          level,
          version: version === "" ? null : Number(version),
          difficulty: difficulty === "" ? null : Number(difficulty),
          page,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setResult(next);
        setError(null);
      } catch {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setError("곡을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  // Fills the panel on first paint with the default (unfiltered) first page.
  // Later searches are driven by the form, so this must not re-run.
  useEffect(() => {
    runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <h2 className="text-lg font-semibold text-white">곡 검색</h2>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(1);
        }}
      >
        <label className="min-w-0 sm:col-span-2">
          <span className="sr-only">곡 이름 검색</span>
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
            maxLength={100}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="곡 이름 검색"
            type="search"
            value={query}
          />
        </label>
        <label>
          <span className="sr-only">레벨 필터</span>
          <select
            className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300"
            onChange={(event) => setLevel(event.currentTarget.value)}
            value={level}
          >
            <option value="">전체 레벨</option>
            {levels.map((item) => (
              <option key={item} value={item}>
                Lv {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">난이도 필터</span>
          <select
            className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300"
            onChange={(event) => setDifficulty(event.currentTarget.value)}
            value={difficulty}
          >
            <option value="">전체 난이도</option>
            {RANKING_DIFFICULTIES.map((item) => (
              <option key={item} value={item}>
                {DIFFICULTY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="sr-only">버전 필터</span>
          <select
            className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300"
            onChange={(event) => setVersion(event.currentTarget.value)}
            value={version}
          >
            <option value="">전체 버전</option>
            {versions.map((item) => (
              <option key={item.number} value={item.number}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="h-11 rounded-md bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60 sm:col-span-2"
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              검색 중
            </span>
          ) : (
            "검색"
          )}
        </button>
      </form>

      {isPoolFull ? (
        <p className="text-xs text-amber-300">
          풀이 가득 찼습니다. 곡을 빼야 더 담을 수 있습니다.
        </p>
      ) : null}

      <div
        aria-busy={isPending}
        className="overflow-hidden rounded-md border border-white/10 bg-slate-950/40"
      >
        {error ? (
          <p className="px-4 py-10 text-center text-sm text-rose-300">{error}</p>
        ) : result.charts.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-300">
            {isPending ? "곡을 불러오는 중입니다." : "조건에 맞는 곡이 없습니다."}
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {result.charts.map((chart) => {
              const isInPool = poolChartIds.has(chart.chartId);
              const isDrawn = drawnChartIds.has(chart.chartId);
              const isAdded = isInPool || isDrawn;

              return (
                <RandomChartRow
                  action={
                    <button
                      aria-label={`${chartAccessibleName(chart)} ${
                        isDrawn ? "이미 뽑음" : isInPool ? "추가됨" : "풀에 추가"
                      }`}
                      className="h-9 shrink-0 rounded-md border border-cyan-300/60 px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10 disabled:border-white/10 disabled:text-slate-500 disabled:hover:bg-transparent"
                      disabled={isAdded || isPoolFull}
                      onClick={() => onAdd(chart)}
                      type="button"
                    >
                      {isDrawn ? "뽑음" : isInPool ? "추가됨" : "추가"}
                    </button>
                  }
                  chart={chart}
                  key={chart.chartId}
                />
              );
            })}
          </div>
        )}
      </div>

      <nav className="flex items-center justify-center gap-3">
        <button
          className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:text-slate-500 disabled:hover:bg-transparent"
          disabled={isPending || result.page <= 1}
          onClick={() => runSearch(result.page - 1)}
          type="button"
        >
          이전
        </button>
        <span className="font-mono text-sm text-slate-300">
          {result.page} / {result.pageCount}
        </span>
        <button
          className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:text-slate-500 disabled:hover:bg-transparent"
          disabled={isPending || result.page >= result.pageCount}
          onClick={() => runSearch(result.page + 1)}
          type="button"
        >
          다음
        </button>
      </nav>
    </section>
  );
}
