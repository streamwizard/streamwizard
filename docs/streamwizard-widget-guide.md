# StreamWizard Custom Widget Guide

This document tells you everything you need to build a custom widget for StreamWizard. Copy this file into your prompt and ask an AI to generate the widget code.

---

## What is a custom widget?

A custom widget is a user-authored overlay element that runs inside a sandboxed `<iframe>`. You write three things:

| Tab | Language | Purpose |
|-----|----------|---------|
| **HTML** | HTML | The visible markup |
| **CSS** | CSS | Extra styles (scoped to the widget) |
| **JS** | JavaScript | Logic — reacts to events, animates, etc. |
| **Fields** | JSON | User-configurable settings exposed in the sidebar |

The widget is rendered at a fixed size (set per overlay scene, e.g. 1920×1080). Your widget fills the space defined by the user when placing it on the scene.

---

## Sandbox environment

Every widget runs inside a sandboxed `<iframe srcdoc>` with the following already included:

- **Tailwind CSS** (CDN) — all utility classes available, no config required
- **GSAP 3.12.5** — `gsap.to()`, `gsap.from()`, timelines, etc.
- **GSAP TextPlugin** — `gsap.registerPlugin(TextPlugin)` to animate text
- **Transparent background** — the body/html background is always transparent; your widget sits on top of the stream
- **No external JavaScript** — you cannot import npm packages; only what is bundled above

The sandbox flag is `allow-scripts` only. No `allow-same-origin`, no `allow-forms`, no popups.

---

## The Widget API

The runtime injects three global event listeners. Use the standard `addEventListener` function — it is declared for you.

### `onWidgetLoad`

Fires once when the widget first loads. Use it to read `fieldData` and set up your initial state.

```js
addEventListener('onWidgetLoad', (obj) => {
  const { fieldData, channel } = obj.detail;
  // fieldData contains all field values (merged defaults + user overrides)
  // channel.user_id is the broadcaster's Twitch user ID
  console.log(fieldData.myColor); // e.g. "#ff0000"
});
```

### `onEventReceived`

Fires whenever a Twitch EventSub event is received. The `listener` property is the canonical EventSub subscription type string. Use a switch or if-chain to handle the events you care about.

```js
addEventListener('onEventReceived', (obj) => {
  const { listener, event } = obj.detail;

  if (listener === 'channel.chat.message') {
    console.log(event.chatter_user_name, event.message.text);
  }

  if (listener === 'channel.follow') {
    console.log(event.user_name, 'just followed!');
  }
});
```

### `onSessionUpdate`

Fires when session data changes (rarely used).

```js
addEventListener('onSessionUpdate', (obj) => {
  const { session } = obj.detail;
});
```

---

## Template tokens

Inside your **HTML** and **CSS** you can use `{{fieldKey}}` tokens. They are replaced with the resolved field value before the iframe renders.

```html
<div style="color: {{textColor}}; font-size: {{fontSize}}px">
  {{displayName}}
</div>
```

```css
.box {
  background-color: {{backgroundColor}};
  border-radius: {{borderRadius}}px;
}
```

Tokens are only replaced at load time. For dynamic updates (e.g. changing color on an event), manipulate the DOM directly in JS instead.

---

## Fields schema (JSON)

The **Fields** tab accepts a JSON object where each key is a field identifier and each value is a field definition. These appear as controls in the overlay editor sidebar.

```jsonc
{
  "fieldKey": {
    "type": "text",          // required — see types below
    "label": "Display Name", // shown in the sidebar (falls back to fieldKey)
    "value": "default"       // default value
  }
}
```

### Field types

| `type` | Value type | Extra properties | Description |
|--------|------------|-----------------|-------------|
| `text` | `string` | — | Single-line text input |
| `number` | `number` | — | Numeric input |
| `checkbox` | `boolean` | — | Toggle switch (true/false) |
| `colorpicker` | `string` (hex) | — | Colour picker, value is a `#rrggbb` hex string |
| `slider` | `number` | `min`, `max`, `step` | Range slider |
| `dropdown` | `string` | `options` | Select box |
| `googleFont` | `string` | — | Google Font family picker |
| `hidden` | any | — | Not shown in sidebar; just carries a value |

#### `dropdown` options format

