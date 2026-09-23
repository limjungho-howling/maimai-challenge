/**
 * drand quicknet beacon: a public randomness chain that publishes a new value
 * every 3 seconds. A draw commits to a round that has not happened yet, so the
 * value deciding the winner does not exist at commit time.
 *
 * Anyone can re-fetch a round from the same public URL to check a draw.
 */
export const DRAND_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
export const DRAND_PERIOD_SECONDS = 3;
export const DRAND_GENESIS_TIME_SECONDS = 1692803367;

/** How far ahead of "now" a draw commits. 3 rounds ≈ 9 seconds. */
export const DRAND_ROUND_OFFSET = 3;

const DRAND_API_BASE = "https://api.drand.sh";

export function drandRoundUrl(round: number): string {
  return `${DRAND_API_BASE}/${DRAND_CHAIN_HASH}/public/${round}`;
}

/** The most recent round that has already been published at `atMs`. */
export function currentRoundAt(atMs: number): number {
  const elapsedSeconds = Math.floor(atMs / 1000) - DRAND_GENESIS_TIME_SECONDS;

  if (elapsedSeconds < 0) {
    return 0;
  }

  return Math.floor(elapsedSeconds / DRAND_PERIOD_SECONDS) + 1;
}

/** Wall-clock time at which `round` becomes available. */
export function roundAvailableAtMs(round: number): number {
  return (
    (DRAND_GENESIS_TIME_SECONDS + (round - 1) * DRAND_PERIOD_SECONDS) * 1000
  );
}

/**
 * The round a draw committed at `atMs` should use. Always strictly in the
 * future so the randomness cannot already be known.
 */
export function targetRoundAt(
  atMs: number,
  offset: number = DRAND_ROUND_OFFSET,
): number {
  return currentRoundAt(atMs) + Math.max(1, offset);
}

export interface DrandRound {
  round: number;
  randomness: string;
  signature: string;
}

export async function fetchDrandRound(round: number): Promise<DrandRound> {
  const response = await fetch(drandRoundUrl(round), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`drand round ${round} is not available yet`);
  }

  const body = (await response.json()) as Partial<DrandRound>;

  if (
    typeof body.randomness !== "string" ||
    typeof body.signature !== "string" ||
    body.round !== round
  ) {
    throw new Error(`drand round ${round} returned an unexpected payload`);
  }

  return { round, randomness: body.randomness, signature: body.signature };
}
