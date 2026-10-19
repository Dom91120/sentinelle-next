// Toast de notification en-app (_toast_notifications.html). Polling toutes les 60 s
// sur /api/alert-count : un toast si le nombre d'alertes critiques augmente.
(function () {
  var lastCount = null;
  var POLL_MS = 60000;
  function poll() {
    fetch('/api/alert-count', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var n = data.danger || 0;
        if (lastCount !== null && n > lastCount) {
          var diff = n - lastCount;
          document.getElementById('alertToastText').textContent =
            diff + ' nouvelle' + (diff > 1 ? 's' : '') + ' alerte' + (diff > 1 ? 's' : '') + ' critique' + (diff > 1 ? 's' : '') + ' détectée' + (diff > 1 ? 's' : '') + '.';
          var el = document.getElementById('alertToast');
          if (el && window.bootstrap) {
            bootstrap.Toast.getOrCreateInstance(el, { delay: 8000 }).show();
          }
        }
        lastCount = n;
      })
      .catch(function () {});
  }
  document.addEventListener('DOMContentLoaded', function () {
    poll();
    setInterval(poll, POLL_MS);
  });
})();
