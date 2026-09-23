import { MAX_POOL_SIZE, type RandomPoolChart } from "@/lib/random/pool";

export const RANDOM_POOL_STORAGE_KEY = "maimai-challenge:random-pool:v1";

export interface RandomPoolState {
  pool: RandomPoolChart[];
  drawn: RandomPoolChart[];
}

export function emptyRandomPoolState(): RandomPoolState {
  return { pool: [], drawn: [] };
}

/**
 * Anything we cannot fully trust — malformed JSON, a hand-edited entry, a list
 * grown past the cap — collapses to an empty state instead of throwing.
 */
export function parseStoredState(raw: string | null): RandomPoolState {
  if (!raw) {
    return emptyRandomPoolState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyRandomPoolState();
  }

  if (typeof parsed !== "object" || parsed === null) {
    return emptyRandomPoolState();
  }

  const pool = parseChartList((parsed as Record<string, unknown>).pool);
  const drawn = parseChartList((parsed as Record<string, unknown>).drawn);

  if (!pool || !drawn || pool.length + drawn.length > MAX_POOL_SIZE) {
    return emptyRandomPoolState();
  }

  return { pool, drawn };
}

export function readStoredState(): RandomPoolState {
  try {
    return parseStoredState(window.localStorage.getItem(RANDOM_POOL_STORAGE_KEY));
  } catch {
    return emptyRandomPoolState();
  }
}

export function writeStoredState(state: RandomPoolState): void {
  try {
    window.localStorage.setItem(RANDOM_POOL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, quota). Losing the pool is
    // acceptable; breaking the page is not.
  }
}

function parseChartList(value: unknown): RandomPoolChart[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const charts: RandomPoolChart[] = [];

  for (const item of value) {
    const chart = parseChart(item);
    if (!chart) {
      return null;
    }
    charts.push(chart);
  }

  return charts;
}

function parseChart(value: unknown): RandomPoolChart | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.chartId !== "string" ||
    typeof row.title !== "string" ||
    typeof row.kind !== "string" ||
    typeof row.level !== "string" ||
    typeof row.difficulty !== "number" ||
    !Number.isInteger(row.difficulty)
  ) {
    return null;
  }

  return {
    chartId: row.chartId,
    title: row.title,
    jacketUrl: typeof row.jacketUrl === "string" ? row.jacketUrl : null,
    kind: row.kind,
    difficulty: row.difficulty,
    level: row.level,
    versionName: typeof row.versionName === "string" ? row.versionName : null,
  };
}
