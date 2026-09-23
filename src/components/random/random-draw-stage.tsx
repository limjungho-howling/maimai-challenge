"use client";

import Image from "next/image";
import { Dices } from "lucide-react";

import { ChartDifficultyImage, ChartKindImage } from "@/components/chart-type-images";
import type { RandomPoolChart } from "@/lib/random/pool";

export type DrawPhase = "idle" | "spinning" | "result";

export interface RandomDrawStageProps {
  chart: RandomPoolChart | null;
  frameKey: number;
  onDraw: () => void;
  phase: DrawPhase;
  poolSize: number;
}

export function RandomDrawStage({
  chart,
  frameKey,
  onDraw,
  phase,
  poolSize,
}: RandomDrawStageProps) {
  const isSpinning = phase === "spinning";
  const isResult = phase === "result";

  return (
    <section className="flex flex-col items-center gap-5 rounded-lg border border-white/10 bg-white/[0.045] px-4 py-8">
      <p
        aria-live="polite"
        className="text-sm font-medium text-cyan-200"
      >
        {isSpinning
          ? "선곡 중…"
          : isResult
            ? `선정된 곡: ${chart?.title ?? ""}`
            : "풀에 곡을 담고 선곡 버튼을 누르세요"}
      </p>

      <div
        className={`w-full max-w-md rounded-xl border p-5 transition-colors ${
          isResult
            ? "border-cyan-300/70 bg-cyan-300/8 shadow-[0_0_38px_-14px_#67e8f9]"
            : "border-white/10 bg-slate-950/50"
        }`}
        key={`${frameKey}:${chart?.chartId ?? "empty"}`}
      >
        {chart ? (
          <div
            className={`flex flex-col items-center gap-4 ${
              isSpinning ? "random-draw-flick" : isResult ? "random-draw-land" : ""
            }`}
          >
            <div className="h-36 w-36 overflow-hidden rounded-lg border border-white/10 bg-white/8">
              {chart.jacketUrl ? (
                <Image
                  alt=""
                  className="h-full w-full object-cover"
                  height={144}
                  src={chart.jacketUrl}
                  unoptimized
                  width={144}
                />
              ) : null}
            </div>
            <div className="flex w-full flex-col items-center gap-2">
              <span className="text-center text-lg font-semibold text-white">
                {chart.title}
              </span>
              <div className="flex items-center gap-2">
                <ChartDifficultyImage difficulty={chart.difficulty} />
                <ChartKindImage kind={chart.kind} />
              </div>
              <span className="text-xs text-slate-400">
                Lv {chart.level}
                {chart.versionName ? ` · ${chart.versionName}` : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center text-sm text-slate-400">
            아직 뽑은 곡이 없습니다.
          </div>
        )}
      </div>

      <button
        className="inline-flex h-12 items-center gap-2 rounded-md bg-cyan-300 px-8 text-base font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:bg-white/10 disabled:text-slate-500"
        disabled={isSpinning || poolSize === 0}
        onClick={onDraw}
        type="button"
      >
        <Dices className="h-5 w-5" aria-hidden />
        {isSpinning ? "선곡 중…" : "랜덤 선곡"}
      </button>

      <p className="text-xs text-slate-400">
        {poolSize === 0
          ? "풀에 남은 곡이 없습니다. 곡을 추가하거나 초기화하세요."
          : `남은 후보 ${poolSize}곡`}
      </p>
    </section>
  );
}
