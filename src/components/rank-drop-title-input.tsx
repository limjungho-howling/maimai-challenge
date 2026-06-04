"use client";

import { useState } from "react";

import { DISCORD_HEADING_TITLE_MAX_LENGTH } from "@/lib/discord/title";

export function RankDropTitleInput({
  defaultValue,
  name,
  placeholder,
}: {
  defaultValue: string;
  name: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(
    defaultValue.slice(0, DISCORD_HEADING_TITLE_MAX_LENGTH),
  );
  const isAtLimit = value.length >= DISCORD_HEADING_TITLE_MAX_LENGTH;

  return (
    <span className="grid gap-1">
      <input
        className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
        maxLength={DISCORD_HEADING_TITLE_MAX_LENGTH}
        name={name}
        onChange={(event) =>
          setValue(event.target.value.slice(0, DISCORD_HEADING_TITLE_MAX_LENGTH))
        }
        placeholder={placeholder}
        type="text"
        value={value}
      />
      <span className="flex items-center justify-between gap-3 text-xs">
        <span className={isAtLimit ? "text-amber-200" : "text-slate-500"}>
          {isAtLimit
            ? `최대 ${DISCORD_HEADING_TITLE_MAX_LENGTH}자까지 입력할 수 있습니다.`
            : "Discord 제목 영역에서 잘리지 않도록 제한됩니다."}
        </span>
        <span className="shrink-0 text-slate-500">
          {value.length}/{DISCORD_HEADING_TITLE_MAX_LENGTH}
        </span>
      </span>
    </span>
  );
}
