export function buildBookmarklet(appOrigin: string): string {
  const source = `
(async function(){
  const APP_ORIGIN = ${JSON.stringify(appOrigin)};
  const MAIMAI_ORIGIN = "https://maimaidx-eng.com";
  if (location.origin !== MAIMAI_ORIGIN) {
    alert("maimaiDX International 공식 홈페이지에서 실행해주세요.");
    return;
  }
  const relay = window.open(APP_ORIGIN + "/ingest/relay", "maimaiChallengeRelay", "popup,width=520,height=720");
  if (!relay) {
    alert("팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 실행해주세요.");
    return;
  }
  const fetchText = async function(path) {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) throw new Error(path + " 로드 실패: " + response.status);
    return await response.text();
  };
  try {
    relay.postMessage({ type: "maimai-challenge:status", message: "공식 페이지에서 데이터를 수집하는 중입니다." }, APP_ORIGIN);
    const playerHtml = await fetchText("/maimai-mobile/playerData/");
    const scorePages = [];
    for (const difficulty of [0,1,2,3,4]) {
      const html = await fetchText("/maimai-mobile/record/musicGenre/search/?genre=99&diff=" + difficulty);
      scorePages.push({ difficulty, html });
      relay.postMessage({ type: "maimai-challenge:progress", difficulty }, APP_ORIGIN);
    }
    relay.postMessage({
      type: "maimai-challenge:payload",
      payload: { playerHtml, scorePages, collectedAt: new Date().toISOString() }
    }, APP_ORIGIN);
  } catch (error) {
    relay.postMessage({
      type: "maimai-challenge:error",
      message: error instanceof Error ? error.message : "수집 중 오류가 발생했습니다."
    }, APP_ORIGIN);
  }
})();`;

  return `javascript:${encodeURIComponent(source)}`;
}