```jsonc
{
  "position": {
    "type": "dropdown",
    "label": "Text position",
    "value": "bottom",
    "options": [
      { "value": "top",    "label": "Top" },
      { "value": "bottom", "label": "Bottom" }
    ]
  }
}
```

#### `slider` with bounds

```jsonc
{
  "opacity": {
    "type": "slider",
    "label": "Opacity",
    "value": 80,
    "min": 0,
    "max": 100,
    "step": 1
  }
}
```

---

## All supported event listener strings

These are the exact strings to use in `if (listener === '...')` checks.

### Channel — core
| Listener string | Description |
|----------------|-------------|
| `channel.update` | Stream title / game changed |
| `channel.follow` | New follower |
| `channel.subscribe` | New subscriber |
| `channel.subscription.end` | Subscription ended |
| `channel.subscription.gift` | Gift subscriptions sent |
| `channel.subscription.message` | Resub with message |
| `channel.cheer` | Bits cheered |
| `channel.raid` | Incoming raid |
| `channel.ban` | User banned |
| `channel.unban` | User unbanned |
| `channel.unban_request.create` | Unban request created |
| `channel.unban_request.resolve` | Unban request resolved |
| `channel.bits.use` | Bits used (new bits API) |
| `channel.ad_break.begin` | Ad break started |

### Chat
| Listener string | Description |
|----------------|-------------|
| `channel.chat.message` | Chat message |
| `channel.chat.message_delete` | Chat message deleted |
| `channel.chat.clear` | Chat cleared |
| `channel.chat.clear_user_messages` | Single user's messages cleared |
| `channel.chat.notification` | Sub/resub/gift notification in chat |
| `channel.chat_settings.update` | Chat settings changed |
| `channel.chat.user_message_hold` | User message held by automod |
| `channel.chat.user_message_update` | Held message approved/denied |

### Channel points
| Listener string | Description |
|----------------|-------------|
| `channel.channel_points_custom_reward.add` | Custom reward created |
| `channel.channel_points_custom_reward.update` | Custom reward updated |
| `channel.channel_points_custom_reward.remove` | Custom reward removed |
| `channel.channel_points_custom_reward_redemption.add` | Reward redeemed |
| `channel.channel_points_custom_reward_redemption.update` | Redemption status updated |
| `channel.channel_points_automatic_reward_redemption.add` | Automatic reward redeemed |
| `channel.channel_points_automatic_reward_redemption.add/2` | Automatic reward redeemed (v2) |
| `channel.channel_points_custom_reward_power_up.redemption.add` | Power-up redeemed |

### Polls & predictions
| Listener string | Description |
|----------------|-------------|
| `channel.poll.begin` | Poll started |
| `channel.poll.progress` | Poll votes updated |
| `channel.poll.end` | Poll ended |
| `channel.prediction.begin` | Prediction opened |
| `channel.prediction.progress` | Prediction updated |
| `channel.prediction.lock` | Prediction locked |
| `channel.prediction.end` | Prediction resolved |

### Hype train
| Listener string | Description |
|----------------|-------------|
| `channel.hype_train.begin` | Hype train started |
| `channel.hype_train.progress` | Hype train progressed |
| `channel.hype_train.end` | Hype train ended |

### Goals & charity
| Listener string | Description |
|----------------|-------------|
| `channel.goal.begin` | Creator goal started |
| `channel.goal.progress` | Creator goal progressed |
| `channel.goal.end` | Creator goal ended |
| `channel.charity_campaign.donate` | Charity donation |
| `channel.charity_campaign.start` | Charity campaign started |
| `channel.charity_campaign.progress` | Charity campaign progressed |
| `channel.charity_campaign.stop` | Charity campaign ended |

### Moderation
| Listener string | Description |
|----------------|-------------|
| `channel.moderate` | Moderation action |
| `channel.moderate/2` | Moderation action (v2) |
| `channel.moderator.add` | Moderator added |
| `channel.moderator.remove` | Moderator removed |
| `channel.vip.add` | VIP added |
| `channel.vip.remove` | VIP removed |
| `channel.warning.send` | Warning sent to user |
| `channel.warning.acknowledge` | Warning acknowledged |
| `channel.suspicious_user.message` | Suspicious user message |
| `channel.suspicious_user.update` | Suspicious user updated |

