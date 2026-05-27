export function buildBookmarklet(appOrigin: string): string {
  const bookmarkletUrl = `${appOrigin.replace(/\/$/, "")}/bookmarklet.js`;
  const source = `(function(){var s=document.createElement('script');s.src=${JSON.stringify(
    bookmarkletUrl,
  )}+'?t='+Date.now();s.async=true;document.body.appendChild(s);})();`;

  return `javascript:${encodeURIComponent(source)}`;
}
