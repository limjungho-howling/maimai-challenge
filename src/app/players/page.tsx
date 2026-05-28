import Link from "next/link";
import { Suspense } from "react";

import { PlayerLeaderboardSkeleton } from "@/components/leaderboard-skeletons";
import { listPlayerLeaderboard } from "@/lib/data/players";
import { formatKstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default function PlayersPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123042,transparent_34rem),linear-gradient(135deg,#080b12,#111827_52%,#13151b)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm font-medium text-cyan-200">maimaiDX International</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-white">
              유저 순위
            </h1>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/"
            >
              곡 랭킹
            </Link>
            <Link
              className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/dashboard"
            >
              대시보드
            </Link>
          </nav>
        </header>

        <Suspense fallback={<PlayerLeaderboardSkeleton />}>
          <PlayerLeaderboardContent />
        </Suspense>
      </div>
    </main>
  );
}

async function PlayerLeaderboardContent() {
  const players = await listPlayerLeaderboard();

  return (
    <>
        <section>
          <h2 className="text-xl font-semibold text-white">1등 달성 곡 수</h2>
          <p className="mt-1 text-sm text-slate-300">
            동점 1등은 각 유저 모두 1등 곡 수에 포함됩니다.
          </p>
        </section>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
          <div className="grid grid-cols-[80px_1fr_140px_180px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
            <span>순위</span>
            <span>유저</span>
            <span>1등 곡</span>
            <span>최근 갱신</span>
          </div>
          {players.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-300">
              아직 등록된 유저가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {players.map((player) => (
                <div
                  className="grid grid-cols-[80px_1fr_140px_180px] gap-3 px-4 py-4 max-md:grid-cols-2"
                  key={player.profileId}
                >
                  <div className="font-mono text-lg text-cyan-100">#{player.rank}</div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">
                      {player.playerName}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {player.discordUsername ?? "Discord 연결됨"}
                      {player.maimaiRating === null
                        ? ""
                        : ` · rating ${player.maimaiRating.toLocaleString("ko-KR")}`}
                    </div>
                  </div>
                  <div className="font-mono text-sm text-slate-100">
                    {player.firstPlaceCount.toLocaleString("ko-KR")}곡
                  </div>
                  <div className="text-xs text-slate-400">
                    {player.latestUpdatedAt ? formatKstDateTime(player.latestUpdatedAt) : "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
    </>
  );
}