### Shoutout & shared chat
| Listener string | Description |
|----------------|-------------|
| `channel.shoutout.create` | Shoutout sent |
| `channel.shoutout.receive` | Shoutout received |
| `channel.shield_mode.begin` | Shield mode activated |
| `channel.shield_mode.end` | Shield mode deactivated |
| `channel.shared_chat.begin` | Shared chat session started |
| `channel.shared_chat.update` | Shared chat session updated |
| `channel.shared_chat.end` | Shared chat session ended |

### Stream
| Listener string | Description |
|----------------|-------------|
| `stream.online` | Stream went live |
| `stream.offline` | Stream ended |

### Automod
| Listener string | Description |
|----------------|-------------|
| `automod.message.hold` | Message held for review |
| `automod.message.hold/2` | Message held (v2) |
| `automod.message.update` | Held message resolved |
| `automod.message.update/2` | Held message resolved (v2) |
| `automod.settings.update` | Automod settings changed |
| `automod.terms.update` | Automod terms updated |

### Guest star
| Listener string | Description |
|----------------|-------------|
| `channel.guest_star_session.begin` | Guest star session started |
| `channel.guest_star_session.end` | Guest star session ended |
| `channel.guest_star_guest.update` | Guest star guest updated |
| `channel.guest_star_settings.update` | Guest star settings updated |

### Other
| Listener string | Description |
|----------------|-------------|
| `conduit.shard.disabled` | Conduit shard disabled |
| `drop.entitlement.grant` | Drop entitlement granted |
| `extension.bits_transaction.create` | Extension bits transaction |
| `user.authorization.grant` | User authorized app |
| `user.authorization.revoke` | User revoked app |
| `user.update` | User profile updated |
| `user.whisper.message` | Whisper message received |

### StreamWizard-specific
| Listener string | Description |
|----------------|-------------|
| `streamwizard.geo` | IRL GPS location update (from phone) |
| `streamwizard.status` | IRL status change (e.g. `{ status: "offline" }`) |

---

## Key event payload shapes

The most commonly used events and their important fields:

### `channel.chat.message`
```
event.chatter_user_name   — display name of the chatter
event.chatter_user_id     — Twitch user ID
event.message.text        — plain text of the message
event.message.fragments   — array of { type, text, emote?, cheermote?, mention? }
event.color               — hex colour the user has chosen for their name
event.badges              — array of { set_id, id, info }
event.message_type        — "text" | "channel_points_highlighted" | ...
event.cheer?.bits         — bits amount if this is a cheer
event.reply?.parent_message_body — quoted message if this is a reply
```

### `channel.follow`
```
event.user_name           — display name of the new follower
event.user_id
event.followed_at         — ISO 8601 timestamp
```

### `channel.subscribe`
```
event.user_name
event.tier                — "1000" | "2000" | "3000"
event.is_gift             — boolean
```

### `channel.subscription.gift`
```
event.user_name           — gifter (null if anonymous)
event.is_anonymous
event.total               — number of subs gifted this batch
event.tier
event.cumulative_total    — total gifts ever (null if anonymous)
```

### `channel.subscription.message` (resub)
```
event.user_name
event.tier
event.message.text        — the resub message
event.cumulative_months
event.streak_months       — null if not sharing
event.duration_months
```

### `channel.cheer`
```
event.user_name           — null if anonymous
event.is_anonymous
event.bits
event.message
```

### `channel.raid`
```
event.from_broadcaster_user_name
event.viewers
```

### `channel.channel_points_custom_reward_redemption.add`
```
event.user_name
event.user_input          — text the user typed (empty string if no input required)
event.reward.title
event.reward.cost
event.status              — "unfulfilled" | "fulfilled" | "canceled"
event.redeemed_at
```

### `streamwizard.geo` (IRL streaming)
```
event.latitude
event.longitude
event.altitude            — metres, null if unavailable
event.speed               — m/s, null if unavailable
event.heading             — degrees 0–360, null if unavailable
event.accuracy            — metres
event.timestamp           — Unix ms
```

---

## Complete examples

### Chat overlay (scrolling messages)

**HTML**
```html
<div id="chat"></div>
```

**CSS**
```css
#chat {
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
  padding: 12px;
  height: 100%;
  overflow: hidden;
}

.message {
  opacity: 0;
  font-family: {{fontFamily}}, sans-serif;
  font-size: {{fontSize}}px;
  line-height: 1.4;
}

.username { font-weight: 700; margin-right: 6px; }
.text     { color: #ffffff; }
```

