import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getChartSummary, listChartRankings } from "@/lib/data/charts";
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
            <p className="mt-2 text-sm text-slate-300">
              {chart.kind} · {chart.difficultyLabel} · Lv {chart.level} · 최대 DX{" "}
              {chart.maxDxScore.toLocaleString("ko-KR")}
            </p>
            </div>
          </div>
          <Link
            className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
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
        </header>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
          <div className="grid grid-cols-[80px_1fr_140px_120px_160px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
            <span>순위</span>
            <span>사용자</span>
            <span>DX Score</span>
            <span>달성률</span>
            <span>갱신</span>
          </div>
          {rankings.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-300">
              아직 이 곡에 등록된 점수가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {rankings.map((ranking) => (
                <div
                  className="grid grid-cols-[80px_1fr_140px_120px_160px] gap-3 px-4 py-4 max-md:grid-cols-2"
                  key={ranking.profileId}
                >
                  <div className="font-mono text-lg text-cyan-100">#{ranking.rank}</div>
                  <div>
                    <div className="font-medium text-white">{ranking.playerName}</div>
                    <div className="text-xs text-slate-400">
                      {ranking.discordUsername ?? "Discord 연결됨"}
                    </div>
                  </div>
                  <div className="font-mono text-sm text-slate-100">
                    {ranking.dxScore.toLocaleString("ko-KR")} /{" "}
                    {ranking.maxDxScore.toLocaleString("ko-KR")}
                  </div>
                  <div className="font-mono text-sm text-slate-200">
                    {ranking.achievementRate === null
                      ? "-"
                      : `${ranking.achievementRate.toFixed(4)}%`}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatKstDateTime(ranking.updatedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
