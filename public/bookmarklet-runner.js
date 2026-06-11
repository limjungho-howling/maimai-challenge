(async function () {
  const script = document.currentScript;
  const APP_ORIGIN = script ? new URL(script.src).origin : "";
  const MAIMAI_ORIGIN = "https://maimaidx-eng.com";
  const MAIMAI_PATH_PREFIX = "/maimai-mobile/";
  const FETCH_RETRY_COUNT = 3;
  const FETCH_TIMEOUT_MS = 20000;
  const PLAYER_DATA_RETRY_COUNT = 5;
  const SCORE_DIFFICULTIES = [3, 4];
  const RELAY_READY_TIMEOUT_MS = 120000;

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

  const notifyStatus = function (message) {
    relay.postMessage(
      { type: "maimai-challenge:status", message },
      APP_ORIGIN,
    );
  };
  const waitForRelayReady = function () {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        window.removeEventListener("message", handleMessage);
        reject(
          new Error(
            "릴레이가 준비되지 않았습니다. 릴레이 창에서 Discord 로그인을 완료한 뒤 북마클릿을 다시 실행해주세요.",
          ),
        );
      }, RELAY_READY_TIMEOUT_MS);

      var handleMessage = function (event) {
        if (event.origin !== APP_ORIGIN) {
          return;
        }

        if (!event.data || event.data.type !== "maimai-challenge:relay-ready") {
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener("message", handleMessage);
        resolve();
      };

      window.addEventListener("message", handleMessage);
      relay.postMessage({ type: "maimai-challenge:hello" }, APP_ORIGIN);
    });
  };
  const fetchText = async function (path) {
    let lastError = null;

    for (let attempt = 1; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(function () {
        controller.abort();
      }, FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(path, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const error = new Error(path + " 로드 실패: " + response.status);
          error.status = response.status;
          throw error;
        }

        return await response.text();
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(path + " 로드 실패");
  };
  const hasValidPlayerData = function (html) {
    if (!html || !html.includes("name_block") || !html.includes("rating_block")) {
      return false;
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const name = doc.querySelector(".name_block");
    return Boolean(name && name.textContent && name.textContent.trim());
  };
  const fetchPlayerHtml = async function () {
    let lastHtml = "";

    for (let attempt = 1; attempt <= PLAYER_DATA_RETRY_COUNT; attempt += 1) {
      const html = await fetchText(
        "/maimai-mobile/playerData/?_=" + Date.now() + "_" + attempt,
      );
      lastHtml = html;

      if (hasValidPlayerData(html)) {
        return html;
      }

      notifyStatus(
        "플레이어 정보를 다시 확인하는 중입니다. " +
          attempt +
          " / " +
          PLAYER_DATA_RETRY_COUNT,
      );
    }

    throw new Error(
      "플레이어 정보를 가져오지 못했습니다. 공식 홈페이지에서 로그인 상태를 확인한 뒤 다시 실행해주세요. html=" +
        lastHtml.slice(0, 120).replace(/\s+/g, " "),
    );
  };

  try {
    await waitForRelayReady();
    notifyStatus("최근 플레이 기록과 MASTER/Re:MASTER 점수 목록을 수집하는 중입니다.");

    const playerHtml = await fetchPlayerHtml();
    const recentPlayHtml = await fetchText("/maimai-mobile/record/?_=" + Date.now());
    const scorePages = await Promise.all(
      SCORE_DIFFICULTIES.map(async function (difficulty) {
        const html = await fetchText(
          "/maimai-mobile/record/musicGenre/search/?genre=99&diff=" + difficulty,
        );
        relay.postMessage(
          { type: "maimai-challenge:progress", difficulty },
          APP_ORIGIN,
        );
        return { difficulty, html };
      }),
    );

    relay.postMessage(
      {
        type: "maimai-challenge:payload",
        uploadType: "score",
        payload: {
          playerHtml,
          recentPlayHtml,
          scorePages,
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
