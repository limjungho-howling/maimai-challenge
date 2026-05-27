"use client";

import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { isAllowedRelayOrigin } from "@/lib/ingest/relay";

type RelayState =
  | { status: "idle"; message: string }
  | { status: "collecting"; message: string }
  | { status: "uploading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

interface RelayReceiverProps {
  isLoggedIn: boolean;
}

interface RelayMessage {
  type?: string;
  message?: string;
  difficulty?: number;
  payload?: unknown;
}

export function RelayReceiver({ isLoggedIn }: RelayReceiverProps) {
  const [state, setState] = useState<RelayState>({
    status: isLoggedIn ? "idle" : "error",
    message: isLoggedIn
      ? "북마클릿에서 보내는 데이터를 기다리고 있습니다."
      : "Discord 로그인이 필요합니다.",
  });

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    async function handleMessage(event: MessageEvent<RelayMessage>) {
      if (!isAllowedRelayOrigin(event.origin)) {
        return;
      }

      if (event.data.type === "maimai-challenge:status") {
        setState({
          status: "collecting",
          message: event.data.message ?? "공식 페이지 데이터를 수집 중입니다.",
        });
      }

      if (event.data.type === "maimai-challenge:progress") {
        setState({
          status: "collecting",
          message: `난이도 ${event.data.difficulty} 데이터를 받았습니다.`,
        });
      }

      if (event.data.type === "maimai-challenge:error") {
        setState({
          status: "error",
          message: event.data.message ?? "북마클릿 수집 중 오류가 발생했습니다.",
        });
      }

      if (event.data.type === "maimai-challenge:payload") {
        setState({ status: "uploading", message: "서버에 업로드하는 중입니다." });

        const response = await fetch("/api/ingest/maimai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event.data.payload),
        });
        const result = (await response.json()) as {
          playerName?: string;
          scoreCount?: number;
          changedChartCount?: number;
          error?: string;
        };

        if (!response.ok) {
          setState({
            status: "error",
            message: result.error ?? "업로드에 실패했습니다.",
          });
          return;
        }

        setState({
          status: "success",
          message: `${result.playerName}님 점수 ${result.scoreCount}개를 처리했습니다. 변동 차트 ${result.changedChartCount}개.`,
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
