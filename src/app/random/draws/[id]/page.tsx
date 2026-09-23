import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChartDifficultyImage, ChartKindImage } from "@/components/chart-type-images";
import { getRandomDraw, listEarlierDrawsForPool } from "@/lib/data/draws";
import { drandRoundUrl } from "@/lib/random/drand";
import { POOL_MESSAGE_SEPARATOR } from "@/lib/random/verifiable";
import { formatKstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

interface DrawPageProps {
  params: Promise<{ id: string }>;
}

export default async function RandomDrawPage({ params }: DrawPageProps) {
  const { id } = await params;
  const draw = await getRandomDraw(id);

  if (!draw) {
    notFound();
  }

  const earlierDraws = await listEarlierDrawsForPool(draw.poolHash, draw.committedAt);
  const winner =
    draw.winnerIndex === null ? null : (draw.pool[draw.winnerIndex] ?? null);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123042,transparent_34rem),linear-gradient(135deg,#080b12,#111827_52%,#13151b)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm font-medium text-cyan-200">검증 선곡 기록</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {draw.revealedAt ? (draw.winnerTitle ?? "결과 없음") : "공개 대기 중"}
            </h1>
            <p className="mt-2 text-sm text-slate-300">추첨자 {draw.drawerName}</p>
            <p className="mt-1 font-mono text-xs break-all text-slate-400">{draw.id}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/random/draws"
            >
              전체 기록
            </Link>
            <Link
              className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/random"
            >
              랜덤 선곡
            </Link>
          </nav>
        </header>

        {earlierDraws.length > 0 ? (
          <section className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
            <h2 className="text-sm font-semibold text-amber-200">
              같은 풀로 이전에 {earlierDraws.length}번 추첨한 기록이 있습니다
            </h2>
            <p className="mt-1 text-xs text-amber-200/80">
              이 추첨은 같은 후보 구성으로 진행된 {earlierDraws.length + 1}번째
              시도입니다. 아래 기록도 함께 확인하세요.
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {earlierDraws.map((earlier) => (
                <li key={earlier.id}>
                  <Link
                    className="font-mono text-xs text-amber-100 underline-offset-2 hover:underline"
                    href={`/random/draws/${earlier.id}`}
                  >
                    {formatKstDateTime(earlier.committedAt)} · {earlier.drawerName} ·{" "}
                    {earlier.winnerTitle ?? "미공개"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {winner ? (
          <section className="flex flex-col items-center gap-4 rounded-lg border border-cyan-300/50 bg-cyan-300/5 p-6">
            <div className="h-32 w-32 overflow-hidden rounded-lg border border-white/10 bg-white/8">
              {winner.jacketUrl ? (
                <Image
                  alt=""
                  className="h-full w-full object-cover"
                  height={128}
                  src={winner.jacketUrl}
                  unoptimized
                  width={128}
                />
              ) : null}
            </div>
            <p className="text-center text-xl font-semibold text-white">
              {winner.title}
            </p>
            <div className="flex items-center gap-2">
              <ChartDifficultyImage difficulty={winner.difficulty} />
              <ChartKindImage kind={winner.kind} />
            </div>
            <p className="text-xs text-slate-400">
              Lv {winner.level}
              {winner.versionName ? ` · ${winner.versionName}` : ""} · 후보{" "}
              {draw.poolSize}곡 중 {draw.winnerIndex! + 1}번
            </p>
          </section>
        ) : (
          <section className="rounded-lg border border-white/10 bg-white/[0.045] px-4 py-12 text-center text-sm text-slate-300">
            아직 결과가 공개되지 않았습니다. drand 라운드 {draw.beaconRound}는{" "}
            {formatKstDateTime(draw.beaconAvailableAt)}에 공개됩니다.
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <h2 className="text-lg font-semibold text-white">검증 정보</h2>
          <dl className="grid gap-2 text-xs sm:grid-cols-[120px_1fr]">
            <dt className="text-slate-400">풀 고정 시각</dt>
            <dd className="text-slate-200">{formatKstDateTime(draw.committedAt)}</dd>

            <dt className="text-slate-400">공개 시각</dt>
            <dd className="text-slate-200">
              {draw.revealedAt ? formatKstDateTime(draw.revealedAt) : "미공개"}
            </dd>

            <dt className="text-slate-400">풀 해시</dt>
            <dd className="font-mono break-all text-slate-200">{draw.poolHash}</dd>

            <dt className="text-slate-400">drand 체인</dt>
            <dd className="font-mono break-all text-slate-200">{draw.beaconChain}</dd>

            <dt className="text-slate-400">drand 라운드</dt>
            <dd>
              <a
                className="font-mono text-cyan-200 underline-offset-2 hover:underline"
                href={drandRoundUrl(draw.beaconRound)}
                rel="noreferrer noopener"
                target="_blank"
              >
                {draw.beaconRound}
              </a>
            </dd>

            {draw.beaconRandomness ? (
              <>
                <dt className="text-slate-400">난수</dt>
                <dd className="font-mono break-all text-slate-200">
                  {draw.beaconRandomness}
                </dd>
              </>
            ) : null}
          </dl>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <h2 className="text-lg font-semibold text-white">직접 검증하는 법</h2>
          <p className="text-sm text-slate-300">
            풀은 추첨 전에 고정되었고, 결과를 정한 난수는 그 시점에 아직 존재하지
            않았습니다. 따라서 추첨자도 이 사이트도 결과를 고를 수 없습니다. 아래를
            그대로 실행하면 같은 결과가 나와야 합니다.
          </p>
          <pre className="overflow-x-auto rounded-md border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
{`# 1. drand 라운드의 난수를 직접 가져옵니다
curl -s ${drandRoundUrl(draw.beaconRound)}

# 2. 아래 목록(줄바꿈으로 이어붙인 chart_id)이 풀입니다
cat <<'EOF' > pool.txt
${draw.pool.map((chart) => chart.chartId).join(POOL_MESSAGE_SEPARATOR)}
EOF

# 3. 풀 해시가 위에 공개된 값과 같은지 확인합니다
printf '%s' "$(cat pool.txt)" | shasum -a 256

# 4. 당첨 번호를 다시 계산합니다
python3 - <<'EOF'
import hashlib, hmac
randomness = bytes.fromhex("${draw.beaconRandomness ?? "<공개 후 입력>"}")
message = open("pool.txt").read().rstrip("\\n").encode()
digest = hmac.new(randomness, message, hashlib.sha256).hexdigest()
print(int(digest, 16) % ${draw.poolSize})
EOF`}
          </pre>
          <p className="text-xs text-slate-400">
            4번이 출력하는 번호가 아래 후보 목록의 0부터 센 순번이며, 이 추첨에서는{" "}
            {draw.winnerIndex === null ? "아직 공개되지 않았습니다" : draw.winnerIndex}
            입니다.
          </p>
        </section>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
          <h2 className="border-b border-white/10 px-4 py-3 text-lg font-semibold text-white">
            고정된 후보 {draw.poolSize}곡
          </h2>
          <ol className="divide-y divide-white/10">
            {draw.pool.map((chart, index) => (
              <li
                className={`flex items-center gap-3 px-4 py-3 ${
                  index === draw.winnerIndex ? "bg-cyan-300/10" : ""
                }`}
                key={`${chart.chartId}:${index}`}
              >
                <span className="w-8 shrink-0 text-center font-mono text-sm text-slate-400">
                  {index}
                </span>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/8">
                  {chart.jacketUrl ? (
                    <Image
                      alt=""
                      className="h-full w-full object-cover"
                      height={40}
                      loading="lazy"
                      src={chart.jacketUrl}
                      unoptimized
                      width={40}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-sm font-medium text-white">
                      {chart.title}
                    </span>
                    <ChartDifficultyImage difficulty={chart.difficulty} />
                    <ChartKindImage kind={chart.kind} />
                  </div>
                  <p className="mt-1 font-mono text-[11px] break-all text-slate-500">
                    {chart.chartId}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
