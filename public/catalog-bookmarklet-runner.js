(async function () {
  const script = document.currentScript;
  const APP_ORIGIN = script ? new URL(script.src).origin : "";
  const RUNNER_SCOPE = script ? new URL(script.src).searchParams.get("scope") : "";
  const MAIMAI_ORIGIN = "https://maimaidx-eng.com";
  const MAIMAI_PATH_PREFIX = "/maimai-mobile/";
  const FETCH_RETRY_COUNT = 3;
  const FETCH_TIMEOUT_MS = 20000;
  const RELAY_READY_TIMEOUT_MS = 120000;
  const UPLOAD_COMPLETE_TIMEOUT_MS = 300000;
  const RECOVERY_ROUND_COUNT = 3;
  const REQUEST_INTERVAL_MS = 100;
  const SCORE_DIFFICULTIES = [3, 4];
  const ALL_VERSIONS = [
    [0, "maimai"],
    [1, "maimai PLUS"],
    [2, "GreeN"],
    [3, "GreeN PLUS"],
    [4, "ORANGE"],
    [5, "ORANGE PLUS"],
    [6, "PiNK"],
    [7, "PiNK PLUS"],
    [8, "MURASAKi"],
    [9, "MURASAKi PLUS"],
    [10, "MiLK"],
    [11, "MiLK PLUS"],
    [12, "FiNALE"],
    [13, "でらっくす"],
    [14, "でらっくす PLUS"],
    [15, "スプラッシュ"],
    [16, "スプラッシュ PLUS"],
    [17, "UNiVERSE"],
    [18, "UNiVERSE PLUS"],
    [19, "FESTiVAL"],
    [20, "FESTiVAL PLUS"],
    [21, "BUDDiES"],
    [22, "BUDDiES PLUS"],
    [23, "PRiSM"],
    [24, "PRiSM PLUS"],
    [25, "CiRCLE"],
  ];
  const VERSIONS = RUNNER_SCOPE === "circle" ? [[25, "CiRCLE"]] : ALL_VERSIONS;

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

  const wait = function (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  };
  const notifyStatus = function (message) {
    relay.postMessage(
      { type: "maimai-challenge:status", message },
      APP_ORIGIN,
    );
  };
  const postCatalogPayload = function (uploadId, scorePages, detailPages) {
    relay.postMessage(
      {
        type: "maimai-challenge:payload",
        uploadId,
        uploadType: "catalog",
        payload: {
          scorePages,
          detailPages,
        },
      },
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
  const waitForUploadComplete = function (uploadId) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        window.removeEventListener("message", handleMessage);
        reject(new Error("업로드 완료 응답을 받지 못했습니다. 릴레이 창을 확인해주세요."));
      }, UPLOAD_COMPLETE_TIMEOUT_MS);

      var handleMessage = function (event) {
        if (event.origin !== APP_ORIGIN) {
          return;
        }

        if (
          !event.data ||
          event.data.type !== "maimai-challenge:upload-complete" ||
          event.data.uploadId !== uploadId
        ) {
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener("message", handleMessage);

        if (event.data.ok) {
          resolve();
          return;
        }

        reject(new Error(event.data.message || "업로드에 실패했습니다."));
      };

      window.addEventListener("message", handleMessage);
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

        if (!response.ok) {
          const error = new Error(path + " 로드 실패: " + response.status);
          error.status = response.status;
          throw error;
        }

        const text = await response.text();
        clearTimeout(timeout);
        return text;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (attempt < FETCH_RETRY_COUNT) {
          await wait(REQUEST_INTERVAL_MS);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(path + " 로드 실패");
  };
  const extractDetailRequests = function (html) {
    const document = new DOMParser().parseFromString(html, "text/html");
    return Array.from(document.querySelectorAll('form[action*="/record/musicDetail/"]'))
      .map(function (form) {
        const input = form.querySelector('input[type="hidden"][name="idx"]');
        const idx = input ? input.getAttribute("value") : null;
        return idx ? { idx } : null;
      })
      .filter(Boolean);
  };
  const collectScorePages = async function (requests, options) {
    const scorePages = [];
    const failedScorePages = [];
    const detailRequestsByIdx = new Map();
    const label =
      options && options.label
        ? options.label
        : "버전별 MASTER/Re:MASTER 곡 카탈로그를 수집하는 중입니다.";

    notifyStatus(label);

    for (let index = 0; index < requests.length; index += 1) {
      if (index > 0) {
        await wait(REQUEST_INTERVAL_MS);
      }

      const request = requests[index];
      try {
        const html = await fetchText(
          "/maimai-mobile/record/musicVersion/search/?version=" +
            request.version +
            "&diff=" +
            request.difficulty,
        );
        scorePages.push({
          difficulty: request.difficulty,
          version: request.version,
          versionName: request.versionName,
          html,
        });
        for (const detailRequest of extractDetailRequests(html)) {
          detailRequestsByIdx.set(detailRequest.idx, detailRequest);
        }
      } catch (error) {
        failedScorePages.push({
          difficulty: request.difficulty,
          version: request.version,
          versionName: request.versionName,
          message:
            error instanceof Error
              ? error.message
              : "버전별 곡 목록 로드 실패",
        });
      }

      relay.postMessage(
        {
          type: "maimai-challenge:progress",
          difficulty: request.difficulty,
          version: request.version,
          versionName: request.versionName,
          current: index + 1,
          total: requests.length,
          failed: failedScorePages.length,
        },
        APP_ORIGIN,
      );
    }

    return {
      scorePages,
      failedScorePages,
      detailRequests: Array.from(detailRequestsByIdx.values()),
    };
  };
  const collectDetailPages = async function (detailRequests, options) {
    const detailPages = [];
    const failedDetails = [];
    const label = options && options.label ? options.label : "곡 재킷 정보를 수집하는 중입니다.";
    const progressType =
      options && options.progressType
        ? options.progressType
        : "maimai-challenge:detail-progress";

    for (let index = 0; index < detailRequests.length; index += 1) {
      await wait(REQUEST_INTERVAL_MS);
      const detailRequest = detailRequests[index];
      try {
        const html = await fetchText(
          "/maimai-mobile/record/musicDetail/?idx=" +
            encodeURIComponent(detailRequest.idx),
        );
        detailPages.push({
          idx: detailRequest.idx,
          html,
        });
      } catch (error) {
        failedDetails.push({
          idx: detailRequest.idx,
          message:
            error instanceof Error
              ? error.message
              : "상세 페이지 로드 실패",
        });
      }
      relay.postMessage(
        {
          type: progressType,
          message: label,
          current: index + 1,
          total: detailRequests.length,
          failed: failedDetails.length,
        },
        APP_ORIGIN,
      );
    }

    return { detailPages, failedDetails };
  };

  try {
    await waitForRelayReady();

    const scorePageRequests = VERSIONS.flatMap(function (version) {
      return SCORE_DIFFICULTIES.map(function (difficulty) {
        return {
          difficulty,
          version: version[0],
          versionName: version[1],
        };
      });
    });
    const firstScoreCollection = await collectScorePages(scorePageRequests);
    const firstCollection = await collectDetailPages(firstScoreCollection.detailRequests);
    const initialUploadId = "catalog-initial-" + Date.now();
    const uploadedScorePages = firstScoreCollection.scorePages.slice();
    if (firstScoreCollection.scorePages.length > 0) {
      postCatalogPayload(
        initialUploadId,
        firstScoreCollection.scorePages,
        firstCollection.detailPages,
      );
      await waitForUploadComplete(initialUploadId);
    }

    let remainingDetails = firstCollection.failedDetails;
    let remainingScorePages = firstScoreCollection.failedScorePages;
    for (
      let round = 1;
      round <= RECOVERY_ROUND_COUNT && remainingScorePages.length > 0;
      round += 1
    ) {
      notifyStatus(
        "먼저 수집된 곡 목록을 DB에 저장했습니다. 실패한 버전 페이지를 이어서 재수집합니다. " +
          remainingScorePages.length.toLocaleString("ko-KR") +
          "개 남음",
      );
      const recoveredScoreCollection = await collectScorePages(remainingScorePages, {
        label: "누락된 버전별 곡 목록을 재수집하는 중입니다.",
      });
      const recoveredDetailCollection = await collectDetailPages(
        recoveredScoreCollection.detailRequests,
        { label: "재수집한 곡의 상세 정보를 수집하는 중입니다." },
      );

      if (recoveredScoreCollection.scorePages.length > 0) {
        Array.prototype.push.apply(
          uploadedScorePages,
          recoveredScoreCollection.scorePages,
        );
        const recoveredScoreUploadId =
          "catalog-score-recovery-" + round + "-" + Date.now();
        postCatalogPayload(
          recoveredScoreUploadId,
          recoveredScoreCollection.scorePages,
          recoveredDetailCollection.detailPages,
        );
        await waitForUploadComplete(recoveredScoreUploadId);
      }

      remainingDetails = remainingDetails.concat(
        recoveredDetailCollection.failedDetails,
      );
      remainingScorePages = recoveredScoreCollection.failedScorePages;
    }

    for (
      let round = 1;
      round <= RECOVERY_ROUND_COUNT && remainingDetails.length > 0;
      round += 1
    ) {
      notifyStatus(
        "먼저 수집된 정보를 DB에 저장했습니다. 실패한 곡 정보를 이어서 재수집합니다. " +
          remainingDetails.length.toLocaleString("ko-KR") +
          "개 남음",
      );
      const recoveryCollection = await collectDetailPages(remainingDetails, {
        label: "누락된 곡 정보를 재수집하는 중입니다.",
        progressType: "maimai-challenge:detail-progress",
      });

      if (recoveryCollection.detailPages.length > 0) {
        const recoveryUploadId = "catalog-recovery-" + round + "-" + Date.now();
        postCatalogPayload(
          recoveryUploadId,
          uploadedScorePages,
          recoveryCollection.detailPages,
        );
        await waitForUploadComplete(recoveryUploadId);
      }

      remainingDetails = recoveryCollection.failedDetails;
    }

    if (remainingScorePages.length > 0 || remainingDetails.length > 0) {
      relay.postMessage(
        {
          type: "maimai-challenge:collection-complete",
          message:
            "저장 가능한 곡 정보는 DB에 업로드했습니다. 아직 가져오지 못한 " +
            (
              remainingScorePages.length + remainingDetails.length
            ).toLocaleString("ko-KR") +
            "개 항목은 다음 곡 정보 수집 때 이어서 보강됩니다.",
        },
        APP_ORIGIN,
      );
    } else {
      relay.postMessage(
        {
          type: "maimai-challenge:collection-complete",
          message: "모든 곡 정보 수집과 DB 업로드가 완료되었습니다.",
        },
        APP_ORIGIN,
      );
    }
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
