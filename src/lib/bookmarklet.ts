export type BookmarkletKind = "score" | "catalog";

const SCRIPT_BY_KIND: Record<BookmarkletKind, string> = {
  catalog: "catalog-bookmarklet.js",
  score: "bookmarklet.js",
};

export function buildBookmarklet(
  appOrigin: string,
  kind: BookmarkletKind = "score",
): string {
  const scriptName = SCRIPT_BY_KIND[kind];
  const bookmarkletUrl = `${appOrigin.replace(/\/$/, "")}/${scriptName}`;
  const source = `(function(){var s=document.createElement('script');s.src=${JSON.stringify(
    bookmarkletUrl,
  )}+'?t='+Date.now();s.async=true;document.body.appendChild(s);})();`;

  return `javascript:${encodeURIComponent(source)}`;
}
