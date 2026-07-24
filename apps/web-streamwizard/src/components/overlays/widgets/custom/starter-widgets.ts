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
  showFollows: { type: "checkbox", label: "Show follows", value: true },
  showSubs: { type: "checkbox", label: "Show subs", value: true },
  showCheers: { type: "checkbox", label: "Show cheers", value: true },
  showRaids: { type: "checkbox", label: "Show raids", value: true },
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
];

export function getStarterWidget(id: string): StarterWidget | undefined {
  return STARTER_WIDGETS.find((w) => w.id === id);
}
