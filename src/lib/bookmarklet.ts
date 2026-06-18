export type BookmarkletKind = "score" | "catalog" | "new-catalog";

const SCRIPT_BY_KIND: Record<BookmarkletKind, string> = {
  catalog: "catalog-bookmarklet.js",
  "new-catalog": "new-catalog-bookmarklet.js",
  score: "bookmarklet.js",
};

export function buildBookmarklet(
  appOrigin: string,
  kind: BookmarkletKind = "score",
): string {
  const scriptName = SCRIPT_BY_KIND[kind];
  const normalizedOrigin = appOrigin.replace(/\/$/, "");
  const bookmarkletUrl = `${normalizedOrigin}/${scriptName}`;
  const relayUrl = `${normalizedOrigin}/ingest/relay`;
  const source = `(function(){var o=${JSON.stringify(
    normalizedOrigin,
  )};var p=location.pathname;var ok=location.origin==='https://maimaidx-eng.com'&&(p==='/maimai-mobile'||p.indexOf('/maimai-mobile/')===0);window.__MAIMAI_CHALLENGE_APP_ORIGIN=o;if(ok){window.__MAIMAI_CHALLENGE_RELAY_WINDOW=window.open(${JSON.stringify(
    relayUrl,
  )},'maimaiChallengeRelay','popup,width=520,height=720');}var s=document.createElement('script');s.src=${JSON.stringify(
    bookmarkletUrl,
  )}+'?t='+Date.now();s.async=true;document.body.appendChild(s);})();`;

  return `javascript:${encodeURIComponent(source)}`;
}
