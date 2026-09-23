"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";

import type { RandomDrawRecord } from "@/lib/data/draws";
import { drandRoundUrl } from "@/lib/random/drand";

export interface RandomVerifiedPanelProps {
  draw: RandomDrawRecord | null;
  earlierDrawCount: number;
  error: string | null;
  isRevealing: boolean;
  onRetryReveal: () => void;
}

export function RandomVerifiedPanel({
  draw,
  earlierDrawCount,
  error,
  isRevealing,
  onRetryReveal,
}: RandomVerifiedPanelProps) {
  if (!draw && !error) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <h2 className="text-lg font-semibold text-white">검증 기록</h2>

      {error ? (
        <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {earlierDrawCount > 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            같은 풀로 이미 {earlierDrawCount}번 추첨한 기록이 있습니다. 이번이{" "}
            {earlierDrawCount + 1}번째입니다.
          </span>
        </p>
      ) : null}

      {draw ? (
        <>
          <dl className="grid gap-2 text-xs sm:grid-cols-[104px_1fr]">
            <dt className="text-slate-400">기록</dt>
            <dd>
              <Link
                className="inline-flex items-center gap-1 font-mono text-cyan-200 hover:text-cyan-100"
                href={`/random/draws/${draw.id}`}
              >
                {draw.id}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </dd>

            <dt className="text-slate-400">풀 해시</dt>
            <dd className="font-mono break-all text-slate-300">{draw.poolHash}</dd>

            <dt className="text-slate-400">drand 라운드</dt>
            <dd>
              <a
                className="inline-flex items-center gap-1 font-mono text-cyan-200 hover:text-cyan-100"
                href={drandRoundUrl(draw.beaconRound)}
                rel="noreferrer noopener"
                target="_blank"
              >
                {draw.beaconRound}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </dd>

            {draw.beaconRandomness ? (
              <>
                <dt className="text-slate-400">난수</dt>
                <dd className="font-mono break-all text-slate-300">
                  {draw.beaconRandomness}
                </dd>
              </>
            ) : null}
          </dl>

          {draw.revealedAt ? (
            <p className="text-xs text-slate-400">
              추첨 링크를 공유하면 누구나 결과를 직접 다시 계산해 볼 수 있습니다.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-amber-200">
                아직 결과가 공개되지 않았습니다. 이 기록은 그대로 남아 있으니 다시
                공개를 시도하세요. 새로 추첨하면 별도 기록으로 남습니다.
              </p>
              <button
                className="rounded-md border border-cyan-300/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10 disabled:border-white/10 disabled:text-slate-500"
                disabled={isRevealing}
                onClick={onRetryReveal}
                type="button"
              >
                {isRevealing ? "공개 중…" : "결과 다시 공개"}
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
