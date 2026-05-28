(async function () {
  const script = document.currentScript;
  const APP_ORIGIN = script ? new URL(script.src).origin : "";
  const MAIMAI_ORIGIN = "https://maimaidx-eng.com";
  const MAIMAI_PATH_PREFIX = "/maimai-mobile/";

  if (
    location.origin !== MAIMAI_ORIGIN ||
    !(
      location.pathname === "/maimai-mobile" ||
      location.pathname.startsWith(MAIMAI_PATH_PREFIX)
    )
  ) {
    alert("https://maimaidx-eng.com/maimai-mobile/ 로 시작하는 공식 페이지에서 실행해주세요.");
    return;
  }

  if (!APP_ORIGIN) {
    alert("북마클릿 주소를 확인할 수 없습니다.");
    return;
  }

  const relay = window.open(
    APP_ORIGIN + "/ingest/relay",
    "maimaiChallengeRelay",
    "popup,width=520,height=720",
  );

  if (!relay) {
    alert("팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 실행해주세요.");
    return;
  }

  const fetchText = async function (path) {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(path + " 로드 실패: " + response.status);
    }
    return await response.text();
  };
  const parallelMap = async function (items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async function () {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await mapper(items[index], index);
      }
    });
    await Promise.all(workers);
    return results;
  };
  const extractDetailTargets = function (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.querySelectorAll('input[type="hidden"][name="idx"]'))
      .map(function (input) {
        return input.value;
      })
      .filter(Boolean);
  };

  try {
    relay.postMessage(
      {
        type: "maimai-challenge:status",
        message: "공식 페이지에서 데이터를 수집하는 중입니다.",
      },
      APP_ORIGIN,
    );

    const playerHtml = await fetchText("/maimai-mobile/playerData/");
    const scorePages = [];
    const detailTargets = [];

    for (const difficulty of [3, 4]) {
      const html = await fetchText(
        "/maimai-mobile/record/musicGenre/search/?genre=99&diff=" + difficulty,
      );
      scorePages.push({ difficulty, html });
      detailTargets.push.apply(detailTargets, extractDetailTargets(html));
      relay.postMessage(
        { type: "maimai-challenge:progress", difficulty },
        APP_ORIGIN,
      );
    }

    const uniqueDetailTargets = Array.from(new Set(detailTargets));
    let detailDone = 0;
    const detailPages = await parallelMap(uniqueDetailTargets, 8, async function (idx) {
      const html = await fetchText(
        "/maimai-mobile/record/musicDetail/?idx=" + encodeURIComponent(idx),
      );
      detailDone += 1;
      relay.postMessage(
        {
          type: "maimai-challenge:detail-progress",
          current: detailDone,
          total: uniqueDetailTargets.length,
        },
        APP_ORIGIN,
      );
      return { idx, html };
    });

    relay.postMessage(
      {
        type: "maimai-challenge:payload",
        payload: {
          playerHtml,
          scorePages,
          detailPages,
          collectedAt: new Date().toISOString(),
        },
      },
      APP_ORIGIN,
    );
  } catch (error) {
    relay.postMessage(
      {
        type: "maimai-challenge:error",
        message:
          error instanceof Error
            ? error.message
            : "수집 중 오류가 발생했습니다.",
      },
      APP_ORIGIN,
    );
  }
})();
