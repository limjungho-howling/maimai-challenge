function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

export function RandomPickerSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col items-center gap-5 rounded-lg border border-white/10 bg-white/[0.045] px-4 py-8">
          <SkeletonBlock className="h-4 w-56" />
          <SkeletonBlock className="h-72 w-full max-w-md" />
          <SkeletonBlock className="h-12 w-44" />
        </section>
        <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <SkeletonBlock className="h-6 w-24" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SkeletonBlock className="h-11 w-full sm:col-span-2" />
            <SkeletonBlock className="h-11 w-full" />
            <SkeletonBlock className="h-11 w-full" />
            <SkeletonBlock className="h-11 w-full sm:col-span-2" />
          </div>
          <SkeletonBlock className="h-64 w-full" />
        </section>
      </div>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <SkeletonBlock className="h-6 w-32" />
          <SkeletonBlock className="h-40 w-full" />
        </section>
        <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <SkeletonBlock className="h-6 w-28" />
          <SkeletonBlock className="h-40 w-full" />
        </section>
      </div>
    </div>
  );
}
