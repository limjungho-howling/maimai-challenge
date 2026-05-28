import { headers } from "next/headers";
import Link from "next/link";

import { updateDmAlerts } from "@/app/dashboard/actions";
import { BookmarkletButton } from "@/components/bookmarklet-button";
import { getDashboardData } from "@/lib/data/dashboard";

export default async function DashboardPage() {
  const [{ userId, profile, ingestRuns }, headerStore] = await Promise.all([
    getDashboardData(),
    headers(),
  ]);
  const appOrigin = getAppOrigin(headerStore);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#243326,transparent_30rem),linear-gradient(135deg,#080b12,#111827_52%,#141414)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <Link className="text-sm text-cyan-200 hover:text-cyan-100" href="/">
              곡 리스트
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-white">대시보드</h1>
          </div>
          {userId ? (
            <form action="/auth/logout" method="post">
              <button className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-100 hover:bg-white/10">
                로그아웃
              </button>
            </form>
          ) : null}
        </header>

        {!userId ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.045] p-6">
            <h2 className="text-xl font-semibold text-white">Discord 로그인이 필요합니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              업로드는 Discord OAuth 로그인 사용자에게 귀속됩니다. 개인 토큰은 사용하지
              않습니다.
            </p>
            <a
              className="mt-5 inline-flex rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/auth/login?next=/dashboard"
            >
              Discord로 로그인
            </a>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Metric label="maimai 이름" value={profile?.maimaiName ?? "미등록"} />
              <Metric
                label="레이팅"
                value={profile?.maimaiRating?.toLocaleString("ko-KR") ?? "-"}
              />
              <Metric label="칭호" value={profile?.trophy ?? "-"} />
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.045] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">고정 북마클릿</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    아래 링크를 북마크바로 드래그하거나 복사해서 북마크 URL에 붙여넣으세요.
                    maimaiDX International 공식 홈페이지에서 실행하면 릴레이 팝업으로
                    데이터가 업로드됩니다.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <BookmarkletButton
                    appOrigin={appOrigin}
                    kind="score"
                    label="점수 갱신"
                  />
                  <BookmarkletButton
                    appOrigin={appOrigin}
                    kind="catalog"
                    label="곡 정보 수집"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.045] p-6">
              <form action={updateDmAlerts} className="flex flex-wrap items-center gap-3">
                <input
                  className="h-4 w-4 accent-cyan-300"
                  defaultChecked={profile?.dmAlertsEnabled ?? true}
                  id="dmAlertsEnabled"
                  name="dmAlertsEnabled"
                  type="checkbox"
                />
                <label className="text-sm text-slate-200" htmlFor="dmAlertsEnabled">
                  랭킹 하락 시 Discord DM 알림 받기
                </label>
                <button className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-100 hover:bg-white/10">
                  저장
                </button>
              </form>
            </section>

            <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
              <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
                최근 업로드
              </div>
              {ingestRuns.length === 0 ? (
                <div className="px-4 py-10 text-sm text-slate-300">
                  아직 업로드 기록이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {ingestRuns.map((run) => (
                    <div
                      className="grid grid-cols-[1fr_100px_120px_180px] gap-3 px-4 py-4 text-sm max-md:grid-cols-1"
                      key={run.id}
                    >
                      <div>
                        <div className="font-medium text-white">{run.playerName ?? "-"}</div>
                        <div className="text-xs text-slate-400">상태 {run.status}</div>
                      </div>
                      <div>{run.scoreCount.toLocaleString("ko-KR")}곡</div>
                      <div>{run.changedChartCount.toLocaleString("ko-KR")}변동</div>
                      <div className="text-xs text-slate-400">
                        {new Date(run.createdAt).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
      <div className="text-xs font-medium uppercase text-slate-400">{label}</div>
      <div className="mt-2 truncate text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function getAppOrigin(headersList: Headers): string {
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
