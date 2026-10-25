// Noethara preview helper: shows runtime errors on screen and forwards errors/logs
// to the Noethara app (iPhone WebView) so the agent and user can see them.
(function () {
  var post = function (type, data) {
    try {
      var msg = JSON.stringify({ source: 'noethara-preview', type: type, data: data, at: Date.now() });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
    } catch (e) {}
  };
  var box;
  var show = function (title, detail) {
    post('error', { title: title, detail: detail });
    if (!document.body) return;
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('style', 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;max-height:55vh;overflow:auto;' +
        'background:#1b1020;color:#ffe9ef;border:1px solid #ff5d7a;border-radius:14px;padding:14px 14px 12px;' +
        'font:12px/1.45 ui-monospace,Menlo,monospace;box-shadow:0 18px 50px rgba(0,0,0,.35);white-space:pre-wrap');
      box.addEventListener('click', function () { box.remove(); box = null; });
      document.body.appendChild(box);
    }
    box.textContent = '\u26A0 ' + title + '\n\n' + String(detail || '').slice(0, 2400) + '\n\n(tap to dismiss)';
  };
  window.addEventListener('error', function (e) {
    show(e.message || 'Runtime error', (e.error && e.error.stack) || (e.filename + ':' + e.lineno));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason || {};
    show('Unhandled promise rejection: ' + (r.message || String(r)), r.stack || '');
  });
  ['log', 'warn', 'error'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      try {
        post('console', { level: level, text: Array.prototype.map.call(arguments, function (a) {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (x) { return String(a); }
        }).join(' ').slice(0, 1200) });
      } catch (x) {}
      return original.apply(console, arguments);
    };
  });
  window.addEventListener('load', function () { post('ready', { url: location.href, width: innerWidth, height: innerHeight }); });
})();
