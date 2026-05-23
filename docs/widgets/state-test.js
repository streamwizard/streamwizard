var elapsedSeconds = 0;
var stateUrl = null;
var subscriberToken = null;
var overlayItemId = null;

function pad(n) { return String(n).padStart(2, '0'); }

function formatTime(secs) {
  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs % 3600) / 60);
  var s = secs % 60;
  return pad(h) + ':' + pad(m) + ':' + pad(s);
}

function render() {
  document.getElementById('display').textContent = formatTime(elapsedSeconds);
}

function setStatus(msg, type) {
  var el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = type || '';
}

function save() {
  if (!stateUrl || !subscriberToken || !overlayItemId) return;
  setStatus('Saving…', 'saving');
  fetch(stateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: subscriberToken,
      itemId: overlayItemId,
      state: { elapsed_seconds: elapsedSeconds },
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (body) {
      if (body.ok) {
        setStatus('Saved ✓', 'saved');
        setTimeout(function () { setStatus(''); }, 2000);
      } else {
        setStatus('Save failed');
        console.error('[state-test] save error:', body);
      }
    })
    .catch(function (err) {
      setStatus('Save failed');
      console.error('[state-test] save fetch error:', err);
    });
}

window.addEventListener('onWidgetLoad', function (e) {
  var session = e.detail.session || {};
  stateUrl        = window.StreamWizard ? window.StreamWizard.stateUrl : null;
  subscriberToken = session.subscriberToken || null;
  overlayItemId   = session.overlayItemId   || null;

  console.log('[state-test] stateUrl:', stateUrl, '| token:', subscriberToken, '| itemId:', overlayItemId);

  if (!stateUrl || !subscriberToken || !overlayItemId) {
    setStatus('missing: ' + [!stateUrl && 'stateUrl', !subscriberToken && 'token', !overlayItemId && 'itemId'].filter(Boolean).join(', '));
    // Still start the timer so the display works
    startTimer();
    return;
  }

  // Load persisted elapsed time, then start ticking
  fetch(stateUrl + '?token=' + encodeURIComponent(subscriberToken) + '&itemId=' + encodeURIComponent(overlayItemId))
    .then(function (r) { return r.json(); })
    .then(function (body) {
      console.log('[state-test] loaded state:', body);
      if (body.state && body.state.elapsed_seconds != null) {
        elapsedSeconds = body.state.elapsed_seconds;
        render();

        var badge = document.getElementById('restored-badge');
        badge.classList.add('visible');
        setTimeout(function () { badge.classList.remove('visible'); }, 3000);
      }
      startTimer();
    })
    .catch(function (err) {
      console.error('[state-test] load error:', err);
      setStatus('Load failed');
      startTimer();
    });
});

function startTimer() {
  // Tick every second
  setInterval(function () {
    elapsedSeconds++;
    render();
  }, 1000);

  // Save every 10 seconds
  setInterval(save, 10000);
}
