import Link from "next/link";

import { listRandomDraws } from "@/lib/data/draws";
import { formatKstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "검증 선곡 기록 | maimai Challenge",
};

export default async function RandomDrawsPage() {
  const draws = await listRandomDraws();
  const drawCountByPoolHash = new Map<string, number>();
  for (const draw of draws) {
    drawCountByPoolHash.set(
      draw.poolHash,
      (drawCountByPoolHash.get(draw.poolHash) ?? 0) + 1,
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123042,transparent_34rem),linear-gradient(135deg,#080b12,#111827_52%,#13151b)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm font-medium text-cyan-200">maimaiDX International</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-white">
              검증 선곡 기록
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              검증 선곡으로 진행한 모든 추첨이 시도 순서 그대로 남습니다. 같은 풀로
              여러 번 돌린 기록도 지워지지 않으므로, 재시도 여부를 누구나 확인할 수
              있습니다. 빠른 선곡은 기록되지 않습니다.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/"
            >
              곡 랭킹
            </Link>
            <Link
              className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/random"
            >
              랜덤 선곡
            </Link>
          </nav>
        </header>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
          {draws.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-slate-300">
              아직 검증 선곡 기록이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {draws.map((draw) => (
                <li key={draw.id}>
                  <Link
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-white/8"
                    href={`/random/draws/${draw.id}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        {draw.winnerTitle ?? "공개 대기 중"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {draw.drawerName} · 후보 {draw.poolSize}곡 · drand 라운드{" "}
                        {draw.beaconRound} · {formatKstDateTime(draw.committedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(drawCountByPoolHash.get(draw.poolHash) ?? 0) > 1 ? (
                        <span className="rounded-md bg-amber-400/15 px-2 py-1 text-xs text-amber-200 ring-1 ring-amber-400/30">
                          같은 풀 {drawCountByPoolHash.get(draw.poolHash)}회
                        </span>
                      ) : null}
                      <span
                        className={`rounded-md px-2 py-1 text-xs ring-1 ${
                          draw.revealedAt
                            ? "bg-cyan-300/10 text-cyan-200 ring-cyan-300/30"
                            : "bg-white/5 text-slate-300 ring-white/15"
                        }`}
                      >
                        {draw.revealedAt ? "공개됨" : "미공개"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