**Fields**
```json
{
  "fontSize": {
    "type": "slider",
    "label": "Font size",
    "value": 18,
    "min": 10,
    "max": 48,
    "step": 1
  },
  "fontFamily": {
    "type": "googleFont",
    "label": "Font",
    "value": "Inter"
  },
  "maxMessages": {
    "type": "number",
    "label": "Max messages",
    "value": 15
  },
  "fadeAfterMs": {
    "type": "number",
    "label": "Fade after (ms)",
    "value": 8000
  }
}
```

**JS**
```js
let MAX = 15;
let FADE_MS = 8000;

function colorFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 65%)`;
}

addEventListener('onWidgetLoad', (obj) => {
  MAX = Number(obj.detail.fieldData.maxMessages) || 15;
  FADE_MS = Number(obj.detail.fieldData.fadeAfterMs) || 8000;
});

addEventListener('onEventReceived', (obj) => {
  const { listener, event } = obj.detail;
  if (listener !== 'channel.chat.message') return;

  const chat = document.getElementById('chat');
  const el = document.createElement('div');
  el.className = 'message';

  const name = document.createElement('span');
  name.className = 'username';
  name.style.color = event.color || colorFromName(event.chatter_user_name);
  name.textContent = event.chatter_user_name + ':';

  const text = document.createElement('span');
  text.className = 'text';
  text.textContent = event.message.text;

  el.append(name, text);
  chat.prepend(el);

  gsap.to(el, { opacity: 1, duration: 0.3 });
  gsap.to(el, { opacity: 0, duration: 0.5, delay: FADE_MS / 1000, onComplete: () => el.remove() });

  const all = chat.querySelectorAll('.message');
  if (all.length > MAX) all[all.length - 1].remove();
});
```

---

### Latest follower banner

**HTML**
```html
<div id="banner" class="hidden">
  <span id="label">New follower!</span>
  <span id="name"></span>
</div>
```

**CSS**
```css
#banner {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: {{fontSize}}px;
  white-space: nowrap;
  opacity: 0;
}

#name { color: {{accentColor}}; font-weight: 700; margin-left: 8px; }
```

**Fields**
```json
{
  "fontSize":    { "type": "slider",      "label": "Font size",    "value": 22, "min": 12, "max": 48, "step": 1 },
  "accentColor": { "type": "colorpicker", "label": "Name colour",  "value": "#a855f7" },
  "showForMs":   { "type": "number",      "label": "Show for (ms)","value": 5000 }
}
```

**JS**
```js
let showForMs = 5000;

addEventListener('onWidgetLoad', (obj) => {
  showForMs = Number(obj.detail.fieldData.showForMs) || 5000;
});

addEventListener('onEventReceived', (obj) => {
  const { listener, event } = obj.detail;
  if (listener !== 'channel.follow') return;

  document.getElementById('name').textContent = event.user_name;
  const banner = document.getElementById('banner');

  gsap.killTweensOf(banner);
  gsap.fromTo(banner,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out',
      onComplete: () => gsap.to(banner, { opacity: 0, y: -10, duration: 0.4, delay: showForMs / 1000 })
    }
  );
});
```

---

## Rules and constraints

1. **No external scripts.** Only GSAP and Tailwind from the bundled CDNs are available. Do not add `<script src>` tags.
2. **No external images unless hosted.** Use CSS gradients or inline SVG for graphics; or have the user configure an image URL via a `text` field.
3. **Background is always transparent.** Never set a background on `body` or `html`.
4. **`fieldData` is read-only.** It only reflects values at load time. React to user-configured changes via `onWidgetLoad`.
5. **The widget has no internet access** (sandbox) so `fetch()` and XHR will fail.
6. **GSAP TextPlugin** must be registered before use:
   ```js
   gsap.registerPlugin(TextPlugin);
   ```
7. **Keep JS self-contained.** No `import`/`require`. Write plain ES2020 JavaScript.
8. **Widget dimensions** come from the overlay editor. Design layouts in percentage or `vw`/`vh` units so they scale correctly, or use absolute positioning from edges.

---

## Output format

When an AI generates a widget, it should produce four separate code blocks clearly labelled:

```
### HTML
<code>

### CSS
<code>

### JS
<code>

### Fields (JSON)
<code>
```

The user pastes each block into the corresponding tab in the StreamWizard widget editor.
