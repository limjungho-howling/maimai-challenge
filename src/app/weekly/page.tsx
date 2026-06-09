import Image from "next/image";
import Link from "next/link";

import { ChartDifficultyImage, ChartKindImage } from "@/components/chart-type-images";
import { getWeeklyChallengeData, type WeeklyChallengePick } from "@/lib/data/weekly";
import { getDxStarImageUrl } from "@/lib/maimai/dx-stars";
import { formatKstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

interface WeeklyPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function WeeklyPage({ searchParams }: WeeklyPageProps) {
  const params = await searchParams;
  const { selectedWeek, weekOptions } = await getWeeklyChallengeData(params.week);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123042,transparent_34rem),linear-gradient(135deg,#080b12,#111827_52%,#13151b)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm font-medium text-cyan-200">maimaiDX International</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-white">
              주간 랭킹
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
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/players"
            >
              유저 순위
            </Link>
            <Link
              className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/dashboard"
            >
              데이터 갱신
            </Link>
          </nav>
        </header>

        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {selectedWeek?.label ?? "주차 없음"}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {selectedWeek
                ? `${formatKstDateTime(selectedWeek.startsAt)} ~ ${formatKstDateTime(
                    selectedWeek.endsAt,
                  )}`
                : "아직 생성된 주간 랭킹이 없습니다."}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              해당 기간에 주간 선정곡을 갱신한 기록만 랭킹에 반영됩니다.
            </p>
          </div>
          {weekOptions.length > 0 ? (
            <form action="/weekly" className="flex items-center gap-2">
              <select
                className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
                defaultValue={selectedWeek?.key}
                name="week"
              >
                {weekOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button className="h-10 rounded-md border border-white/15 px-3 text-sm text-slate-100 hover:bg-white/10">
                조회
              </button>
            </form>
          ) : null}
        </section>

        {selectedWeek ? (
          <section className="grid gap-5 lg:grid-cols-2">
            {selectedWeek.picks.map((pick) => (
              <WeeklyRankingCard key={pick.id} pick={pick} />
            ))}
          </section>
        ) : (
          <section className="rounded-lg border border-white/10 bg-white/[0.045] px-4 py-16 text-center text-sm text-slate-300">
            주간 랭킹은 2026년 6월 8일 07:00 KST부터 시작됩니다.
          </section>
        )}
      </div>
    </main>
  );
}

function WeeklyRankingCard({ pick }: { pick: WeeklyChallengePick }) {
  return (
    <article className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
      <div className="border-b border-white/10 p-4">
        <div className="flex min-w-0 gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/8">
            {pick.chart.jacketUrl ? (
              <Image
                alt=""
                className="h-full w-full object-cover"
                height={80}
                priority
                src={pick.chart.jacketUrl}
                unoptimized
                width={80}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200">
              <span>{pick.category === "low" ? "12+ 이하" : "13 ~ 13+"}</span>
              <span>주간 선정곡</span>
            </div>
            <Link
              className="mt-2 block break-words text-2xl font-semibold leading-tight text-white hover:text-cyan-100"
              href={`/charts/${pick.chart.chartId}`}
            >
              {pick.chart.title}
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <ChartDifficultyImage difficulty={pick.chart.difficulty} />
              <ChartKindImage kind={pick.chart.kind} />
              <span>
                {pick.chart.versionName ? `${pick.chart.versionName} · ` : ""}
                Lv {pick.chart.level} · 최대 DX {formatMaxDxScore(pick.chart.maxDxScore)}
              </span>
            </div>
            <div className="mt-2 text-sm text-slate-300">
              현재 1등 {formatCurrentLeader(pick)}
            </div>
          </div>
        </div>
      </div>

      {pick.rankings.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-slate-300">
          아직 이 주간 곡을 갱신한 유저가 없습니다.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[52px_minmax(110px,1fr)_minmax(128px,0.95fr)_minmax(100px,0.7fr)] gap-3 border-b border-white/10 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400 max-sm:hidden">
            <span>순위</span>
            <span>유저</span>
            <span>DX Score</span>
            <span>STAR</span>
          </div>
          <div className="divide-y divide-white/10">
            {pick.rankings.map((ranking) => (
              <div
                className="grid min-h-20 grid-cols-[52px_minmax(110px,1fr)_minmax(128px,0.95fr)_minmax(100px,0.7fr)] items-center gap-3 px-4 py-3 max-sm:grid-cols-[52px_minmax(0,1fr)] max-sm:items-start"
                key={ranking.profileId}
              >
                <div className="font-mono text-lg leading-none text-cyan-100">
                  #{ranking.rank}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium leading-5 text-white">
                    {ranking.playerName}
                  </div>
                  <div className="mt-1 truncate text-xs leading-4 text-slate-400">
                    {ranking.discordUsername ?? "Discord 연결됨"}
                  </div>
                </div>
                <DxScoreCell
                  dxScore={ranking.dxScore}
                  maxDxScore={ranking.maxDxScore}
                />
                <div className="flex w-[100px] items-center max-sm:col-start-2">
                  <DxStarImage starCount={ranking.dxStarCount} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

function DxScoreCell({
  dxScore,
  maxDxScore,
}: {
  dxScore: number;
  maxDxScore: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 whitespace-nowrap font-mono leading-5 max-sm:col-start-2">
      <span className="text-sm text-slate-100">
        {formatDxScorePair(dxScore, maxDxScore)}
      </span>
      {maxDxScore > 0 ? (
        <span className="text-[11px] text-cyan-100/80">
          {formatDxScoreRatio(dxScore, maxDxScore)}
        </span>
      ) : null}
    </div>
  );
}

function DxStarImage({ starCount }: { starCount: number }) {
  const imageUrl = getDxStarImageUrl(starCount);

  if (!imageUrl) {
    return null;
  }

  return (
    <Image
      alt={`${starCount} DX star`}
      className="h-[20px] w-[104px] shrink-0 object-contain object-left"
      height={46}
      src={imageUrl}
      unoptimized
      width={240}
    />
  );
}

function formatCurrentLeader(pick: WeeklyChallengePick): string {
  if (!pick.chart.leaderDxScore || !pick.chart.leaderName) {
    return "-";
  }

  const suffix =
    pick.chart.leaderCount > 1 ? ` 외 ${pick.chart.leaderCount - 1}명` : "";

  return `${pick.chart.leaderDxScore.toLocaleString("ko-KR")} · ${
    pick.chart.leaderName
  }${suffix}`;
}

function formatDxScorePair(dxScore: number, maxDxScore: number): string {
  if (maxDxScore <= 0) {
    return `${dxScore.toLocaleString("ko-KR")} / 추후 입력 예정`;
  }

  return `${dxScore.toLocaleString("ko-KR")} / ${maxDxScore.toLocaleString("ko-KR")}`;
}

function formatDxScoreRatio(dxScore: number, maxDxScore: number): string {
  return `${((dxScore / maxDxScore) * 100).toFixed(2)}%`;
}

function formatMaxDxScore(maxDxScore: number): string {
  return maxDxScore > 0 ? maxDxScore.toLocaleString("ko-KR") : "추후 입력 예정";
}
