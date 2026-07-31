# StreamWizard widget — AI context prompt

Paste everything below into an AI chat, then describe the widget you want under it.

---

You are generating a **StreamWizard custom widget**. Output exactly four code blocks — HTML, JS, Fields (JSON), Extra CSS — and nothing else that has to be pasted. The user copies each block into the matching tab of the StreamWizard widget editor.

## Runtime

The widget runs in a `<iframe sandbox="allow-scripts">` built from the four tabs. Already loaded, in this order:

- Tailwind CSS (`cdn.tailwindcss.com`) — all utility classes, no config
- GSAP 3.12.5 + TextPlugin, **already registered** (`gsap.registerPlugin(TextPlugin)` runs for you)
- A reset: `*,html,body{box-sizing:border-box;margin:0;padding:0}` and `html,body{width:100%;height:100%;overflow:hidden}`
- Transparent background, forced on `html` and `body`

The document is: `<style id="sw-extra-css">` (your CSS) in `<head>`, your HTML in `<body>`, then your JS in one inline `<script>` at the end of `<body>`.

Hard constraints:

- No `import`/`require`, no npm, no extra `<script src>`. Plain ES2020 only.
- `fetch()` is restricted by CSP `connect-src` to: the overlay origin (widget state API), the StreamWizard media CDN, `https://api.open-meteo.com`, `https://nominatim.openstreetmap.org`. Everything else is blocked.
- `<img>`, `<audio>`, `<video>` tags load any URL (CSP above only limits `connect-src`).
- Never set a background on `html` or `body`.
- Widget size comes from the overlay canvas. Lay out with `%`, `vw`/`vh`, flex/grid, or absolute offsets from edges — never a fixed px canvas.
- `console.log/info/warn/error` and uncaught errors are mirrored to the editor console panel. Use them for debug output.

## Globals

| Global | What it is |
|---|---|
| `fieldData` | Field values, already populated before your first line runs |
| `gsap`, `TextPlugin` | GSAP 3.12.5, plugin pre-registered |
| `StreamWizard.state` | `get()` / `set(obj)` persistence — see below |
| `StreamWizard.session` | `{ subscriberToken, overlayItemId }` once placed on an overlay; `null` in the editor preview |
| `StreamWizard.stateUrl` | Raw state endpoint. Prefer `StreamWizard.state`. |
| `StreamWizard.fieldData` | Same values as `fieldData`; kept in sync |

`fieldData` holds the field defaults merged with the streamer's overrides, and is
seeded before your script evaluates, so reading it at the top level is safe:

```js
const duration = Number(fieldData.duration) || 5;
```

It is **reassigned** when the streamer edits a setting, so read it fresh inside
your handlers rather than caching primitives at load time if you want live
updates — see `onFieldsUpdate`.

## Never name a top-level variable after a `window` property

Widget JS runs as a classic script in the iframe's global scope, so `var x` at
top level does not create a new binding when `window.x` already exists — it
reuses that property. For accessor properties this fails **silently and
destructively**:

```js
var status = null;
status = { state: 'live' };   // window.status stringifies: "[object Object]"
status.state                   // undefined — no error, nothing in the console
```

Anything reading `status.foo` then gets `undefined`, so the widget renders a
blank or default state with no clue why. Prefix them (`swStatus`), or wrap the
whole script in an IIFE.

Reserved by `Window`, most likely to bite: `status`, `name`, `length`, `event`,
`top`, `self`, `parent`, `origin`, `history`, `location`, `screen`, `frames`,
`stop`, `open`, `close`, `focus`, `blur`, `print`, `scroll`, `find`.

## Lifecycle events

All are `CustomEvent`s dispatched on `window`.

### `onWidgetLoad` — fires once

```js
addEventListener('onWidgetLoad', (e) => {
  const { fieldData, channel, session } = e.detail;
  // fieldData: field defaults merged with the streamer's overrides
  // channel:   { user_id }  — broadcaster's Twitch user ID
  // session:   { subscriberToken, overlayItemId } — undefined-ish in the editor preview
});
```

### `onFieldsUpdate` — settings changed while running

Fires when the streamer edits a setting in the overlay editor. Re-apply your
values here instead of assuming a reload: a widget that handles this updates
live without losing its animation or runtime state. Widgets that ignore it are
reloaded instead, which restarts the script.

```js
addEventListener('onFieldsUpdate', (e) => {
  cfg = e.detail.fieldData;
  apply(); // same code your onWidgetLoad handler runs
});
```

The `fieldData` global and `StreamWizard.fieldData` are both updated before this
fires, so either works — `e.detail.fieldData` is just the most explicit.

### `onEventReceived` — every live event

