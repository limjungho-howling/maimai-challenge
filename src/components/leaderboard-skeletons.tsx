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
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock className="h-10 w-24" key={index} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4 sm:grid-cols-[1fr_180px_auto]">
        <SkeletonBlock className="h-11 w-full" />
        <SkeletonBlock className="h-11 w-full" />
        <SkeletonBlock className="h-11 w-20" />
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
        <div className="grid grid-cols-[1fr_100px_160px] gap-3 border-b border-white/10 px-4 py-3 max-sm:hidden">
          <SkeletonBlock className="h-4 w-12" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-12" />
        </div>
        <div className="divide-y divide-white/10">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className="grid grid-cols-[1fr_100px_160px] gap-3 px-4 py-4 max-sm:grid-cols-1"
              key={index}
            >
              <div className="flex min-w-0 items-center gap-3">
                <SkeletonBlock className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-5 w-3/5" />
                  <SkeletonBlock className="mt-2 h-4 w-36" />
                </div>
              </div>
              <SkeletonBlock className="h-5 w-20" />
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

export function PlayerLeaderboardSkeleton() {
  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SkeletonBlock className="h-7 w-36" />
          <SkeletonBlock className="mt-3 h-4 w-80 max-w-full" />
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/[0.045] p-1">
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="ml-1 h-10 w-20" />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
        <div className="grid grid-cols-[80px_1fr_140px_180px] gap-3 border-b border-white/10 px-4 py-3 max-md:hidden">
          <SkeletonBlock className="h-4 w-10" />
          <SkeletonBlock className="h-4 w-12" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
        <div className="divide-y divide-white/10">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className="grid grid-cols-[80px_1fr_140px_180px] gap-3 px-4 py-4 max-md:grid-cols-2"
              key={index}
            >
              <SkeletonBlock className="h-7 w-12" />
              <div className="min-w-0">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="mt-2 h-4 w-56 max-w-full" />
              </div>
              <SkeletonBlock className="h-5 w-16" />
              <SkeletonBlock className="h-4 w-32" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
