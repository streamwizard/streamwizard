import type { WidgetFieldSchema } from "@repo/ui/overlay";

// Code-defined starter widgets: polished custom-widget sources users can
// install with one click (the install creates a normal `widgets` row they own
// and can edit). Also used by overlay templates that ship with a widget on
// the canvas (see createOverlayFromTemplate).

export interface StarterWidget {
  id: string;
  name: string;
  description: string;
  tags: string[];
  html: string;
  js: string;
  extra_css: string;
  fields: WidgetFieldSchema;
}

const ALERT_BOX_HTML = `<div id="alert" class="flex flex-col items-center justify-center w-full h-full gap-3 p-6 opacity-0">
  <img id="alert-image" src="{{alertImage}}" alt="" class="max-h-[45%] object-contain drop-shadow-xl" />
  <p id="alert-title" class="text-white text-4xl font-bold drop-shadow-lg text-center"></p>
  <p id="alert-message" class="text-white/80 text-xl text-center"></p>
</div>`;

const ALERT_BOX_JS = `/* Alert box: follows, subs, cheers, and raids with your own image and sound.
 * Swap the image/sound in the widget settings - no code needed. */

var duration = Number(fieldData.alertDuration) || 5;
var accent = fieldData.accentColor || '#9e7aff';
var busy = false;
var queue = [];

window.addEventListener('onWidgetLoad', function () {
  var img = document.getElementById('alert-image');
  if (!fieldData.alertImage) img.style.display = 'none';
  document.getElementById('alert-title').style.color = accent;
});

window.addEventListener('onEventReceived', function (e) {
  var listener = e.detail.listener;
  var event = e.detail.event;

  if (listener === 'channel.follow' && fieldData.showFollows !== false) {
    enqueue(event.user_name, 'just followed!');
  }
  if (listener === 'channel.subscribe' && fieldData.showSubs !== false) {
    enqueue(event.user_name, event.is_gift ? 'got a gifted sub!' : 'just subscribed!');
  }
  if (listener === 'channel.cheer' && fieldData.showCheers !== false) {
    var name = event.is_anonymous ? 'Anonymous' : event.user_name;
    enqueue(name, 'cheered ' + event.bits + ' bits!');
  }
  if (listener === 'channel.raid' && fieldData.showRaids !== false) {
    enqueue(event.from_broadcaster_user_name, 'raided with ' + event.viewers + ' viewers!');
  }
});

function enqueue(title, message) {
  queue.push({ title: title, message: message });
  if (!busy) next();
}

function next() {
  var alert = queue.shift();
  if (!alert) { busy = false; return; }
  busy = true;

  document.getElementById('alert-title').textContent = alert.title;
  document.getElementById('alert-message').textContent = alert.message;

  if (fieldData.alertSound) {
    var audio = new Audio(fieldData.alertSound);
    audio.volume = Number(fieldData.soundVolume);
    if (isNaN(audio.volume)) audio.volume = 0.7;
    audio.play().catch(function () {});
  }

  var tl = gsap.timeline({ onComplete: next });
  tl.fromTo('#alert',
    { opacity: 0, scale: 0.85, y: 24 },
    { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }
  );
  tl.to('#alert', { duration: duration });
  tl.to('#alert', { opacity: 0, scale: 0.9, y: -16, duration: 0.35, ease: 'power2.in' });
}`;

const ALERT_BOX_FIELDS: WidgetFieldSchema = {
  alertImage: { type: "image", label: "Alert image", value: "" },
  alertSound: { type: "audio", label: "Alert sound", value: "" },
  soundVolume: { type: "slider", label: "Sound volume", value: 0.7, min: 0, max: 1, step: 0.05 },
  accentColor: { type: "colorpicker", label: "Accent color", value: "#9e7aff" },
  alertDuration: { type: "slider", label: "Seconds on screen", value: 5, min: 2, max: 15, step: 1 },
  // Doubles as the worked example of a "group": a collapsible section in the
  // inspector whose children keep their plain keys (fieldData.showFollows).
  alertTypes: {
    type: "group",
    label: "Alert types",
    fields: {
      showFollows: { type: "checkbox", label: "Show follows", value: true },
      showSubs: { type: "checkbox", label: "Show subs", value: true },
      showCheers: { type: "checkbox", label: "Show cheers", value: true },
      showRaids: { type: "checkbox", label: "Show raids", value: true },
    },
  },
};

