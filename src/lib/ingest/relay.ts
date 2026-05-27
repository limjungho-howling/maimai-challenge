export const MAIMAI_ORIGIN = "https://maimaidx-eng.com";

export function isAllowedRelayOrigin(origin: string): boolean {
  return origin === MAIMAI_ORIGIN;
}
