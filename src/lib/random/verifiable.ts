/**
 * Verifiable draw algorithm.
 *
 * A draw is decided by randomness that did not exist when the pool was locked,
 * so nobody — not the drawer, not this server — can steer or grind the result.
 * Anyone can recompute it from public data:
 *
 *   message     = poolChartIds joined with "\n", in committed order
 *   poolHash    = SHA-256(message)                        (published at commit)
 *   randomness  = drand quicknet round N randomness       (published by drand)
 *   digest      = HMAC-SHA-256(key = randomness bytes, message)
 *   winnerIndex = BigInt(digest) mod poolSize
 *
 * Keep this file in sync with the verification steps shown on the draw page.
 */

export const POOL_MESSAGE_SEPARATOR = "\n";

export function buildPoolMessage(chartIds: string[]): string {
  return chartIds.join(POOL_MESSAGE_SEPARATOR);
}

export async function hashPool(chartIds: string[]): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(buildPoolMessage(chartIds)),
  );

  return toHex(new Uint8Array(digest));
}

export async function pickWinnerIndex(
  randomnessHex: string,
  chartIds: string[],
): Promise<number> {
  if (chartIds.length === 0) {
    throw new Error("Cannot pick a winner from an empty pool");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    fromHex(randomnessHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(buildPoolMessage(chartIds)),
  );

  // The digest is 256 bits and the pool holds at most a few hundred charts, so
  // the modulo bias is far below any observable threshold.
  const digest = BigInt(`0x${toHex(new Uint8Array(signature))}`);

  return Number(digest % BigInt(chartIds.length));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const normalized = hex.trim().toLowerCase();

  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    throw new Error("Randomness must be a non-empty hex string");
  }

  if (!/^[0-9a-f]+$/.test(normalized)) {
    throw new Error("Randomness must be a hex string");
  }

  const bytes = new Uint8Array(new ArrayBuffer(normalized.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}
