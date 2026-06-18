(function () {
  var fallbackOrigin =
    window.__MAIMAI_CHALLENGE_APP_ORIGIN || "https://maimai-challenge.vercel.app";
  var script = document.currentScript;
  var appOrigin = script ? new URL(script.src).origin : fallbackOrigin;
  var runner = document.createElement("script");
  window.__MAIMAI_CHALLENGE_APP_ORIGIN = appOrigin;
  runner.onerror = function () {
    alert("점수 갱신 스크립트를 불러오지 못했습니다. 잠시 후 다시 실행해주세요.");
  };
  runner.src = appOrigin + "/bookmarklet-runner.js?t=" + Date.now();
  runner.async = true;
  document.body.appendChild(runner);
})();
