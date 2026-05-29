(function () {
  var script = document.currentScript;
  var appOrigin = script ? new URL(script.src).origin : "";
  var runner = document.createElement("script");
  runner.src = appOrigin + "/catalog-bookmarklet-runner.js?scope=circle&t=" + Date.now();
  runner.async = true;
  document.body.appendChild(runner);
})();
