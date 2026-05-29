import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

import { ChartDifficultyImage, ChartKindImage } from "@/components/chart-type-images";
import { SongListSkeleton } from "@/components/leaderboard-skeletons";
import { RANKING_DIFFICULTIES, getDifficultyLabel } from "@/lib/maimai/constants";
import { listChartLevels, listChartVersions, listCharts } from "@/lib/data/charts";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatKstDateTime } from "@/lib/time";

const PAGE_SIZE = 30;

interface HomePageProps {
  searchParams: Promise<{
    diff?: string;
    leader?: string;
    level?: string;
    page?: string;
    q?: string;
    version?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const isLoggedIn = await getIsLoggedIn();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123042,transparent_34rem),linear-gradient(135deg,#080b12,#111827_52%,#13151b)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm font-medium text-cyan-200">maimaiDX International</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-white">
              maimai Challenge
            </h1>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/players"
            >
              유저 순위
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/"
            >
              곡 랭킹
            </Link>
            {isLoggedIn ? (
              <Link
                className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                href="/dashboard"
              >
                대시보드
              </Link>
            ) : (
              <Link
                className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                href="/auth/login?next=/dashboard"
              >
                Discord로 로그인
              </Link>
            )}
          </nav>
        </header>

        <Suspense fallback={<SongListSkeleton />}>
          <SongListContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function getIsLoggedIn(): Promise<boolean> {
  if (!hasSupabasePublicEnv()) {
    return false;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user);
}

async function SongListContent({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const difficulty = parseDifficulty(params.diff);
  const leaderProfileId = parseTextParam(params.leader);
  const level = parseTextParam(params.level);
  const search = parseTextParam(params.q);
  const version = parseVersion(params.version);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [{ charts, count }, levels, versions] = await Promise.all([
    listCharts({
      difficulty,
      leaderProfileId,
      level,
      page,
      pageSize: PAGE_SIZE,
      search,
      version,
    }),
    listChartLevels(),
    listChartVersions(),
  ]);
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <>
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">곡 리스트</h2>
            <p className="mt-1 text-sm text-slate-300">
              {leaderProfileId
                ? "선택한 유저가 1등을 달성한 곡만 표시됩니다."
                : "최근 점수 또는 순위 변동이 생긴 곡이 먼저 표시됩니다."}
            </p>
            {leaderProfileId ? (
              <Link className="mt-2 inline-flex text-sm text-cyan-200 hover:text-cyan-100" href="/">
                전체 곡 리스트 보기
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <DifficultyLink
              active={difficulty === null}
              href={filterHref({ difficulty: null, leaderProfileId, level, search, version })}
              label="전체"
            />
            {RANKING_DIFFICULTIES.map((item) => (
              <DifficultyLink
                active={difficulty === item}
                href={filterHref({ difficulty: item, leaderProfileId, level, search, version })}
                key={item}
                label={getDifficultyLabel(item)}
              />
            ))}
          </div>
        </section>

        <form
          action="/"
          className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4 sm:grid-cols-[1fr_180px_220px_auto]"
        >
          {difficulty !== null ? <input name="diff" type="hidden" value={difficulty} /> : null}
          {leaderProfileId ? <input name="leader" type="hidden" value={leaderProfileId} /> : null}
          <label className="min-w-0">
            <span className="sr-only">곡 이름 검색</span>
            <input
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
              defaultValue={search ?? ""}
              name="q"
              placeholder="곡 이름 검색"
              type="search"
            />
          </label>
          <label>
            <span className="sr-only">레벨 필터</span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300"
              defaultValue={level ?? ""}
              name="level"
            >
              <option value="">전체 레벨</option>
              {levels.map((item) => (
                <option key={item} value={item}>
                  Lv {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">버전 필터</span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300"
              defaultValue={version ?? ""}
              name="version"
            >
              <option value="">전체 버전</option>
              {versions.map((item) => (
                <option key={item.number} value={item.number}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="h-11 rounded-md bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
            검색
          </button>
        </form>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
          <div className="grid grid-cols-[1fr_160px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-400 max-sm:hidden">
            <span>곡</span>
            <span>1등</span>
          </div>
          {charts.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-300">
              조건에 맞는 곡이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {charts.map((chart) => (
                <Link
                  className="grid grid-cols-[1fr_160px] gap-3 px-4 py-4 transition hover:bg-white/8 max-sm:grid-cols-1"
                  href={`/charts/${chart.chartId}`}
                  key={chart.chartId}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/8">
                      {chart.jacketUrl ? (
                        <Image
                          alt=""
                          className="h-full w-full object-cover"
                          height={56}
                          loading="lazy"
                          src={chart.jacketUrl}
                          unoptimized
                          width={56}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex max-w-full flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-950/45 px-2 py-1 font-medium text-white ring-1 ring-white/10">
                          {chart.title}
                        </span>
                        <ChartDifficultyImage difficulty={chart.difficulty} />
                        <ChartKindImage kind={chart.kind} />
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Lv {chart.level}
                        {chart.versionName ? ` · ${chart.versionName}` : ""}
                        {chart.lastChangedAt
                          ? ` · ${formatKstDateTime(chart.lastChangedAt)}`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-200">
                    {formatLeader(chart.leaderName, chart.leaderCount)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <nav className="flex items-center justify-center gap-3">
          <PageLink
            disabled={page <= 1}
            href={pageHref({
              difficulty,
              leaderProfileId,
              level,
              page: page - 1,
              search,
              version,
            })}
            label="이전"
          />
          <span className="font-mono text-sm text-slate-300">
            {page} / {pageCount}
          </span>
          <PageLink
            disabled={page >= pageCount}
            href={pageHref({
              difficulty,
              leaderProfileId,
              level,
              page: page + 1,
              search,
              version,
            })}
            label="다음"
          />
        </nav>
    </>
  );
}

function DifficultyLink({
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
          : "border border-white/10 text-slate-200 hover:bg-white/10"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}

function PageLink({
  disabled,
  href,
  label,
}: {
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-500">
        {label}
      </span>
    );
  }

  return (
    <Link
      className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
      href={href}
    >
      {label}
    </Link>
  );
}

function parseDifficulty(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return RANKING_DIFFICULTIES.includes(parsed as never) ? parsed : null;
}

function parseVersion(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 25 ? parsed : null;
}

function parseTextParam(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function pageHref({
  difficulty,
  leaderProfileId,
  level,
  page,
  search,
  version,
}: {
  difficulty: number | null;
  leaderProfileId: string | null;
  level: string | null;
  page: number;
  search: string | null;
  version: number | null;
}): string {
  const params = buildSearchParams({ difficulty, leaderProfileId, level, search, version });
  params.set("page", String(page));
  return `/?${params.toString()}`;
}

function filterHref({
  difficulty,
  leaderProfileId,
  level,
  search,
  version,
}: {
  difficulty: number | null;
  leaderProfileId: string | null;
  level: string | null;
  search: string | null;
  version: number | null;
}): string {
  const params = buildSearchParams({ difficulty, leaderProfileId, level, search, version });
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function buildSearchParams({
  difficulty,
  leaderProfileId,
  level,
  search,
  version,
}: {
  difficulty: number | null;
  leaderProfileId: string | null;
  level: string | null;
  search: string | null;
  version: number | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (difficulty !== null) {
    params.set("diff", String(difficulty));
  }
  if (leaderProfileId) {
    params.set("leader", leaderProfileId);
  }
  if (level) {
    params.set("level", level);
  }
  if (search) {
    params.set("q", search);
  }
  if (version !== null) {
    params.set("version", String(version));
  }
  return params;
}

function formatLeader(name: string | null, count: number): string {
  if (!name) {
    return "-";
  }

  return count > 1 ? `${name} 외 ${count - 1}명` : name;
}
