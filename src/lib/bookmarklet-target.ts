const MAIMAI_MOBILE_ORIGIN = "https://maimaidx-eng.com";
const MAIMAI_MOBILE_PATH_PREFIX = "/maimai-mobile/";

export function isAllowedMaimaiMobileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === MAIMAI_MOBILE_ORIGIN &&
      (url.pathname === "/maimai-mobile" ||
        url.pathname.startsWith(MAIMAI_MOBILE_PATH_PREFIX))
    );
  } catch {
    return false;
  }
}