```js
addEventListener('onEventReceived', (e) => {
  const { listener, event } = e.detail;
  if (listener !== 'channel.follow') return;
  // event is the EventSub payload
});
```

### `onSessionUpdate`

Declared but nothing emits it. Do not build on it.

## Fields (the Fields tab)

JSON object, key → definition. Keys become `{{key}}` placeholders in HTML and Extra CSS (substituted once at load), and entries in `fieldData` in JS.

```json
{
  "accentColor": { "type": "colorpicker", "label": "Accent color", "value": "#9e7aff" },
  "fontSize":    { "type": "slider", "label": "Font size", "value": 24, "min": 10, "max": 64, "step": 1 },
  "position":    { "type": "dropdown", "label": "Position", "value": "bottom",
                   "options": [{ "value": "top", "label": "Top" }, { "value": "bottom", "label": "Bottom" }] },
  "alertImage":  { "type": "image", "label": "Image", "value": "" },
  "alertSound":  { "type": "audio", "label": "Sound", "value": "" }
}
```

Types: `text` (string), `number`, `checkbox` (boolean), `colorpicker` (`#rrggbb`), `slider` (`min`/`max`/`step`), `dropdown` (`options`), `googleFont` (family name string), `image` / `audio` / `video` (media-library picker, value is a CDN URL string), `hidden`, `group` (`fields`).

`group` collects fields into a collapsible section: `{ "type": "group", "label": "Follow", "fields": { ...same shape... } }`. Grouping is presentation only — nested keys stay flat, so a field inside a group is still `{{key}}` and `fieldData.key`, and keys must be unique across the whole schema. Max five levels of nesting.

Allowed keys per field: `type` (required), `label`, `value`, `options`, `min`, `max`, `step`, `fields` (groups only). Nothing else — the editor's JSON schema rejects extra keys.

`{{key}}` substitution happens **once**, before the document renders. Anything that must change while running must be set from JS on the DOM.

## Persistent state

`StreamWizard.state` stores one JSON blob per placed widget instance — survives OBS restarts and stream ends. Two copies of the same widget on different overlays have separate state.

```js
const saved = await StreamWizard.state.get().catch(() => null); // null when nothing saved
await StreamWizard.state.set({ deaths: 4 });                    // replaces the whole blob — spread to merge
```

`get()`/`set()` **throw in the editor preview** (no session there). Always wrap in `try/catch` or `.catch()`. Don't save inside an animation loop — debounce or batch.

## Event listener strings

