"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ChartSort } from "@/lib/data/charts";

export function ChartSortSelect({ value }: { value: ChartSort }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      className="h-11 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300 sm:w-56"
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        const nextSort = event.currentTarget.value;

        if (nextSort === "recent") {
          params.delete("sort");
        } else {
          params.set("sort", nextSort);
        }

        params.delete("page");

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
      value={value}
    >
      <option value="recent">최근 변동순</option>
      <option value="fewest-five-stars">5성 적은 순</option>
    </select>
  );
}
