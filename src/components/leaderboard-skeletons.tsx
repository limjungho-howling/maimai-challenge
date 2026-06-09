function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

export function SongListSkeleton() {
  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-11 w-56 max-w-full" />
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4 sm:grid-cols-[1fr_180px_220px_auto]">
        <SkeletonBlock className="h-11 w-full" />
        <SkeletonBlock className="h-11 w-full" />
        <SkeletonBlock className="h-11 w-full" />
        <SkeletonBlock className="h-11 w-20" />
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
        <div className="grid grid-cols-[1fr_160px] gap-3 border-b border-white/10 px-4 py-3 max-sm:hidden">
          <SkeletonBlock className="h-4 w-12" />
          <SkeletonBlock className="h-4 w-12" />
        </div>
        <div className="divide-y divide-white/10">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className="grid grid-cols-[1fr_160px] gap-3 px-4 py-4 max-sm:grid-cols-1"
              key={index}
            >
              <div className="flex min-w-0 items-center gap-3">
                <SkeletonBlock className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-5 w-3/5" />
                  <div className="mt-2 flex items-center gap-2">
                    <SkeletonBlock className="h-4 w-20" />
                    <SkeletonBlock className="h-4 w-20" />
                  </div>
                </div>
              </div>
              <SkeletonBlock className="h-5 w-28" />
            </div>
          ))}
        </div>
      </section>

      <nav className="flex items-center justify-center gap-3">
        <SkeletonBlock className="h-10 w-16" />
        <SkeletonBlock className="h-5 w-12" />
        <SkeletonBlock className="h-10 w-16" />
      </nav>
    </>
  );
}

export function PlayerLeaderboardSkeleton({
  showShareChart = true,
}: {
  showShareChart?: boolean;
}) {
  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SkeletonBlock className="h-7 w-36" />
          <SkeletonBlock className="mt-3 h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap rounded-lg border border-white/10 bg-white/[0.045] p-1">
            <SkeletonBlock className="h-10 w-28" />
            <SkeletonBlock className="ml-1 h-10 w-16" />
            <SkeletonBlock className="ml-1 h-10 w-20" />
            <SkeletonBlock className="ml-1 h-10 w-24" />
            <SkeletonBlock className="ml-1 h-10 w-28" />
          </div>
        </div>
      </section>

      {showShareChart ? (
        <section className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.045] p-4 lg:grid-cols-[minmax(280px,0.9fr)_1fr]">
          <div className="flex min-h-72 items-center justify-center">
            <div className="relative h-60 w-60 rounded-full border-[34px] border-white/10">
              <SkeletonBlock className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            </div>
          </div>
          <div className="grid content-center gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="grid grid-cols-[1fr_80px] items-center gap-3" key={index}>
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
        <div className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 border-b border-white/10 px-4 py-3 max-md:hidden">
          <SkeletonBlock className="h-4 w-10" />
          <SkeletonBlock className="h-4 w-12" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
        <div className="divide-y divide-white/10">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className="grid grid-cols-[80px_1fr_140px_140px_180px] gap-3 px-4 py-4 max-md:grid-cols-2"
              key={index}
            >
              <SkeletonBlock className="h-7 w-12" />
              <div className="min-w-0">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="mt-2 h-4 w-56 max-w-full" />
              </div>
              <SkeletonBlock className="h-5 w-16" />
              <SkeletonBlock className="h-5 w-16" />
              <SkeletonBlock className="h-4 w-32" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function WeeklyLeaderboardSkeleton() {
  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="mt-3 h-4 w-80 max-w-full" />
          <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-10 w-36" />
          <SkeletonBlock className="h-10 w-16" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, cardIndex) => (
          <article
            className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]"
            key={cardIndex}
          >
            <div className="border-b border-white/10 p-4">
              <div className="flex min-w-0 gap-4">
                <SkeletonBlock className="h-20 w-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SkeletonBlock className="h-4 w-16" />
                    <SkeletonBlock className="h-4 w-20" />
                  </div>
                  <SkeletonBlock className="mt-3 h-7 w-3/4" />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SkeletonBlock className="h-5 w-24" />
                    <SkeletonBlock className="h-5 w-20" />
                    <SkeletonBlock className="h-4 w-52 max-w-full" />
                  </div>
                  <SkeletonBlock className="mt-3 h-4 w-56 max-w-full" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[52px_minmax(110px,1fr)_minmax(128px,0.95fr)_minmax(100px,0.7fr)] gap-3 border-b border-white/10 px-4 py-3 max-sm:hidden">
              <SkeletonBlock className="h-4 w-10" />
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-4 w-12" />
            </div>
            <div className="divide-y divide-white/10">
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <div
                  className="grid min-h-20 grid-cols-[52px_minmax(110px,1fr)_minmax(128px,0.95fr)_minmax(100px,0.7fr)] items-center gap-3 px-4 py-3 max-sm:grid-cols-[52px_minmax(0,1fr)] max-sm:items-start"
                  key={rowIndex}
                >
                  <SkeletonBlock className="h-7 w-10" />
                  <div className="min-w-0">
                    <SkeletonBlock className="h-5 w-32" />
                    <SkeletonBlock className="mt-2 h-4 w-40 max-w-full" />
                  </div>
                  <SkeletonBlock className="h-5 w-28" />
                  <SkeletonBlock className="h-5 w-20" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