`automod.message.hold`, `automod.message.hold/2`, `automod.message.update`, `automod.message.update/2`, `automod.settings.update`, `automod.terms.update`,
`channel.channel_points_automatic_reward_redemption.add`, `channel.channel_points_automatic_reward_redemption.add/2`, `channel.channel_points_custom_reward.add`, `channel.channel_points_custom_reward.update`, `channel.channel_points_custom_reward.remove`, `channel.channel_points_custom_reward_redemption.add`, `channel.channel_points_custom_reward_redemption.update`, `channel.channel_points_custom_reward_power_up.redemption.add`,
`channel.bits.use`, `channel.update`, `channel.follow`, `channel.ad_break.begin`, `channel.subscribe`, `channel.subscription.end`, `channel.subscription.gift`, `channel.subscription.message`, `channel.cheer`, `channel.raid`, `channel.ban`, `channel.unban`, `channel.unban_request.create`, `channel.unban_request.resolve`,
`channel.chat.clear`, `channel.chat.clear_user_messages`, `channel.chat.message`, `channel.chat.message_delete`, `channel.chat.notification`, `channel.chat_settings.update`, `channel.chat.user_message_hold`, `channel.chat.user_message_update`,
`channel.guest_star_session.begin`, `channel.guest_star_session.end`, `channel.guest_star_guest.update`, `channel.guest_star_settings.update`,
`channel.hype_train.begin`, `channel.hype_train.progress`, `channel.hype_train.end`, `channel.shield_mode.begin`, `channel.shield_mode.end`, `channel.shoutout.create`, `channel.shoutout.receive`, `channel.charity_campaign.donate`, `channel.charity_campaign.start`, `channel.charity_campaign.progress`, `channel.charity_campaign.stop`, `channel.shared_chat.begin`, `channel.shared_chat.update`, `channel.shared_chat.end`, `channel.goal.begin`, `channel.goal.progress`, `channel.goal.end`,
`channel.moderate`, `channel.moderate/2`, `channel.moderator.add`, `channel.moderator.remove`, `channel.warning.send`, `channel.warning.acknowledge`, `channel.suspicious_user.message`, `channel.suspicious_user.update`, `channel.vip.add`, `channel.vip.remove`,
`channel.poll.begin`, `channel.poll.progress`, `channel.poll.end`, `channel.prediction.begin`, `channel.prediction.progress`, `channel.prediction.lock`, `channel.prediction.end`,
`stream.online`, `stream.offline`,
`conduit.shard.disabled`, `drop.entitlement.grant`, `extension.bits_transaction.create`, `user.authorization.grant`, `user.authorization.revoke`, `user.update`, `user.whisper.message`,
`streamwizard.geo` (IRL GPS — shape below), `streamwizard.ingest_stats`, `streamwizard.auto_switcher_status`, `streamwizard.auto_switcher_config`, `streamwizard.obs_instance_lifecycle`, `streamwizard.obs_scene_changed` (StreamWizard's own — shapes below).

Payloads are stock Twitch EventSub payloads (the `event` object, unwrapped). Every listed event also carries `broadcaster_user_id` / `_login` / `_name` unless noted. The `streamwizard.*` events are not Twitch payloads; their shapes are given below.

## Common payloads

```
channel.chat.message
  chatter_user_id / _login / _name
  message_id
  message.text
  message.fragments[]  { type: "text"|"cheermote"|"emote"|"mention", text, cheermote?{prefix,bits,tier}, emote?{id,emote_set_id}, mention?{user_id,user_name,user_login} }
  color                 hex string, may be ""
  badges[]              { set_id, id, info }
  message_type          "text" | "channel_points_highlighted" | "channel_points_sub_only" | "user_intro" | "power_ups_message_effect" | "power_ups_gigantified_emote"
  cheer?.bits
  reply?                { parent_message_id, parent_message_body, parent_user_id, parent_user_name, parent_user_login, thread_* }
  channel_points_custom_reward_id?

channel.follow
  user_id / user_login / user_name, followed_at (ISO)

channel.subscribe
  user_id / user_login / user_name, tier "1000"|"2000"|"3000", is_gift

channel.subscription.gift
  user_id / user_login / user_name  (null when anonymous)
  total, tier, cumulative_total (null when anonymous), is_anonymous

channel.subscription.message   (resub)
  user_id / user_login / user_name, tier
  message.text, message.emotes[] { begin, end, id }
  cumulative_months, streak_months (nullable), duration_months

channel.cheer
  is_anonymous, user_id / user_login / user_name (null when anonymous), message, bits

channel.raid
  from_broadcaster_user_id / _login / _name
  to_broadcaster_user_id / _login / _name
  viewers

channel.channel_points_custom_reward_redemption.add
  id, user_id / user_login / user_name
  user_input      "" when the reward takes no input
  status          "unfulfilled" | "fulfilled" | "canceled"
  reward          { id, title, cost, prompt }
  redeemed_at     ISO

stream.online   id, broadcaster_*, type, started_at
stream.offline  broadcaster_*
```

## IRL GPS — `streamwizard.geo`

Two delivery paths, **two different shapes**. Always normalize:

```js
addEventListener('onEventReceived', (e) => {
  if (e.detail.listener !== 'streamwizard.geo') return;

  const raw = e.detail.event;
  if (raw && raw.status === 'offline') { /* phone disconnected */ return; }

  // OBS/WebSocket path: { status: "connected", payload: {...} }
  // Phone/browser path: the payload object itself
  const geo = raw && raw.payload ? raw.payload : raw;
  if (!geo) return; // phone mode sends null before the first fix

  // geo.latitude   number
  // geo.longitude  number
  // geo.altitude   number | null   metres
  // geo.speed      number | null   m/s   (×3.6 = km/h, ×2.237 = mph)
  // geo.heading    number | null   degrees 0–360
  // geo.accuracy   number          metres
  // geo.timestamp  number          Unix ms
});
```

Geo pings arrive roughly once per second while the IRL phone is publishing. For anything expensive (reverse geocoding, weather, state saves) throttle by time and/or distance moved. Distance totals: Haversine between consecutive fixes, discard deltas under ~3 m (GPS jitter) and over ~150 m (impossible jumps).

Allowed IRL APIs (already in the CSP): `https://api.open-meteo.com` (weather, e.g. `/v1/forecast?latitude=..&longitude=..&current=temperature_2m,weather_code`) and `https://nominatim.openstreetmap.org/reverse?lat=..&lon=..&format=json` (place name).

There is no `streamwizard.status` event reaching widgets — an IRL phone going away arrives as `streamwizard.geo` with `status: "offline"`.

## IRL stream health — the ingest and auto-switcher events

Three producers, and they are independent: the ingest node reports what it
measured, the auto switcher reports what it decided about that, and the OBS
instance manager reports what OBS actually did. A widget showing one of them tells
you nothing about the other two arriving.

### `streamwizard.ingest_stats` — ~1/s per active stream

```
session_id, protocol  "srt" | "srtla" | "rtmp"
label                 stream key name, e.g. "Camera 1"
kbps, rtt_ms
loss_pct, drop_pct, retrans_pct   derived percentages
```

Everything below `session_id`/`protocol` is optional: RTMP reports throughput
only, so the SRT transport fields never appear for it. Flows whether or not the
auto switcher is enabled.

### `streamwizard.auto_switcher_status` — on change, plus a 5s heartbeat

```
state        "idle" | "startup" | "live" | "degraded" | "offline" | "override"
armed        true only while a stream is actually being watched
streaks      { bitrate: {bad, good}, rtt: {...}, loss: {...} }   consecutive polls
thresholds   { bitrate_min_kbps, rtt_max_ms, loss_max_pct,
               <metric>_trigger_polls, <metric>_recover_polls,
               <metric>_startup_polls, offline_timeout_seconds }
warning_shown  the "unstable connection" source is visible in OBS right now
latest       { kbps, rtt_ms, loss_pct, at } | null   — nulls for absent metrics
last_switch  { at, from_scene, to_scene, reason, detail, session_id, label } | null
override     { scene_uuid, scene_name, expires_at } | null
offline_since, auto_stop_deadline, last_error
```

One poll = one 1 Hz ingest sample. The asymmetry matters for anything that draws
progress: a fallback fires when **any** metric reaches its `trigger_polls`, but
recovery needs **all** metrics good for their `recover_polls`. So a "switching in
N" countdown is the *closest* metric, while "stable for N more" is the
*furthest behind*.

`good` climbs without bound on a healthy stream — clamp it before dividing, or
you get `1284/10`. While `state` is `"override"` the engine is paused and the
streaks are frozen, so don't draw them. `armed: false` with `state: "offline"` or
`"idle"` means nothing is streaming, and the engine deliberately stops
heartbeating then — treat silence after such a frame as "no stream", not as "the
engine died", or a resting overlay decays into a false error.

### `streamwizard.obs_scene_changed` — on every scene change

```
instanceId, sceneName, sceneUuid, at   (ISO)
```

Observed rather than commanded: it fires for switches made by the auto switcher,
the web panel, the streamer clicking around in OBS over VNC, or a hotkey. Prefer
it over `auto_switcher_status.last_switch.to_scene`, which is only what the engine
*asked for*. Also emitted once when the manager's listener (re)connects, so a
browser source that loads mid-stream still gets the current scene.

### `streamwizard.obs_instance_lifecycle`

```
instanceId, action  "starting" | "started" | "stopping" | "stopped" | "error" | "deleted"
at                  ISO
```

### `streamwizard.auto_switcher_config`

The streamer's `obs_auto_switcher_configs` row (scene UUIDs, sensitivity preset,
chat templates, toggles). Rarely useful to a widget — `auto_switcher_status`
already carries the resolved `thresholds`.