const SWITCHER_STATUS_HTML = `<div id="card"
     class="inline-flex flex-col gap-2 rounded-2xl border px-4 py-3 backdrop-blur-sm transition-all duration-500">

  <!-- Scene row -->
  <div class="flex items-center gap-2.5">
    <span class="relative flex h-2.5 w-2.5 shrink-0">
      <span id="dot-ping" class="absolute inline-flex h-full w-full rounded-full opacity-75"></span>
      <span id="dot" class="relative inline-flex h-2.5 w-2.5 rounded-full"></span>
    </span>

    <span id="scene" class="font-semibold leading-tight">Waiting…</span>

    <span id="pill"
          class="hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[0.6em] font-bold uppercase tracking-widest">
    </span>
  </div>

  <!-- Metric rows. Injected by the JS so the three metrics stay defined in one
       place. Each row hides itself unless it has something to say. -->
  <div id="bars" class="hidden flex-col gap-1.5"></div>

  <!-- Countdown / status line -->
  <p id="note" class="hidden text-[0.7em] leading-tight opacity-70"></p>
</div>`;

// Ported from the xpudu monitoring overlay: each row flips meaning by phase
// -- filling red toward the switch while live, filling green toward recovery
// once in fallback -- and a metric that is behaving renders nothing at all,
// so a healthy stream shows just the scene name.
const SWITCHER_STATUS_JS = `/* Auto switcher status:
 *
 * Shows which scene OBS is on and how close the auto switcher is to changing
 * it. Each metric row shows two numbers:
 *
 *   bitrate  [=====   ]  780/800   1/6
 *                        ^measured  ^bad polls out of the trigger
 *
 * The poll count is the one that matters — it is the countdown to the switch.
 * The measured value tells you why.
 *
 * Events consumed (both already arrive on the overlay's own socket, nothing to
 * subscribe to):
 *   streamwizard.auto_switcher_status  — state, streaks, thresholds, latest
 *   streamwizard.obs_scene_changed     — the scene OBS actually switched to
 *
 * To try it without streaming: Demo mode → run "Auto switcher degrade +
 * recover", or fire the one-shot "Auto switcher: degrading" variant.
 */

/* ── settings ──────────────────────────────────────────────────────────────
 * Read from the onWidgetLoad payload rather than a bare 'fieldData' global.
 * The docs mention a global, but the sandbox only guarantees
 * e.detail.fieldData / window.StreamWizard.fieldData — touching a bare
 * 'fieldData' at the top of the file throws before the widget ever renders. */
var F = {};

function bool(value, fallback) {
  return value === undefined || value === null ? fallback : value !== false;
}

function color(key, fallback) {
  return F[key] || fallback;
}

/* ── state ─────────────────────────────────────────────────────────────── */
var METRICS = [
  { key: 'bitrate', label: 'bitrate' },
  { key: 'rtt', label: 'ping' },
  { key: 'loss', label: 'loss' }
];

/* The engine heartbeats every 5s *while it is watching a stream*, so three
 * missed beats means it went away. It deliberately goes quiet when nothing is
 * streaming, which is why isStale() only counts silence when the last frame
 * said a stream was live. */
var STALE_MS = 15000;

var swStatus = null;
var swStatusAt = 0;
var sceneName = null;
var ticker = null;

/* ── lifecycle ─────────────────────────────────────────────────────────── */
window.addEventListener('onWidgetLoad', function (e) {
  F = (e.detail && e.detail.fieldData) || {};
  buildRows();
  render();
  /* Redraw on a timer too: the countdown and the stale guard both move on
   * their own, with no event to prompt them. */
  if (!ticker) ticker = setInterval(render, 500);
});

/* Re-apply settings in place instead of making the editor reload the document
 * on every tweak (which would throw away the current status). */
window.addEventListener('onFieldsUpdate', function (e) {
  F = (e.detail && e.detail.fieldData) || {};
  render();
});

window.addEventListener('onEventReceived', function (e) {
  var listener = e.detail.listener;
  var event = e.detail.event;

  if (listener === 'streamwizard.auto_switcher_status') {
    swStatus = event;
    swStatusAt = Date.now();
  }

  /* The scene OBS is actually on — whoever changed it: the switcher, the web
   * panel, or you tapping around in OBS over VNC. Note this arrives completely
   * independently of the status feed, so a scene label that updates is NOT
   * evidence that the switcher is reporting. */
  if (listener === 'streamwizard.obs_scene_changed') {
    sceneName = event.sceneName;
  }

  render();
});

/* ── build ─────────────────────────────────────────────────────────────── */
function buildRows() {
  var host = document.getElementById('bars');
  var rows = '';
  for (var i = 0; i < METRICS.length; i++) {
    var m = METRICS[i];
    rows +=
      '<div id="row-' + m.key + '" class="hidden items-center gap-2">' +
        '<span class="w-12 shrink-0 text-[0.7em] uppercase tracking-wide opacity-50">' + m.label + '</span>' +
        '<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">' +
          '<div id="fill-' + m.key + '" class="h-full rounded-full transition-all duration-300" style="width:0%"></div>' +
        '</div>' +
        '<span id="meas-' + m.key + '" class="shrink-0 text-[0.65em] tabular-nums opacity-45"></span>' +
        '<span id="polls-' + m.key + '" class="w-10 shrink-0 text-right text-[0.7em] font-semibold tabular-nums"></span>' +
      '</div>';
  }
  host.innerHTML = rows;
}

/* ── render ────────────────────────────────────────────────────────────── */

/* A resting frame (nothing being watched) is the engine's last word until
 * something changes, so it must never rot into "no signal" — that would turn
 * "you are not streaming" into "your switcher is broken" after 15 seconds. */
function isStale() {
  if (!swStatus) return true;
  if (!swStatus.armed) return false;
  return Date.now() - swStatusAt > STALE_MS;
}

function render() {
  var stale = isStale();
  var state = stale ? 'unknown' : swStatus.state;

  /* Recovering: the engine is on the fallback scene and counting good polls
   * back up to the recover thresholds. */
  var recovering = !stale && (state === 'degraded' || state === 'offline');
  var accent = accentFor(state, stale);

  paintCard(accent, state, stale);
  paintScene(state, stale, accent);
  paintRows(state, stale, recovering);
  paintNote(state, stale, recovering);
}

function paintCard(accent, state, stale) {
  var card = document.getElementById('card');
  card.style.background = F.background || 'rgba(0,0,0,0.72)';
  card.style.color = F.textColor || '#ffffff';
  card.style.fontSize = (Number(F.fontSize) || 18) + 'px';
  card.style.borderColor = state === 'live' || stale ? 'rgba(255,255,255,0.12)' : accent + '66';
  card.style.minWidth = bool(F.showBars, true) ? '280px' : '0px';
}

function paintScene(state, stale, accent) {
  var dot = document.getElementById('dot');
  var ping = document.getElementById('dot-ping');
  dot.style.background = accent;
  ping.style.background = accent;
  /* Pulse only when something wants attention, so a healthy overlay is still. */
  ping.style.display = !stale && (state === 'degraded' || state === 'offline' || swStatus.warning_shown) ? '' : 'none';

  document.getElementById('scene').textContent = sceneLabel(stale);

  var pill = document.getElementById('pill');
  var text = pillFor(state, stale);
  pill.textContent = text;
  pill.style.display = text ? '' : 'none';
  pill.style.color = accent;
  pill.style.borderColor = accent + '66';
  pill.style.background = accent + '2b';
}

function paintRows(state, stale, recovering) {
  var host = document.getElementById('bars');

  /* Override freezes the state machine, so the streaks under it are stale by
   * definition — never draw rows for it. Same for idle and unknown. */
  var eligible = !stale && (state === 'live' || state === 'startup' || state === 'degraded' || state === 'offline');
  if (!bool(F.showBars, true) || !eligible) {
    host.style.display = 'none';
    return;
  }

  var anyVisible = false;
  for (var i = 0; i < METRICS.length; i++) {
    if (paintRow(METRICS[i], recovering)) anyVisible = true;
  }
  host.style.display = anyVisible ? 'flex' : 'none';
}

/* Returns whether this row ended up visible, so an all-healthy set collapses
 * the whole block instead of leaving an empty gap. */
function paintRow(metric, recovering) {
  var row = document.getElementById('row-' + metric.key);
  var streak = swStatus.streaks[metric.key];
  var bad = streak.bad;

  /* Three things a row can be showing:
   *   recovering — good polls climbing toward the recover threshold
   *   failing    — bad polls climbing toward the trigger
   *   healthy    — how much of the threshold the current reading is using,
   *                which moves before any bad poll is counted. Off by default:
   *                on stream you want silence when things are fine, but on the
   *                phone it is the whole point of looking. */
  var mode = recovering ? 'recovering' : bad > 0 ? 'failing' : bool(F.alwaysShowMetrics, false) ? 'healthy' : null;
  if (!mode) {
    row.style.display = 'none';
    return false;
  }
  row.style.display = 'flex';

  var limit = pollLimit(metric.key, recovering);
  var polls = Math.min(recovering ? streak.good : bad, limit);
  var pct = mode === 'healthy' ? thresholdUsage(metric.key) : Math.min((polls / limit) * 100, 100);

  var barColor =
    mode === 'recovering' ? color('recoverColor', '#34d399')
    : mode === 'healthy' ? color('healthyColor', '#34d399')
    : pct >= 90 ? color('criticalColor', '#f87171')
    : pct >= 55 ? color('warningColor', '#fbbf24')
    : color('cautionColor', '#facc15');

  var fill = document.getElementById('fill-' + metric.key);
  fill.style.width = (pct === null ? 0 : pct) + '%';
  fill.style.background = barColor;
  fill.style.opacity = mode === 'healthy' ? '0.45' : '1';

  /* Measured value and poll count are separate columns on purpose. The poll
   * count is the countdown to the switch; the measured value is the reason. */
  var meas = document.getElementById('meas-' + metric.key);
  meas.textContent = bool(F.showMeasured, true) ? measured(metric.key) : '';

  var pollsEl = document.getElementById('polls-' + metric.key);
  pollsEl.style.color = barColor;
  pollsEl.textContent = mode === 'healthy' ? '0/' + pollLimit(metric.key, false) : polls + '/' + limit;
  return true;
}

/* How much of its threshold the current reading is using, 0-100, lower is
 * better for all three. Bitrate is inverted (a floor, not a ceiling) so the
 * bars all read the same way: filling up means trouble. */
function thresholdUsage(key) {
  var s = swStatus.latest;
  var thr = swStatus.thresholds;
  if (!s) return 0;
  if (key === 'bitrate') {
    if (s.kbps === null || s.kbps <= 0) return 0;
    return Math.min((thr.bitrate_min_kbps / s.kbps) * 100, 100);
  }
  if (key === 'rtt') {
    return s.rtt_ms === null ? 0 : Math.min((s.rtt_ms / thr.rtt_max_ms) * 100, 100);
  }
  return s.loss_pct === null ? 0 : Math.min((s.loss_pct / thr.loss_max_pct) * 100, 100);
}

function pollLimit(key, recovering) {
  var thr = swStatus.thresholds;
  return recovering ? thr[key + '_recover_polls'] : thr[key + '_trigger_polls'];
}

/* The actual reading against the threshold it is judged by. 'latest' fields are
 * null for RTMP, which only reports throughput. */
function measured(key) {
  var s = swStatus.latest;
  var thr = swStatus.thresholds;
  if (!s) return '';
  if (key === 'bitrate') {
    return s.kbps === null ? '—' : Math.round(s.kbps) + '/' + thr.bitrate_min_kbps;
  }
  if (key === 'rtt') {
    return s.rtt_ms === null ? '—' : Math.round(s.rtt_ms) + '/' + thr.rtt_max_ms + 'ms';
  }
  return s.loss_pct === null ? '—' : s.loss_pct.toFixed(1) + '/' + thr.loss_max_pct + '%';
}

function sceneLabel(stale) {
  if (sceneName) return sceneName;
  /* Before the first scene event, fall back to whatever the switcher last asked
   * for. Close enough to be useful, and it self-corrects on the next change. */
  if (!stale && swStatus.last_switch) return swStatus.last_switch.to_scene;
  return stale ? 'No signal' : 'Unknown scene';
}

function pillFor(state, stale) {
  if (stale) return '';
  if (state === 'override') return 'hold';
  if (state === 'degraded') return 'fallback';
  if (state === 'offline') return 'offline';
  if (state === 'startup') return 'starting';
  return '';
}

function paintNote(state, stale, recovering) {
  var note = document.getElementById('note');
  var text = noteFor(state, stale, recovering);
  note.textContent = text;
  note.style.display = text ? '' : 'none';
}

function noteFor(state, stale, recovering) {
  /* Deliberately explicit: this is the line that tells you the status feed
   * itself is missing, which a scene label alone cannot. */
  if (stale) return 'No swStatus from the switcher';
  if (state === 'override') {
    return swStatus.override && swStatus.override.scene_name
      ? 'Held on ' + swStatus.override.scene_name
      : 'Scene held manually';
  }
  if (state === 'idle' || !swStatus.armed) return 'No stream';

  if (recovering) {
    if (!bool(F.showCountdown, true)) return '';
    var left = pollsToRecover();
    return left === null ? 'Waiting for a stable link' : 'Stable for ' + left + ' more polls to switch back';
  }

  /* Live but something is already failing: how many more bad polls until the
   * switch. This is the number the engine used to never publish. */
  if (bool(F.showCountdown, true)) {
    var until = pollsToSwitch();
    if (until !== null) return until <= 1 ? 'Switching now' : 'Switching in ' + until + ' polls';
  }
  return '';
}

/* Fallback fires when ANY metric hits its trigger, so the countdown is the
 * closest metric. */
function pollsToSwitch() {
  var best = null;
  for (var i = 0; i < METRICS.length; i++) {
    var key = METRICS[i].key;
    var bad = swStatus.streaks[key].bad;
    if (bad <= 0) continue;
    var left = Math.max(pollLimit(key, false) - bad, 0);
    if (best === null || left < best) best = left;
  }
  return best;
}

/* Recovery needs ALL metrics good, so the wait is the furthest-behind metric. */
function pollsToRecover() {
  var worst = null;
  for (var i = 0; i < METRICS.length; i++) {
    var key = METRICS[i].key;
    var left = Math.max(pollLimit(key, true) - swStatus.streaks[key].good, 0);
    if (worst === null || left > worst) worst = left;
  }
  return worst === 0 ? null : worst;
}

function accentFor(state, stale) {
  if (stale || state === 'offline' || state === 'idle') return color('offlineColor', '#94a3b8');
  if (state === 'degraded') return color('fallbackColor', '#fb923c');
  if (state === 'override') return color('overrideColor', '#a78bfa');
  if (state === 'startup') return color('cautionColor', '#facc15');
  if (swStatus.warning_shown) return color('cautionColor', '#facc15');
  return color('healthyColor', '#34d399');
}`;

