export type BookmarkletKind = "score" | "catalog";

export function buildBookmarklet(
  appOrigin: string,
  kind: BookmarkletKind = "score",
): string {
  const scriptName = kind === "catalog" ? "catalog-bookmarklet.js" : "bookmarklet.js";
  const bookmarkletUrl = `${appOrigin.replace(/\/$/, "")}/${scriptName}`;
  const source = `(function(){var s=document.createElement('script');s.src=${JSON.stringify(
    bookmarkletUrl,
  )}+'?t='+Date.now();s.async=true;document.body.appendChild(s);})();`;

  return `javascript:${encodeURIComponent(source)}`;
}
