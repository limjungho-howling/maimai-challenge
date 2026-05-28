"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildBookmarklet, type BookmarkletKind } from "@/lib/bookmarklet";

interface BookmarkletButtonProps {
  appOrigin: string;
  kind?: BookmarkletKind;
  label?: string;
}

export function BookmarkletButton({
  appOrigin,
  kind = "score",
  label = "maimai 갱신",
}: BookmarkletButtonProps) {
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const href = useMemo(() => buildBookmarklet(appOrigin, kind), [appOrigin, kind]);

  useEffect(() => {
    linkRef.current?.setAttribute("href", href);
  }, [href]);

  async function copyBookmarklet() {
    await navigator.clipboard.writeText(href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        href="#"
        ref={linkRef}
        title="이 링크를 북마크바로 드래그하세요"
      >
        <ExternalLink className="h-4 w-4" />
        {label}
      </a>
      <button
        className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10"
        onClick={copyBookmarklet}
        type="button"
      >
        <Copy className="h-4 w-4" />
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