const SWITCHER_STATUS_CSS = `/* Soften the attention pulse. Tailwind's animate-ping is a hard 1s strobe,
   which is fine for a notification badge and awful on a stream overlay you are
   staring at for hours. */
#dot-ping {
  animation: sw-pulse 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes sw-pulse {
  0%   { transform: scale(1);    opacity: 0.7; }
  70%  { transform: scale(2.4);  opacity: 0; }
  100% { transform: scale(2.4);  opacity: 0; }
}

/* Bars grow from the left rather than fading in, so a filling bar reads as
   progress toward the switch instead of a value blinking on. */
#bars > div > div > div {
  transform-origin: left center;
}

/* Keep the card from jumping around as rows appear and disappear — the scene
   row stays put and the bars grow downward. */
#card {
  align-items: stretch;
}`;

const SWITCHER_STATUS_FIELDS: WidgetFieldSchema = {
  showBars: { type: "checkbox", label: "Show poll bars", value: true },
  showMeasured: { type: "checkbox", label: "Show the measured value on each bar", value: true },
  alwaysShowMetrics: { type: "checkbox", label: "Always show all three metrics (off = only when something is wrong)", value: false },
  showCountdown: { type: "checkbox", label: "Show \"switching in N polls\"", value: true },
  fontSize: { type: "slider", label: "Text size (px)", value: 18, min: 10, max: 40, step: 1 },
  colors: {
    type: "group",
    label: "Colors",
    fields: {
      healthyColor: { type: "colorpicker", label: "Healthy", value: "#34d399" },
      cautionColor: { type: "colorpicker", label: "Caution (first bad polls)", value: "#facc15" },
      warningColor: { type: "colorpicker", label: "Warning (over halfway)", value: "#fbbf24" },
      criticalColor: { type: "colorpicker", label: "Critical (about to switch)", value: "#f87171" },
      recoverColor: { type: "colorpicker", label: "Recovering", value: "#34d399" },
      fallbackColor: { type: "colorpicker", label: "On fallback scene", value: "#fb923c" },
      overrideColor: { type: "colorpicker", label: "Manual hold", value: "#a78bfa" },
      offlineColor: { type: "colorpicker", label: "Offline / no stream", value: "#94a3b8" },
    },
  },
  card: {
    type: "group",
    label: "Card",
    fields: {
      textColor: { type: "colorpicker", label: "Text", value: "#ffffff" },
      background: { type: "text", label: "Background (any CSS color)", value: "rgba(0,0,0,0.72)" },
    },
  },
};

export const STARTER_WIDGETS: StarterWidget[] = [
  {
    id: "alert-box",
    name: "Alert box",
    description: "Follows, subs, cheers, and raids with your own image and sound. Alerts queue up so none get lost.",
    tags: ["alerts"],
    html: ALERT_BOX_HTML,
    js: ALERT_BOX_JS,
    extra_css: "",
    fields: ALERT_BOX_FIELDS,
  },
  {
    id: "auto-switcher-status",
    name: "Auto switcher status",
    description:
      "Which scene you are on, and how close the auto switcher is to changing it. Metric bars only appear while something is wrong, so a healthy stream shows just the scene name.",
    tags: ["irl", "auto switcher"],
    html: SWITCHER_STATUS_HTML,
    js: SWITCHER_STATUS_JS,
    extra_css: SWITCHER_STATUS_CSS,
    fields: SWITCHER_STATUS_FIELDS,
  },
];

export function getStarterWidget(id: string): StarterWidget | undefined {
  return STARTER_WIDGETS.find((w) => w.id === id);
}
