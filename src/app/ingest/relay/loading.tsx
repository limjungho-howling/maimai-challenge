export default function IngestRelayLoading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#080b12,#111827_55%,#151620)] text-slate-100">
      <div className="mx-auto flex min-h-[420px] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">maimai 데이터 릴레이</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            북마클릿에서 보내는 데이터를 기다리고 있습니다.
          </p>
        </div>
        <div className="w-full">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-0 rounded-full bg-cyan-300" />
          </div>
          <div className="mt-2 font-mono text-xs text-slate-400">0%</div>
        </div>
      </div>
    </main>
  );
}
