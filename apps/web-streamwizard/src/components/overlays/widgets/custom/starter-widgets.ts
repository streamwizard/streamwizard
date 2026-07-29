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

const SWITCHER_STATUS_HTML = `<div id="card" class="flex flex-col gap-3 w-full rounded-2xl border px-5 py-4 backdrop-blur-sm transition-all duration-500">
  <div class="flex items-center justify-center gap-3">
    <span id="dot-wrap" class="relative flex h-2.5 w-2.5 shrink-0">
      <span id="dot-ping" class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"></span>
      <span id="dot" class="relative inline-flex h-2.5 w-2.5 rounded-full"></span>
    </span>
    <span id="scene" class="font-semibold leading-tight text-center">Waiting…</span>
    <span id="pill" class="shrink-0 hidden text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md border"></span>
  </div>
  <div id="bars" class="hidden flex-col gap-2"></div>
  <p id="note" class="hidden text-xs text-center opacity-60"></p>
</div>`;

// Ported from the xpudu monitoring overlay: the bar flips meaning by phase --
// filling red toward the switch while live, filling green toward recovery once
// in fallback -- and a metric that is behaving renders nothing at all, so a
// healthy stream shows just the scene name.
const SWITCHER_STATUS_JS = `/* Auto switcher status: which scene you are on, and how close the
 * switcher is to changing it. Put it in OBS as a browser source, or on a
 * phone-mode overlay to watch it while you walk.
 *
 * To try it without a live stream, open Demo mode and run the
 * "Auto switcher degrade + recover" simulator. */

var METRICS = [
  { key: 'bitrate', label: 'bitrate' },
  { key: 'rtt', label: 'rtt' },
  { key: 'loss', label: 'loss' }
];

/* No status for this long means the engine went away. It heartbeats every 5s
 * while it is watching a stream, so 15s of silence is three missed beats.
 *
 * It deliberately goes quiet when nothing is streaming, so silence only counts
 * as "gone" if the last thing it told us was that a stream was live -- see
 * isStale(). */
var STALE_MS = 15000;

var status = null;
var statusAt = 0;
var sceneName = null;

window.addEventListener('onWidgetLoad', function () {
  buildBars();
  render();
  setInterval(render, 1000);
});

window.addEventListener('onEventReceived', function (e) {
  var listener = e.detail.listener;
  var event = e.detail.event;

  if (listener === 'streamwizard.auto_switcher_status') {
    status = event;
    statusAt = Date.now();
  }

  /* The scene OBS is actually on, whoever changed it -- the switcher, the
   * panel, or you tapping around in OBS yourself. */
  if (listener === 'streamwizard.obs_scene_changed') {
    sceneName = event.sceneName;
  }

  render();
});

function buildBars() {
  var host = document.getElementById('bars');
  host.innerHTML = METRICS.map(function (m) {
    return '<div id="row-' + m.key + '" class="hidden items-center gap-3">' +
      '<span class="font-mono opacity-50 w-16 shrink-0">' + m.label + '</span>' +
      '<div class="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">' +
        '<div id="fill-' + m.key + '" class="h-full rounded-full transition-all duration-300" style="width:0%"></div>' +
      '</div>' +
      '<span id="count-' + m.key + '" class="font-mono tabular-nums shrink-0 text-right opacity-80"></span>' +
    '</div>';
  }).join('');
}

/* A resting frame (nothing being watched) is the engine's final word until
 * something changes, so it must never rot into "No signal" -- that would turn
 * "you are not streaming" into "your switcher is broken" after 15 seconds. */
function isStale() {
  if (!status) return true;
  if (!status.armed) return false;
  return Date.now() - statusAt > STALE_MS;
}

function render() {
  var card = document.getElementById('card');
  var stale = isStale();
  var state = stale ? 'unknown' : status.state;

  /* Override freezes the state machine, so the streaks underneath it are
   * stale by definition -- render it as its own thing, never with bars. */
  var inFallback = state === 'degraded' || state === 'offline';
  var showBars = fieldData.showBars !== false && !stale &&
    (state === 'live' || state === 'startup' || state === 'degraded');

  var accent = colorFor(state, stale);
  card.style.background = fieldData.background || 'rgba(0,0,0,0.75)';
  card.style.borderColor = state === 'live' || stale ? 'rgba(255,255,255,0.12)' : accent + '66';
  card.style.color = fieldData.textColor || '#ffffff';
  card.style.fontSize = (Number(fieldData.fontSize) || 16) + 'px';

  var dot = document.getElementById('dot');
  var ping = document.getElementById('dot-ping');
  dot.style.background = accent;
  ping.style.background = accent;
  /* Pulse only when something needs attention, so a healthy overlay is still. */
  ping.style.display = (!stale && (inFallback || status.warning_shown)) ? '' : 'none';

  document.getElementById('scene').textContent = sceneLabel(stale);

  var pill = document.getElementById('pill');
  var pillText = pillFor(state, stale);
  pill.textContent = pillText;
  pill.style.display = pillText ? '' : 'none';
  pill.style.color = accent;
  pill.style.borderColor = accent + '66';
  pill.style.background = accent + '33';

  document.getElementById('bars').style.display = showBars ? 'flex' : 'none';
  if (showBars) {
    var anyVisible = false;
    for (var i = 0; i < METRICS.length; i++) {
      if (renderRow(METRICS[i], inFallback)) anyVisible = true;
    }
    document.getElementById('bars').style.display = anyVisible ? 'flex' : 'none';
  }

  var note = document.getElementById('note');
  var noteText = noteFor(state, stale);
  note.textContent = noteText;
  note.style.display = noteText ? '' : 'none';
}

/* Returns whether the row is showing, so an all-healthy set can collapse the
 * whole bar block instead of leaving an empty gap. */
function renderRow(metric, inFallback) {
  var row = document.getElementById('row-' + metric.key);
  var streak = status.streaks[metric.key];
  var thr = status.thresholds;

  var value = inFallback ? streak.good : streak.bad;
  var limit = inFallback
    ? thr[metric.key + '_recover_polls']
    : thr[metric.key + '_trigger_polls'];

  if (value <= 0) { row.style.display = 'none'; return false; }
  row.style.display = 'flex';

  var pct = Math.min((value / limit) * 100, 100);
  var color = inFallback ? '#34d399' : pct >= 90 ? '#f87171' : pct >= 60 ? '#fbbf24' : '#facc15';

  var fill = document.getElementById('fill-' + metric.key);
  fill.style.width = pct + '%';
  fill.style.background = color;

  var count = document.getElementById('count-' + metric.key);
  count.style.color = color;
  count.style.fontSize = '0.75em';
  count.textContent = fieldData.showMetricValues !== false && status.latest
    ? measured(metric.key)
    : Math.min(value, limit) + '/' + limit + (inFallback ? ' good' : ' bad');
  return true;
}

function measured(key) {
  var s = status.latest;
  var thr = status.thresholds;
  if (key === 'bitrate') {
    return s.kbps === null ? '-' : Math.round(s.kbps) + '/' + thr.bitrate_min_kbps + ' kbps';
  }
  if (key === 'rtt') {
    return s.rtt_ms === null ? '-' : Math.round(s.rtt_ms) + '/' + thr.rtt_max_ms + ' ms';
  }
  return s.loss_pct === null ? '-' : s.loss_pct.toFixed(1) + '/' + thr.loss_max_pct + '%';
}

function sceneLabel(stale) {
  if (sceneName) return sceneName;
  /* Before the first scene event, fall back to whatever the switcher last
   * asked for. Close enough to be useful, and it self-corrects. */
  if (!stale && status.last_switch) return status.last_switch.to_scene;
  return stale ? 'No signal' : 'Unknown scene';
}

function pillFor(state, stale) {
  if (stale) return '';
  if (state === 'override') return 'HOLD';
  if (state === 'degraded') return 'FALLBACK';
  if (state === 'offline') return 'OFFLINE';
  if (state === 'startup') return 'STARTING';
  return '';
}

function noteFor(state, stale) {
  if (stale) return 'No status from the switcher';
  if (state === 'override') return 'Scene held manually';
  if (state === 'idle' || !status.armed) return 'No stream';
  return '';
}

function colorFor(state, stale) {
  if (stale) return fieldData.offlineColor || '#94a3b8';
  if (state === 'offline') return fieldData.offlineColor || '#94a3b8';
  if (state === 'degraded') return fieldData.fallbackColor || '#fb923c';
  if (state === 'override') return fieldData.overrideColor || '#a78bfa';
  if (state === 'startup') return fieldData.warningColor || '#facc15';
  if (status.warning_shown) return fieldData.warningColor || '#facc15';
  return fieldData.healthyColor || '#34d399';
}`;

