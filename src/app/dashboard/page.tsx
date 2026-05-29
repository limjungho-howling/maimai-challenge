import { headers } from "next/headers";
import Link from "next/link";

import {
  updateDmAlerts,
  updateRankDropMessageTitles,
} from "@/app/dashboard/actions";
import { BookmarkletButton } from "@/components/bookmarklet-button";
import { getDashboardData } from "@/lib/data/dashboard";
import { formatKstDateTime } from "@/lib/time";

const DEFAULT_RANK_DROP_TITLE =
  "다음 유저에 의해 해당 곡의 디럭스 스코어 등수가 하락하였습니다.";

interface DashboardPageProps {
  searchParams?: Promise<{ error?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [{ userId, profile, ingestRuns, rankDropTitleSettings }, headerStore] = await Promise.all([
    getDashboardData(),
    headers(),
  ]);
  const params = await searchParams;
  const appOrigin = getAppOrigin(headerStore);
  const authErrorMessage = getAuthErrorMessage(params?.error);
  const isCatalogAdmin = isCatalogBookmarkletAdmin(profile);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#243326,transparent_30rem),linear-gradient(135deg,#080b12,#111827_52%,#141414)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <Link className="text-sm text-cyan-200 hover:text-cyan-100" href="/">
              곡 리스트
            </Link>
            <Link className="ml-4 text-sm text-cyan-200 hover:text-cyan-100" href="/players">
              유저 순위
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
            {authErrorMessage ? (
              <p className="mt-4 rounded-md border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                {authErrorMessage}
              </p>
            ) : null}
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
                <div className="grid gap-3">
                  <BookmarkletButton
                    appOrigin={appOrigin}
                    kind="score"
                    label="점수 갱신"
                  />
                  {isCatalogAdmin ? (
                    <>
                      <BookmarkletButton
                        appOrigin={appOrigin}
                        kind="catalog"
                        label="곡 정보 수집"
                      />
                      <BookmarkletButton
                        appOrigin={appOrigin}
                        kind="new-catalog"
                        label="신곡 정보 수집"
                      />
                    </>
                  ) : null}
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

            <section className="rounded-lg border border-white/10 bg-white/[0.045] p-6">
              <form action={updateRankDropMessageTitles} className="grid gap-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      개인별 역전 로그 제목
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      내가 해당 유저를 역전했을 때, 그 유저의 개인 채널에 보낼 메시지 제목입니다.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {rankDropTitleSettings.length === 0 ? (
                    <div className="rounded-md border border-white/10 px-3 py-4 text-sm text-slate-300">
                      설정할 등록 유저가 없습니다.
                    </div>
                  ) : (
                    rankDropTitleSettings.map((setting) => (
                      <label
                        className="grid gap-2 rounded-md border border-white/10 p-3 md:grid-cols-[180px_1fr] md:items-center"
                        key={setting.targetProfileId}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">
                            {setting.targetName}
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-400">
                            {setting.discordUsername ?? "Discord 연결됨"}
                          </span>
                        </span>
                        <input
                          className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                          defaultValue={setting.title ?? ""}
                          maxLength={120}
                          name={`rankDropTitle:${setting.targetProfileId}`}
                          placeholder={DEFAULT_RANK_DROP_TITLE}
                          type="text"
                        />
                      </label>
                    ))
                  )}
                </div>
                <div>
                  <button className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-100 hover:bg-white/10">
                    제목 저장
                  </button>
                </div>
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
                        {formatKstDateTime(run.createdAt)}
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

function getAuthErrorMessage(error: string | undefined): string | null {
  if (error === "discord_guild_required") {
    return "운영 중인 Discord 서버에 포함된 유저만 로그인할 수 있습니다.";
  }

  if (error === "login_failed") {
    return "Discord 로그인 처리에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  return null;
}

function isCatalogBookmarkletAdmin(
  profile: Awaited<ReturnType<typeof getDashboardData>>["profile"],
): boolean {
  return (
    profile?.discordUsername === "howlingsoul" ||
    profile?.discordUserId === "howlingsoul"
  );
}
