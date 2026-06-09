import Link from "next/link";
import { Suspense } from "react";

import { PlayerSharePieChart } from "@/components/influence-pie-chart";
import { PlayerLeaderboardSkeleton } from "@/components/leaderboard-skeletons";
import {
  listChallengeMonthOptions,
  listPlayerLeaderboard,
  normalizeChallengeMonth,
} from "@/lib/data/players";
import { formatKstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

type PlayerRankTab =
  | "five-stars"
  | "firsts"
  | "influence"
  | "monthly-challenge-points"
  | "monthly-challenges";

interface PlayersPageProps {
  searchParams: Promise<{ month?: string; tab?: string }>;
}

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const params = await searchParams;
  const tab = parsePlayerRankTab(params.tab);
  const selectedMonth = normalizeChallengeMonth(params.month);

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

        <Suspense fallback={<PlayerLeaderboardSkeleton />} key={`${tab}:${selectedMonth}`}>
          <PlayerLeaderboardContent selectedMonth={selectedMonth} tab={tab} />
        </Suspense>
      </div>
    </main>
  );
}

async function PlayerLeaderboardContent({
  selectedMonth,
  tab,
}: {
  selectedMonth: string;
  tab: PlayerRankTab;
}) {
  const players = await listPlayerLeaderboard(selectedMonth);
  const monthOptions = listChallengeMonthOptions();
  const isFiveStarTab = tab === "five-stars";
  const isInfluenceTab = tab === "influence";
  const isMonthlyChallengePointTab = tab === "monthly-challenge-points";
  const isMonthlyChallengeTab = tab === "monthly-challenges";
  const usesMonthFilter = isMonthlyChallengeTab || isMonthlyChallengePointTab;
  const firstPlaceTotal = players.reduce(
    (sum, player) => sum + player.firstPlaceCount,
    0,
  );

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {isMonthlyChallengePointTab
              ? "월별 등수 상승 정도"
              : isMonthlyChallengeTab
              ? "월별 도전장 전송 개수"
              : isFiveStarTab
                ? "5성 개수"
              : isInfluenceTab
                ? "영향력 순위"
                : "1등 달성 곡 수"}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {isMonthlyChallengePointTab
              ? "월별 등수 상승 폭을 합산합니다. 한 곡에서 10위에서 3위로 상승하면 7점으로 계산합니다."
              : isMonthlyChallengeTab
              ? "전체-도전장-로그 채널에 성공적으로 발송된 등수 상승 로그 수로 순위를 계산합니다."
              : isFiveStarTab
                ? "최대 DX 스코어의 97% 이상을 달성한 5성 차트 수로 순위를 계산합니다."
              : isInfluenceTab
                ? "전체 곡의 1~5등 점수를 합산해 각 유저의 비율을 계산합니다."
                : "동점 1등은 각 유저 모두 1등 곡 수에 포함됩니다."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {usesMonthFilter ? (
            <form action="/players" className="flex items-center gap-2">
              <input name="tab" type="hidden" value={tab} />
              <select
                className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
                defaultValue={selectedMonth}
                name="month"
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <button className="h-10 rounded-md border border-white/15 px-3 text-sm text-slate-100 hover:bg-white/10">
                조회
              </button>
            </form>
          ) : null}
          <div className="flex flex-wrap rounded-lg border border-white/10 bg-white/[0.045] p-1">
            <TabLink
              active={!isFiveStarTab && !isInfluenceTab && !usesMonthFilter}
              href="/players"
              label="1등 달성곡 수"
            />
            <TabLink active={isInfluenceTab} href="/players?tab=influence" label="영향력" />
            <TabLink active={isFiveStarTab} href="/players?tab=five-stars" label="5성 개수" />
            <TabLink
              active={isMonthlyChallengeTab}
              href={`/players?tab=monthly-challenges&month=${selectedMonth}`}
              label="월별 도전장"
            />
            <TabLink
              active={isMonthlyChallengePointTab}
              href={`/players?tab=monthly-challenge-points&month=${selectedMonth}`}
              label="월별 상승 정도"
            />
          </div>
        </div>
      </section>

      {isFiveStarTab ? (
        <>
          <PlayerSharePieChart
            emptyMessage="5성 달성 기록이 있는 유저가 아직 없습니다."
            players={players.map((player) => ({
              profileId: player.profileId,
              playerName: player.playerName,
              percent: player.fiveStarPercent,
              value: player.fiveStarCount,
            }))}
            unit="개"
          />
          <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
            <div className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
              <span>순위</span>
              <span>유저</span>
              <span>5성</span>
              <span>비율</span>
              <span>최근 갱신</span>
            </div>
            {players.length === 0 ? (
              <EmptyPlayers />
            ) : (
              <div className="divide-y divide-white/10">
                {[...players]
                  .sort((left, right) => {
                    if (right.fiveStarCount !== left.fiveStarCount) {
                      return right.fiveStarCount - left.fiveStarCount;
                    }
                    return left.playerName.localeCompare(right.playerName);
                  })
                  .map((player) => (
                    <div
                      className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 px-4 py-4 max-md:grid-cols-2"
                      key={player.profileId}
                    >
                      <div className="font-mono text-lg text-cyan-100">
                        #{player.fiveStarRank}
                      </div>
                      <PlayerIdentity player={player} />
                      <div className="font-mono text-sm text-slate-100">
                        {player.fiveStarCount.toLocaleString("ko-KR")}개
                      </div>
                      <div className="font-mono text-sm text-slate-100">
                        {player.fiveStarPercent.toFixed(2)}%
                      </div>
                      <UpdatedAt value={player.latestUpdatedAt} />
                    </div>
                  ))}
              </div>
            )}
          </section>
        </>
      ) : isMonthlyChallengePointTab ? (
        <>
          <PlayerSharePieChart
            emptyMessage="선택한 달에 등수 상승 기록이 아직 없습니다."
            players={players.map((player) => ({
              profileId: player.profileId,
              playerName: player.playerName,
              percent: player.monthlyChallengePointPercent,
              value: player.monthlyChallengePoints,
            }))}
            unit="점"
          />
          <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
            <div className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
              <span>순위</span>
              <span>유저</span>
              <span>상승 정도</span>
              <span>비율</span>
              <span>최근 갱신</span>
            </div>
            {players.length === 0 ? (
              <EmptyPlayers />
            ) : (
              <div className="divide-y divide-white/10">
                {[...players]
                  .sort((left, right) => {
                    if (right.monthlyChallengePoints !== left.monthlyChallengePoints) {
                      return right.monthlyChallengePoints - left.monthlyChallengePoints;
                    }
                    return left.playerName.localeCompare(right.playerName);
                  })
                  .map((player) => (
                    <div
                      className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 px-4 py-4 max-md:grid-cols-2"
                      key={player.profileId}
                    >
                      <div className="font-mono text-lg text-cyan-100">
                        #{player.monthlyChallengePointRank}
                      </div>
                      <PlayerIdentity player={player} />
                      <div className="font-mono text-sm text-slate-100">
                        {player.monthlyChallengePoints.toLocaleString("ko-KR")}점
                      </div>
                      <div className="font-mono text-sm text-slate-100">
                        {player.monthlyChallengePointPercent.toFixed(2)}%
                      </div>
                      <UpdatedAt value={player.latestUpdatedAt} />
                    </div>
                  ))}
              </div>
            )}
          </section>
        </>
      ) : isMonthlyChallengeTab ? (
        <>
          <PlayerSharePieChart
            emptyMessage="선택한 달에 전송된 도전장 로그가 아직 없습니다."
            players={players.map((player) => ({
              profileId: player.profileId,
              playerName: player.playerName,
              percent: player.monthlyChallengePercent,
              value: player.monthlyChallengeCount,
            }))}
            unit="건"
          />
          <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
            <div className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
              <span>순위</span>
              <span>유저</span>
              <span>전송 수</span>
              <span>비율</span>
              <span>최근 갱신</span>
            </div>
            {players.length === 0 ? (
              <EmptyPlayers />
            ) : (
              <div className="divide-y divide-white/10">
                {[...players]
                  .sort((left, right) => {
                    if (right.monthlyChallengeCount !== left.monthlyChallengeCount) {
                      return right.monthlyChallengeCount - left.monthlyChallengeCount;
                    }
                    return left.playerName.localeCompare(right.playerName);
                  })
                  .map((player) => (
                    <div
                      className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 px-4 py-4 max-md:grid-cols-2"
                      key={player.profileId}
                    >
                      <div className="font-mono text-lg text-cyan-100">
                        #{player.monthlyChallengeRank}
                      </div>
                      <PlayerIdentity player={player} />
                      <div className="font-mono text-sm text-slate-100">
                        {player.monthlyChallengeCount.toLocaleString("ko-KR")}건
                      </div>
                      <div className="font-mono text-sm text-slate-100">
                        {player.monthlyChallengePercent.toFixed(2)}%
                      </div>
                      <UpdatedAt value={player.latestUpdatedAt} />
                    </div>
                  ))}
              </div>
            )}
          </section>
        </>
      ) : isInfluenceTab ? (
        <>
          <PlayerSharePieChart
            emptyMessage="영향력 점수가 있는 유저가 아직 없습니다."
            players={players.map((player) => ({
              profileId: player.profileId,
              playerName: player.playerName,
              percent: player.influencePercent,
              value: player.influenceScore,
            }))}
            unit="점"
          />
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
        </>
      ) : (
        <>
          <PlayerSharePieChart
            emptyMessage="1등 달성곡이 있는 유저가 아직 없습니다."
            players={players.map((player) => ({
              profileId: player.profileId,
              playerName: player.playerName,
              percent:
                firstPlaceTotal > 0
                  ? (player.firstPlaceCount / firstPlaceTotal) * 100
                  : 0,
              value: player.firstPlaceCount,
            }))}
            unit="곡"
          />
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
  if (
    value === "five-stars" ||
    value === "influence" ||
    value === "monthly-challenge-points" ||
    value === "monthly-challenges"
  ) {
    return value;
  }

  return "firsts";
}
