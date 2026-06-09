import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { ChartDifficultyImage, ChartKindImage } from "@/components/chart-type-images";
import { getChartSummary, listChartRankings } from "@/lib/data/charts";
import { getDxStarImageUrl } from "@/lib/maimai/dx-stars";
import { formatKstDateTime } from "@/lib/time";

interface ChartPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChartPage({ params }: ChartPageProps) {
  const { id } = await params;
  const [chart, rankings] = await Promise.all([
    getChartSummary(id),
    listChartRankings(id),
  ]);

  if (!chart) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#080b12,#111827_55%,#16171f)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/8">
              {chart.jacketUrl ? (
                <Image
                  alt=""
                  className="h-full w-full object-cover"
                  height={80}
                  priority
                  src={chart.jacketUrl}
                  unoptimized
                  width={80}
                />
              ) : null}
            </div>
            <div className="min-w-0">
            <Link className="text-sm text-cyan-200 hover:text-cyan-100" href="/">
              곡 리스트로 돌아가기
            </Link>
            <h1 className="mt-3 break-words text-3xl font-semibold text-white">
              {chart.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <ChartDifficultyImage difficulty={chart.difficulty} />
              <ChartKindImage kind={chart.kind} />
              <span>
                {chart.versionName ? `${chart.versionName} · ` : ""}
                Lv {chart.level} · 최대 DX {formatMaxDxScore(chart.maxDxScore)}
              </span>
            </div>
            </div>
          </div>
          <nav className="flex shrink-0 items-center gap-2">
            <Link
              className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/"
            >
              곡 리스트
            </Link>
            <Link
              className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/players"
            >
              유저 순위
            </Link>
            <Link
              className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/weekly"
            >
              주간 랭킹
            </Link>
            <Link
              className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/dashboard"
            >
              데이터 갱신
            </Link>
          </nav>
        </header>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
          {rankings.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-300">
              아직 이 곡에 등록된 점수가 없습니다.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[48px_minmax(120px,1.1fr)_minmax(132px,1fr)_minmax(124px,0.75fr)_minmax(88px,0.55fr)_minmax(112px,0.75fr)] gap-x-3 border-b border-white/10 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400 max-md:hidden">
                <span>순위</span>
                <span>사용자</span>
                <span className="justify-self-start text-left">DX Score</span>
                <span>STAR</span>
                <span>달성률</span>
                <span>갱신</span>
              </div>
              <div className="divide-y divide-white/10">
                {rankings.map((ranking) => (
                  <div
                    className="grid min-h-20 grid-cols-[48px_minmax(120px,1.1fr)_minmax(132px,1fr)_minmax(124px,0.75fr)_minmax(88px,0.55fr)_minmax(112px,0.75fr)] items-center gap-x-3 gap-y-3 px-4 py-3 max-md:grid-cols-[48px_minmax(0,1fr)] max-md:items-start"
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
                    <div className="flex w-[124px] items-center max-md:col-start-2">
                      <DxStarImage starCount={ranking.dxStarCount} />
                    </div>
                    <div className="whitespace-nowrap font-mono text-sm leading-5 text-slate-200 max-md:col-start-2">
                      {ranking.achievementRate === null
                        ? "-"
                        : `${ranking.achievementRate.toFixed(4)}%`}
                    </div>
                    <div className="text-xs leading-4 text-slate-400 max-md:col-start-2">
                      {formatKstDateTime(ranking.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
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
    <div className="flex flex-wrap items-baseline justify-self-start gap-x-2 whitespace-nowrap text-left font-mono leading-5 max-md:col-start-2">
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

function DxStarImage({ starCount }: { starCount: number }) {
  const imageUrl = getDxStarImageUrl(starCount);

  if (!imageUrl) {
    return null;
  }

  return (
    <Image
      alt={`${starCount} DX star`}
      className="h-[23px] w-[120px] shrink-0 object-contain object-left"
      height={46}
      src={imageUrl}
      unoptimized
      width={240}
    />
  );
}
