"use client";

import Image from "next/image";
import Link from "next/link";
import { Dices, ShieldCheck } from "lucide-react";

import { ChartDifficultyImage, ChartKindImage } from "@/components/chart-type-images";
import type { RandomPoolChart } from "@/lib/random/pool";

export type DrawPhase = "idle" | "waiting" | "spinning" | "result";
export type DrawMode = "quick" | "verified";

export interface RandomDrawStageProps {
  chart: RandomPoolChart | null;
  frameKey: number;
  isLoggedIn: boolean;
  mode: DrawMode;
  onDraw: () => void;
  onModeChange: (mode: DrawMode) => void;
  phase: DrawPhase;
  poolSize: number;
}

export function RandomDrawStage({
  chart,
  frameKey,
  isLoggedIn,
  mode,
  onDraw,
  onModeChange,
  phase,
  poolSize,
}: RandomDrawStageProps) {
  const isBusy = phase === "spinning" || phase === "waiting";
  const isResult = phase === "result";
  const isVerified = mode === "verified";
  const needsLogin = isVerified && !isLoggedIn;

  return (
    <section className="flex flex-col items-center gap-5 rounded-lg border border-white/10 bg-white/[0.045] px-4 py-8">
      <div
        aria-label="선곡 방식"
        className="flex rounded-md border border-white/10 bg-slate-950/60 p-1"
        role="group"
      >
        <ModeButton
          active={mode === "quick"}
          disabled={isBusy}
          label="빠른 모드"
          onClick={() => onModeChange("quick")}
        />
        <ModeButton
          active={isVerified}
          disabled={isBusy}
          label="검증 모드"
          onClick={() => onModeChange("verified")}
        />
      </div>

      <p aria-live="polite" className="text-center text-sm font-medium text-cyan-200">
        {phase === "waiting"
          ? "추첨 난수가 공개되기를 기다리는 중…"
          : phase === "spinning"
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
              isBusy ? "random-draw-flick" : isResult ? "random-draw-land" : ""
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

      {needsLogin ? (
        <Link
          className="inline-flex h-12 items-center gap-2 rounded-md bg-cyan-300 px-8 text-base font-semibold text-slate-950 transition hover:bg-cyan-200"
          href="/auth/login?next=/random"
        >
          <ShieldCheck className="h-5 w-5" aria-hidden />
          Discord로 로그인
        </Link>
      ) : (
        <button
          className="inline-flex h-12 items-center gap-2 rounded-md bg-cyan-300 px-8 text-base font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:bg-white/10 disabled:text-slate-500"
          disabled={isBusy || poolSize === 0}
          onClick={onDraw}
          type="button"
        >
          {isVerified ? (
            <ShieldCheck className="h-5 w-5" aria-hidden />
          ) : (
            <Dices className="h-5 w-5" aria-hidden />
          )}
          {isBusy ? "선곡 중…" : isVerified ? "검증 선곡" : "랜덤 선곡"}
        </button>
      )}

      <p className="text-center text-xs text-slate-400">
        {poolSize === 0
          ? "풀에 남은 곡이 없습니다. 곡을 추가하거나 초기화하세요."
          : `남은 후보 ${poolSize}곡`}
      </p>

      <p className="max-w-md text-center text-xs text-slate-500">
        {needsLogin
          ? "검증 선곡은 추첨자를 기록에 남기기 때문에 Discord 로그인이 필요합니다."
          : isVerified
            ? "추첨 전에 풀을 고정하고, 아직 존재하지 않는 외부 난수로 결과를 정합니다. 누구나 나중에 결과를 다시 계산해 검증할 수 있습니다."
            : "결과가 기록되지 않습니다. 혼자 연습할 때 쓰세요. 다른 사람에게 결과를 보여야 한다면 검증 선곡을 쓰세요."}
      </p>
    </section>
  );
}

function ModeButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        active
          ? "bg-cyan-300 text-slate-950"
          : "text-slate-300 hover:bg-white/10"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
