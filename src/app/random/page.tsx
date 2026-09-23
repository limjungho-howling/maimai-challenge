import Link from "next/link";
import { Suspense } from "react";

import { RandomPicker } from "@/components/random/random-picker";
import { listChartLevels, listChartVersions } from "@/lib/data/charts";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RandomPickerSkeleton } from "./skeleton";

export const metadata = {
  title: "랜덤 선곡 | maimai Challenge",
};

export default function RandomPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#123042,transparent_34rem),linear-gradient(135deg,#080b12,#111827_52%,#13151b)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm font-medium text-cyan-200">maimaiDX International</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-white">
              랜덤 선곡
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              곡을 검색해 풀에 담고 선곡 버튼을 누르면 한 곡이 뽑힙니다. 뽑힌 곡은
              풀에서 빠지므로 남은 곡으로 계속 돌릴 수 있습니다.
            </p>
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
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/weekly"
            >
              주간 랭킹
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/random/draws"
            >
              선곡 기록
            </Link>
            <Link
              className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/dashboard"
            >
              대시보드
            </Link>
          </nav>
        </header>

        <Suspense fallback={<RandomPickerSkeleton />}>
          <RandomPickerContent />
        </Suspense>
      </div>
    </main>
  );
}

async function RandomPickerContent() {
  const [levels, versions, isLoggedIn] = await Promise.all([
    listChartLevels(),
    listChartVersions(),
    getIsLoggedIn(),
  ]);

  return (
    <RandomPicker isLoggedIn={isLoggedIn} levels={levels} versions={versions} />
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
