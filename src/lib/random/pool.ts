export interface RandomPoolChart {
  chartId: string;
  title: string;
  jacketUrl: string | null;
  kind: string;
  difficulty: number;
  level: string;
  versionName: string | null;
}

export const MAX_POOL_SIZE = 200;

export const SPIN_FRAME_COUNT = 20;
export const SPIN_TOTAL_DURATION_MS = 3000;
export const REDUCED_MOTION_DURATION_MS = 400;

const SPIN_DELAY_GROWTH = 1.115;

export function addToPool(
  pool: RandomPoolChart[],
  chart: RandomPoolChart,
): RandomPoolChart[] {
  if (pool.length >= MAX_POOL_SIZE) {
    return pool;
  }

  if (pool.some((item) => item.chartId === chart.chartId)) {
    return pool;
  }

  return [...pool, chart];
}

/** Adds whatever fits; charts past the size limit are silently left out. */
export function addManyToPool(
  pool: RandomPoolChart[],
  charts: RandomPoolChart[],
): RandomPoolChart[] {
  return charts.reduce(addToPool, pool);
}

export function removeFromPool(
  pool: RandomPoolChart[],
  chartId: string,
): RandomPoolChart[] {
  return pool.filter((item) => item.chartId !== chartId);
}

export function drawFrom(
  pool: RandomPoolChart[],
  random: () => number = Math.random,
): RandomPoolChart | null {
  if (pool.length === 0) {
    return null;
  }

  return pickAt(pool, random);
}

/**
 * Frames the draw animation walks through. The last frame is always the winner,
 * so the visible card lands on the chart that was already decided by `drawFrom`.
 */
export function buildSpinSequence(
  pool: RandomPoolChart[],
  winner: RandomPoolChart,
  random: () => number = Math.random,
  frameCount: number = SPIN_FRAME_COUNT,
): RandomPoolChart[] {
  if (pool.length === 0 || frameCount < 1) {
    return [];
  }

  const sequence: RandomPoolChart[] = [];

  for (let index = 0; index < frameCount - 1; index += 1) {
    const excluded = new Set<string>();
    const previous = sequence[sequence.length - 1];

    if (previous) {
      excluded.add(previous.chartId);
    }

    // Keep the frame before the landing frame different from the winner so the
    // card visibly changes on the final swap.
    if (index === frameCount - 2) {
      excluded.add(winner.chartId);
    }

    sequence.push(pickExcluding(pool, excluded, random));
  }

  sequence.push(winner);

  return sequence;
}

/**
 * Delay before each frame, growing geometrically so the card slows to a stop.
 * The delays always add up to exactly `totalDurationMs`.
 */
export function spinFrameDelays(
  frameCount: number,
  totalDurationMs: number = SPIN_TOTAL_DURATION_MS,
): number[] {
  if (frameCount < 1) {
    return [];
  }

  const weights = Array.from({ length: frameCount }, (_, index) =>
    SPIN_DELAY_GROWTH ** index,
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const delays = weights.map((weight) =>
    Math.round((weight / weightSum) * totalDurationMs),
  );
  const rounded = delays.reduce((sum, delay) => sum + delay, 0);

  delays[delays.length - 1] += totalDurationMs - rounded;

  return delays;
}

function pickExcluding(
  pool: RandomPoolChart[],
  excluded: Set<string>,
  random: () => number,
): RandomPoolChart {
  const candidates = pool.filter((item) => !excluded.has(item.chartId));
  return pickAt(candidates.length > 0 ? candidates : pool, random);
}

function pickAt(
  pool: RandomPoolChart[],
  random: () => number,
): RandomPoolChart {
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index];
}
