"use client";

import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { isAllowedRelayOrigin } from "@/lib/ingest/relay";

type RelayState =
  | { status: "idle"; message: string; progress: number }
  | { status: "collecting"; message: string; progress: number }
  | { status: "uploading"; message: string; progress: number }
  | { status: "success"; message: string; progress: number }
  | { status: "error"; message: string; progress: number };

interface RelayReceiverProps {
  isLoggedIn: boolean;
}

interface RelayMessage {
  type?: string;
  message?: string;
  difficulty?: number;
  current?: number;
  total?: number;
  uploadType?: "score" | "catalog";
  payload?: unknown;
}

interface IngestStreamEvent {
  type?: string;
  progress?: {
    message: string;
    current: number;
    total: number;
  };
  result?: {
    playerName?: string;
    scoreCount?: number;
    skippedChartCount?: number;
    changedChartCount?: number;
    songCount?: number;
    chartCount?: number;
  };
  error?: string;
}

export function RelayReceiver({ isLoggedIn }: RelayReceiverProps) {
  const [state, setState] = useState<RelayState>({
    status: isLoggedIn ? "idle" : "error",
    message: isLoggedIn
      ? "북마클릿에서 보내는 데이터를 기다리고 있습니다."
      : "Discord 로그인이 필요합니다.",
    progress: isLoggedIn ? 0 : 100,
  });

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    window.opener?.postMessage(
      { type: "maimai-challenge:relay-ready" },
      "https://maimaidx-eng.com",
    );

    async function handleMessage(event: MessageEvent<RelayMessage>) {
      if (!isAllowedRelayOrigin(event.origin)) {
        return;
      }

      if (event.data.type === "maimai-challenge:hello") {
        window.opener?.postMessage(
          { type: "maimai-challenge:relay-ready" },
          "https://maimaidx-eng.com",
        );
      }

      if (event.data.type === "maimai-challenge:status") {
        setState({
          status: "collecting",
          message: event.data.message ?? "공식 페이지 데이터를 수집 중입니다.",
          progress: 5,
        });
      }

      if (event.data.type === "maimai-challenge:progress") {
        const difficulty = event.data.difficulty ?? 0;
        setState({
          status: "collecting",
          message: `난이도 ${difficulty} 데이터를 받았습니다.`,
          progress: Math.min(30, 10 + (difficulty + 1) * 4),
        });
      }

      if (event.data.type === "maimai-challenge:detail-progress") {
        const current = event.data.current ?? 0;
        const total = Math.max(1, event.data.total ?? 1);
        setState({
          status: "collecting",
          message: `곡 재킷 정보를 수집하는 중입니다. ${current.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")}`,
          progress: Math.min(45, 30 + Math.round((current / total) * 15)),
        });
      }

      if (event.data.type === "maimai-challenge:error") {
        setState({
          status: "error",
          message: event.data.message ?? "북마클릿 수집 중 오류가 발생했습니다.",
          progress: 100,
        });
      }

      if (event.data.type === "maimai-challenge:payload") {
        const uploadType = event.data.uploadType ?? "score";
        setState({
          status: "uploading",
          message:
            uploadType === "catalog"
              ? "곡 카탈로그를 서버에 업로드하는 중입니다."
              : "점수를 서버에 업로드하는 중입니다.",
          progress: 32,
        });

        const response = await fetch(
          uploadType === "catalog" ? "/api/ingest/catalog" : "/api/ingest/maimai",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event.data.payload),
          },
        );

        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          setState({
            status: "error",
            message: result.error ?? "업로드에 실패했습니다.",
            progress: 100,
          });
          return;
        }

        await readIngestStream(response, (streamEvent) => {
          if (streamEvent.type === "progress" && streamEvent.progress) {
            const total = Math.max(1, streamEvent.progress.total);
            const percent = Math.round((streamEvent.progress.current / total) * 100);
            setState({
              status: "uploading",
              message: streamEvent.progress.message,
              progress: Math.max(32, Math.min(99, percent)),
            });
          }

          if (streamEvent.type === "error") {
            setState({
              status: "error",
              message: streamEvent.error ?? "업로드 처리 중 오류가 발생했습니다.",
              progress: 100,
            });
          }

          if (streamEvent.type === "result" && streamEvent.result) {
            const skippedChartCount = streamEvent.result.skippedChartCount ?? 0;
            const message =
              uploadType === "catalog"
                ? `곡 ${streamEvent.result.songCount}개, 차트 ${streamEvent.result.chartCount}개 정보를 저장했습니다.`
                : `${streamEvent.result.playerName}님 점수 ${streamEvent.result.scoreCount}개를 처리했습니다. 변동 차트 ${streamEvent.result.changedChartCount}개.${skippedChartCount > 0 ? ` 미등록 차트 ${skippedChartCount}개는 생략했습니다.` : ""}`;
            setState({
              status: "success",
              message,
              progress: 100,
            });
          }
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isLoggedIn]);

  const Icon =
    state.status === "success"
      ? CheckCircle2
      : state.status === "error"
        ? ShieldAlert
        : Loader2;

  return (
    <div className="mx-auto flex min-h-[420px] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/8">
        <Icon
          className={`h-8 w-8 ${state.status === "collecting" || state.status === "uploading" ? "animate-spin" : ""}`}
        />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-white">maimai 데이터 릴레이</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{state.message}</p>
      </div>
      <div className="w-full">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-300 transition-[width] duration-300"
            style={{ width: `${state.progress}%` }}
          />
        </div>
        <div className="mt-2 font-mono text-xs text-slate-400">{state.progress}%</div>
      </div>
      {!isLoggedIn ? (
        <a
          className="inline-flex h-10 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950"
          href="/auth/login?next=/ingest/relay"
        >
          Discord로 로그인
        </a>
      ) : null}
    </div>
  );
}

async function readIngestStream(
  response: Response,
  onEvent: (event: IngestStreamEvent) => void,
): Promise<void> {
  if (!response.body) {
    onEvent({ type: "error", error: "업로드 응답 스트림을 읽을 수 없습니다." });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      onEvent(JSON.parse(trimmed) as IngestStreamEvent);
    }
  }

  const finalLine = buffer.trim();
  if (finalLine) {
    onEvent(JSON.parse(finalLine) as IngestStreamEvent);
  }
}
