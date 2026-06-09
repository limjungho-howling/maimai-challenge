"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface PlayerSharePieChartItem {
  profileId: string;
  playerName: string;
  percent: number;
  value: number;
}

const CHART_COLORS = [
  "#67e8f9",
  "#fbbf24",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#60a5fa",
  "#f97316",
  "#c084fc",
  "#2dd4bf",
  "#f472b6",
];
const MOBILE_LABEL_EDGE_PADDING = 74;
const DESKTOP_LABEL_EDGE_PADDING = 96;

export function PlayerSharePieChart({
  emptyMessage,
  players,
  unit,
}: {
  emptyMessage: string;
  players: PlayerSharePieChartItem[];
  unit: string;
}) {
  const chartData = players
    .filter((player) => player.value > 0 && player.percent > 0)
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }
      return left.playerName.localeCompare(right.playerName);
    })
    .map((player, index) => ({
      ...player,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

  if (chartData.length === 0) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
        <div className="text-sm text-slate-300">{emptyMessage}</div>
      </section>
    );
  }

  return (
    <section className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.045] p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex h-[360px] min-w-0 items-center sm:h-[min(48vw,460px)] lg:h-[min(42vw,500px)]">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Pie
              cx="50%"
              cy="50%"
              data={chartData}
              dataKey="percent"
              endAngle={-270}
              innerRadius="34%"
              label={renderPieLabel}
              labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
              nameKey="playerName"
              outerRadius="56%"
              paddingAngle={1}
              startAngle={90}
              stroke="#0f172a"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell fill={entry.color} key={entry.profileId} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) {
                  return null;
                }

                const item = payload[0].payload as (typeof chartData)[number];
                return (
                  <div className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm shadow-xl">
                    <div className="font-medium text-white">{item.playerName}</div>
                    <div className="mt-1 font-mono text-cyan-100">
                      {item.percent.toFixed(2)}%
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.value.toLocaleString("ko-KR")}
                      {unit}
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid content-center gap-2">
        {chartData.map((player) => (
          <div
            className="grid grid-cols-[14px_minmax(0,1fr)_64px] items-center gap-2 rounded-md border border-white/10 px-3 py-2"
            key={player.profileId}
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: player.color }}
            />
            <span className="truncate text-sm text-slate-100">{player.playerName}</span>
            <span className="font-mono text-sm text-cyan-100">
              {player.percent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function renderPieLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  payload,
  viewBox,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  payload?: PlayerSharePieChartItem;
  viewBox?: {
    height?: number;
    width?: number;
    x?: number;
    y?: number;
  };
}) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof outerRadius !== "number" ||
    !payload ||
    payload.percent < 3
  ) {
    return null;
  }

  const chartWidth = viewBox?.width;
  const chartX = viewBox?.x ?? 0;
  const isMobileWidth = typeof chartWidth === "number" && chartWidth < 520;
  const radius = outerRadius + (isMobileWidth ? 18 : 30);
  const radians = (-midAngle * Math.PI) / 180;
  const rawX = cx + radius * Math.cos(radians);
  const y = cy + radius * Math.sin(radians);
  const edgePadding = isMobileWidth
    ? MOBILE_LABEL_EDGE_PADDING
    : DESKTOP_LABEL_EDGE_PADDING;
  const minX = chartX + edgePadding;
  const maxX =
    typeof chartWidth === "number"
      ? chartX + chartWidth - edgePadding
      : Number.POSITIVE_INFINITY;
  const x = Math.min(Math.max(rawX, minX), maxX);
  const anchor = rawX > cx ? "start" : "end";
  const fontSize = isMobileWidth ? 11 : 12;

  return (
    <text
      dominantBaseline="central"
      fill="#e2e8f0"
      fontSize={fontSize}
      textAnchor={anchor}
      x={x}
      y={y}
    >
      <tspan fontWeight={600} x={x}>
        {payload.playerName}
      </tspan>
      <tspan fill="#67e8f9" fontFamily="monospace" x={x} dy={16}>
        {payload.percent.toFixed(2)}%
      </tspan>
    </text>
  );
}
