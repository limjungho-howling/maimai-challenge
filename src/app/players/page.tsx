import Link from "next/link";
import { Suspense } from "react";

import { PlayerLeaderboardSkeleton } from "@/components/leaderboard-skeletons";
import { listPlayerLeaderboard } from "@/lib/data/players";
import { formatKstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

type PlayerRankTab = "firsts" | "influence";

interface PlayersPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const params = await searchParams;
  const tab = parsePlayerRankTab(params.tab);

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

        <Suspense fallback={<PlayerLeaderboardSkeleton />} key={tab}>
          <PlayerLeaderboardContent tab={tab} />
        </Suspense>
      </div>
    </main>
  );
}

async function PlayerLeaderboardContent({ tab }: { tab: PlayerRankTab }) {
  const players = await listPlayerLeaderboard();
  const isInfluenceTab = tab === "influence";

  return (
    <>
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isInfluenceTab ? "영향력 순위" : "1등 달성 곡 수"}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {isInfluenceTab
                ? "전체 곡의 1~5등 점수를 합산해 각 유저의 비율을 계산합니다."
                : "동점 1등은 각 유저 모두 1등 곡 수에 포함됩니다."}
            </p>
          </div>
          <div className="flex rounded-lg border border-white/10 bg-white/[0.045] p-1">
            <TabLink active={!isInfluenceTab} href="/players" label="1등 달성곡 수" />
            <TabLink active={isInfluenceTab} href="/players?tab=influence" label="영향력" />
          </div>
        </section>

        {isInfluenceTab ? (
          <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
            <div className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
              <span>순위</span>
              <span>유저</span>
              <span>영향력</span>
              <span>점수</span>
              <span>최근 갱신</span>
            </div>
            {players.length === 0 ? (
              <EmptyPlayers />
            ) : (
              <div className="divide-y divide-white/10">
                {[...players]
                  .sort((left, right) => {
                    if (right.influenceScore !== left.influenceScore) {
                      return right.influenceScore - left.influenceScore;
                    }
                    if (right.firstPlaceCount !== left.firstPlaceCount) {
                      return right.firstPlaceCount - left.firstPlaceCount;
                    }
                    return left.playerName.localeCompare(right.playerName);
                  })
                  .map((player) => (
                    <div
                      className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 px-4 py-4 max-md:grid-cols-2"
                      key={player.profileId}
                    >
                      <div className="font-mono text-lg text-cyan-100">
                        #{player.influenceRank}
                      </div>
                      <PlayerIdentity player={player} />
                      <div className="font-mono text-sm text-slate-100">
                        {player.influencePercent.toFixed(2)}%
                      </div>
                      <div className="font-mono text-sm text-slate-100">
                        {player.influenceScore.toLocaleString("ko-KR")}점
                      </div>
                      <UpdatedAt value={player.latestUpdatedAt} />
                    </div>
                  ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
          <div className="grid grid-cols-[80px_1fr_140px_180px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
            <span>순위</span>
            <span>유저</span>
            <span>1등 곡</span>
            <span>최근 갱신</span>
          </div>
          {players.length === 0 ? (
            <EmptyPlayers />
          ) : (
            <div className="divide-y divide-white/10">
              {players.map((player) => (
                <Link
                  className="grid grid-cols-[80px_1fr_140px_180px] gap-3 px-4 py-4 transition hover:bg-white/8 max-md:grid-cols-2"
                  href={`/?leader=${encodeURIComponent(player.profileId)}`}
                  key={player.profileId}
                >
                  <div className="font-mono text-lg text-cyan-100">#{player.rank}</div>
                  <PlayerIdentity player={player} />
                  <div className="font-mono text-sm text-slate-100">
                    {player.firstPlaceCount.toLocaleString("ko-KR")}곡
                  </div>
                  <UpdatedAt value={player.latestUpdatedAt} />
                </Link>
              ))}
            </div>
          )}
        </section>
          </>
        )}
    </>
  );
}

function TabLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        active
          ? "bg-cyan-300 text-slate-950"
          : "text-slate-200 hover:bg-white/10"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}

function PlayerIdentity({
  player,
}: {
  player: Awaited<ReturnType<typeof listPlayerLeaderboard>>[number];
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-white">{player.playerName}</div>
      <div className="mt-1 text-xs text-slate-400">
        {player.discordUsername ?? "Discord 연결됨"}
        {player.maimaiRating === null
          ? ""
          : ` · rating ${player.maimaiRating.toLocaleString("ko-KR")}`}
      </div>
    </div>
  );
}

function UpdatedAt({ value }: { value: string | null }) {
  return (
    <div className="text-xs text-slate-400">
      {value ? formatKstDateTime(value) : "-"}
    </div>
  );
}

function EmptyPlayers() {
  return (
    <div className="px-4 py-16 text-center text-sm text-slate-300">
      아직 등록된 유저가 없습니다.
    </div>
  );
}

function parsePlayerRankTab(value: string | undefined): PlayerRankTab {
  return value === "influence" ? "influence" : "firsts";
}