const SWITCHER_STATUS_FIELDS: WidgetFieldSchema = {
  showBars: { type: "checkbox", label: "Show poll bars", value: true },
  showMetricValues: { type: "checkbox", label: "Show measured values on the bars", value: true },
  fontSize: { type: "slider", label: "Text size (px)", value: 16, min: 10, max: 32, step: 1 },
  colors: {
    type: "group",
    label: "Colors",
    fields: {
      healthyColor: { type: "colorpicker", label: "Healthy", value: "#34d399" },
      warningColor: { type: "colorpicker", label: "Warning", value: "#facc15" },
      fallbackColor: { type: "colorpicker", label: "Fallback", value: "#fb923c" },
      offlineColor: { type: "colorpicker", label: "Offline", value: "#94a3b8" },
      overrideColor: { type: "colorpicker", label: "Manual hold", value: "#a78bfa" },
      textColor: { type: "colorpicker", label: "Text", value: "#ffffff" },
      background: { type: "text", label: "Card background (CSS color)", value: "rgba(0,0,0,0.75)" },
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
    extra_css: "",
    fields: SWITCHER_STATUS_FIELDS,
  },
];

export function getStarterWidget(id: string): StarterWidget | undefined {
  return STARTER_WIDGETS.find((w) => w.id === id);
}