## Editor behaviour worth knowing

- **Never build a demo mode into a widget.** No `demoMode` field, no `startDemo()`, no fake-data loop. StreamWizard's Demo mode feeds fake events to any widget from the editor toolbar — including a moving GPS track — so widget-side demo code is redundant and ships dead weight to viewers.
- Demo mode fires one-shot payloads for every event in the catalogue (follow, sub, gift sub, resub, sub ended, cheer, raid, channel update, ban, chat message, chat cleared, reward redeemed, stream online/offline, plus `streamwizard.geo` and the other `streamwizard.*` events), and runs looping simulators for a moving GPS track, a chat feed, and a full auto-switcher degrade/recover cycle. Geo has an **Offline** button; `auto_switcher_status` has variants for degrading, degraded, startup, offline, override and no-stream.
- Anything that draws *progress* needs a simulator, not a one-shot fixture — a single payload cannot show a bar filling. Use "Auto switcher degrade + recover" for stream-health widgets and "Moving GPS track" for IRL ones.
- The picker leads with the events your widget's source actually references, so keep listener strings as plain literals (`listener === 'channel.follow'`) rather than building them at runtime.
- **Connect** subscribes the preview to the author's real channel events.
- Live reload rebuilds the document on HTML/JS/Fields changes (widget state resets); CSS-only edits hot-swap without a reload.
- Field values changed in the editor's field panel rebuild the document too.

## Output format

```
### HTML
...

### JS
...

### Fields (JSON)
...

### Extra CSS
...
```

Rules for the code you write: no placeholder TODOs, no fake data left in, every field you declare must actually be used, and everything the user could plausibly want to restyle (colors, sizes, durations, toggles, text) should be a field rather than a hardcoded value.

---

**Describe your widget below this line.**
