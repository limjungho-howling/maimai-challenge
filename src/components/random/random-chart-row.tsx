"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { ChartDifficultyImage, ChartKindImage } from "@/components/chart-type-images";
import { DIFFICULTY_LABELS, isDifficulty } from "@/lib/maimai/constants";
import type { RandomPoolChart } from "@/lib/random/pool";

/**
 * The same song appears once per kind and difficulty, so a button labelled with
 * the title alone is ambiguous to a screen reader.
 */
export function chartAccessibleName(chart: RandomPoolChart): string {
  const difficultyLabel = isDifficulty(chart.difficulty)
    ? DIFFICULTY_LABELS[chart.difficulty]
    : `난이도 ${chart.difficulty}`;

  return `${chart.title} ${chart.kind} ${difficultyLabel}`;
}

export function RandomChartRow({
  action,
  chart,
  leading,
}: {
  action?: ReactNode;
  chart: RandomPoolChart;
  leading?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {leading}
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/8">
        {chart.jacketUrl ? (
          <Image
            alt=""
            className="h-full w-full object-cover"
            height={44}
            loading="lazy"
            src={chart.jacketUrl}
            unoptimized
            width={44}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-sm font-medium text-white">
            {chart.title}
          </span>
          <ChartDifficultyImage difficulty={chart.difficulty} />
          <ChartKindImage kind={chart.kind} />
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Lv {chart.level}
          {chart.versionName ? ` · ${chart.versionName}` : ""}
        </div>
      </div>
      {action}
    </div>
  );
}
