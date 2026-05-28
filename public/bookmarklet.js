(function () {
  var script = document.currentScript;
  var appOrigin = script ? new URL(script.src).origin : "";
  var runner = document.createElement("script");
  runner.src = appOrigin + "/bookmarklet-runner.js?t=" + Date.now();
  runner.async = true;
  document.body.appendChild(runner);
})();
