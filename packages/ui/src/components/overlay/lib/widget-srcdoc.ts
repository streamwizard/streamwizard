import { mergeFieldValues, resolveWidgetTemplate, type WidgetFieldSchema } from "./widget-fields";

/**
 * Builds the sandboxed `srcdoc` a custom widget runs inside: the resolved
 * template, the CSP that scopes its network access, the CDN libraries it can
 * count on, and (editor-only) the console/error forwarder.
 */

// srcdoc iframes inherit the embedding page's CSP. The dashboard serves a
// nonce-based script-src without 'unsafe-inline', so every script tag below
// (inline and CDN) must carry the page's nonce to execute there. The nonce
// content attribute is hidden from the DOM, but the IDL property on any of
// Next's own nonce'd scripts still exposes it. Under the overlay app's
// 'unsafe-inline' policy the attribute is inert, so stamping is always safe.
/**
 * JSON that is safe inside an inline <script>: field values are free text, so
 * a "</script>" or "<!--" in one must not end the tag, and U+2028/U+2029 are
 * line terminators to older JS parsers.
 */
function inlineScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function documentNonce(): string {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
}

export function buildWidgetSrcdoc(
  html: string,
  js: string,
  extraCss: string,
  fields: WidgetFieldSchema,
  fieldValues: Record<string, unknown>,
  overlayOrigin?: string,
  // Media-library CDN origin: lets widget JS fetch() uploaded assets. Plain
  // <img>/<audio>/<video> tags don't need it — this CSP only sets connect-src.
  assetCdnOrigin?: string,
  opts?: {
    /**
     * Mirror console output and uncaught errors to the parent as `swLog`
     * messages. Editor-only: a chatty widget on a live overlay would postMessage
     * on every log for nobody's benefit.
     */
    forwardLogs?: boolean;
    /**
     * The document runs in a dashboard preview rather than on a live overlay.
     * Installs the editor-only hooks: the editor's mute (`swSetMuted`) and
     * editor state, where `state`/`userState` read the real saved values but
     * every write stays in the editor (`swEditorState` in, `swStateWrite` out).
     */
    editor?: boolean;
  }
): string {
  const { resolvedHtml, resolvedCss } = resolveWidgetTemplate(html, extraCss, fields, fieldValues);
  const stateUrl = overlayOrigin ? JSON.stringify(`${overlayOrigin}/api/widgets/state`) : "null";
  const userStateUrl = overlayOrigin
    ? JSON.stringify(`${overlayOrigin}/api/widgets/user-state`)
    : "null";
  const twitchUrl = overlayOrigin ? JSON.stringify(`${overlayOrigin}/api/twitch`) : "null";
  // Known at build time, so the widget can read its settings on its first
  // line instead of only after onWidgetLoad arrives.
  const initialFieldData = inlineScriptJson(mergeFieldValues(fields, fieldValues));
  const nonce = documentNonce();
  const connectSrc = [
    overlayOrigin,
    assetCdnOrigin,
    "https://api.open-meteo.com",
    "https://nominatim.openstreetmap.org",
  ].filter(Boolean).join(" ");
  // Installed before anything else so it also catches library load failures and
  // errors thrown while the widget's own script is still evaluating.
  const logForwarder = opts?.forwardLogs
    ? `  <script nonce="${nonce}">
    (function () {
      function send(level, args) {
        try {
          parent.postMessage({
            type: 'swLog',
            level: level,
            text: Array.prototype.map.call(args, function (a) {
              if (typeof a === 'string') return a;
              try { return JSON.stringify(a); } catch (e) { return String(a); }
            }).join(' ')
          }, '*');
        } catch (e) { /* parent gone or payload not cloneable */ }
      }
      ['log', 'info', 'warn', 'error'].forEach(function (level) {
        var orig = console[level];
        console[level] = function () { send(level, arguments); orig.apply(console, arguments); };
      });
      window.addEventListener('error', function (e) {
        send('error', [e.message + '  (' + (e.filename || 'widget') + ':' + e.lineno + ')']);
      });
      window.addEventListener('unhandledrejection', function (e) {
        var r = e.reason;
        send('error', ['Unhandled promise rejection: ' + ((r && r.message) || String(r))]);
      });
    })();
  <\/script>
`
    : "";
  // The editor's mute button. Best effort: it reaches every <audio>/<video>
  // and every Audio() the widget plays, which is how widgets play sound, but
  // not Web Audio. Only elements this muted are unmuted again, so a widget's
  // own muted video stays muted. Installed first so it sees early play() calls.
  const editorMute = opts?.editor
    ? `  <script nonce="${nonce}">
    (function () {
      var muted = false;
      var seen = [];
      function hush(el) {
        if (muted && !el.muted) { el.muted = true; el.__swEditorMuted = true; }
      }
      function track(el) {
        seen = seen.filter(function (s) { return !s.ended; });
        if (seen.indexOf(el) === -1) seen.push(el);
        hush(el);
      }
      var play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        track(this);
        return play.apply(this, arguments);
      };
      // autoplay never calls play(); its 'play' event doesn't bubble, so capture it.
      document.addEventListener('play', function (e) {
        if (e.target instanceof HTMLMediaElement) track(e.target);
      }, true);
      window.addEventListener('message', function (e) {
        if (!e.data || e.data.type !== 'swSetMuted') return;
        muted = e.data.muted === true;
        var els = seen.concat(Array.prototype.slice.call(document.querySelectorAll('audio,video')));
        els.forEach(function (el) {
          if (muted) hush(el);
          else if (el.__swEditorMuted) { el.muted = false; delete el.__swEditorMuted; }
        });
      });
    })();
  <\/script>
`
    : "";

  // Writes never leave the editor: set/increment/delete land in an in-memory
  // copy the editor owns, and reads prefer that copy over the real store.
  // Registered before the runtime's own message listener so it can swallow a
  // live 'streamwizard.user_state' frame for a key the editor is overriding.
  const editorState = opts?.editor
    ? `
    (function () {
      var sw = window.StreamWizard;
      // undefined: not overridden. userState: key -> value, null = deleted here.
      var widget;
      var user = {};
      // Writes the editor hasn't echoed back yet. Its snapshots trail behind,
      // so one sent before a write must not roll that write back.
      var pendingWidget;
      var pendingUser = {};
      function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
      function has(key) { return Object.prototype.hasOwnProperty.call(user, key); }
      function tell(msg) {
        try { parent.postMessage(msg, '*'); } catch (err) { /* parent gone */ }
      }
      function changed(key, value) {
        window.dispatchEvent(new CustomEvent('onEventReceived', { detail: {
          listener: 'streamwizard.user_state',
          event: { key: key, value: value, updatedAt: new Date().toISOString() }
        } }));
      }
      // Kept in here and taken off the global, so an older widget that
      // fetch()es the raw URLs itself can't write past the editor either.
      var stateUrl = sw.stateUrl;
      var userStateUrl = sw.userStateUrl;
      sw.stateUrl = null;
      sw.userStateUrl = null;
      function canReadWidget() {
        var s = sw.session;
        return !!(stateUrl && s && s.subscriberToken && s.overlayItemId && String(s.overlayItemId).indexOf('temp-') !== 0);
      }
      function canReadUser() {
        return !!(userStateUrl && sw.session && sw.session.subscriberToken);
      }
      async function readReal(url, what) {
        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken } });
        if (!res.ok) throw new Error('Failed to load ' + what + ' (' + res.status + ')');
        return res.json();
      }

      sw.state.get = async function () {
        if (widget !== undefined) return widget;
        if (!canReadWidget()) return {};
        var body = await readReal(stateUrl + '?itemId=' + encodeURIComponent(sw.session.overlayItemId), 'widget state');
        return body.state != null ? body.state : null;
      };
      sw.state.set = async function (state) {
        // Same rule as the real route, so a widget that works here works live.
        if (typeof state !== 'object' || state === null || Array.isArray(state)) {
          throw new Error('Failed to save widget state (400)');
        }
        widget = state;
        pendingWidget = state;
        tell({ type: 'swStateWrite', scope: 'widget', value: state });
      };
      sw.userState.get = async function (key) {
        if (has(key)) return user[key];
        if (!canReadUser()) return null;
        var body = await readReal(userStateUrl + '?key=' + encodeURIComponent(key), 'channel state');
        return body.value != null ? body.value : null;
      };
      sw.userState.getAll = async function () {
        var all = {};
        if (canReadUser()) {
          var body = await readReal(userStateUrl, 'channel state');
          all = body.state != null ? body.state : {};
        }
        var out = {};
        Object.keys(all).forEach(function (k) { out[k] = all[k]; });
        Object.keys(user).forEach(function (k) {
          if (user[k] === null) delete out[k]; else out[k] = user[k];
        });
        return out;
      };
      function write(key, value) {
        // The real route's key rule; 'sys.' keys fail it too, as they do live.
        if (!/^[a-z0-9_]{1,64}$/.test(String(key))) {
          throw new Error('Failed to save channel state (400)');
        }
        user[key] = value;
        pendingUser[key] = value;
        tell({ type: 'swStateWrite', scope: 'user', key: key, value: value });
        changed(key, value);
      }
      sw.userState.set = async function (key, value) { write(key, value == null ? null : value); };
      sw.userState.increment = async function (key, amount) {
        var current = await this.get(key);
        if (current != null && typeof current !== 'number') {
          throw new Error('Failed to increment channel state (' + key + ' is not a number)');
        }
        var next = (current || 0) + (amount == null ? 1 : amount);
        write(key, next);
        return next;
      };
      sw.userState.delete = async function (key) { write(key, null); };

      window.addEventListener('message', function (e) {
        var d = e.data;
        if (!d) return;
        if (d.type === 'swEditorState') {
          var nextWidget = d.widgetState == null ? undefined : d.widgetState;
          if (pendingWidget !== undefined && !same(pendingWidget, nextWidget)) nextWidget = widget;
          else pendingWidget = undefined;
          widget = nextWidget;
          var next = {};
          var given = d.userState || {};
          Object.keys(given).forEach(function (k) { next[k] = given[k]; });
          Object.keys(pendingUser).forEach(function (k) {
            if (!same(pendingUser[k], next[k])) next[k] = user[k];
            else delete pendingUser[k];
          });
          var before = user;
          user = next;
          // Values the streamer typed into the panel reach onChange like a real write.
          Object.keys(next).forEach(function (k) {
            if (JSON.stringify(before[k]) !== JSON.stringify(next[k])) changed(k, next[k]);
          });
          return;
        }
        if (d.type === 'onEventReceived' && d.payload && d.payload.listener === 'streamwizard.user_state' &&
            d.payload.event && has(d.payload.event.key)) {
          e.stopImmediatePropagation();
        }
      });
    })();`
    : "";

  return `<!DOCTYPE html>
<html style="background:transparent!important;background-color:transparent!important;color-scheme:normal">
<head>
  <meta name="color-scheme" content="normal">
  <meta http-equiv="Content-Security-Policy" content="connect-src ${connectSrc}">
${logForwarder}${editorMute}  <script nonce="${nonce}" src="https://cdn.tailwindcss.com"><\/script>
  <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
  <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/TextPlugin.min.js"><\/script>
  <script nonce="${nonce}">
    console.log('[widget] gsap:', typeof gsap, '| TextPlugin:', typeof TextPlugin);
    gsap.registerPlugin(TextPlugin);
  <\/script>
  <style>
    *,html,body{box-sizing:border-box;margin:0;padding:0}
    html,body{background:transparent!important;background-color:transparent!important;color-scheme:normal;width:100%;height:100%;overflow:hidden}
  <\/style>
  <!-- Author CSS is isolated in its own tag so the editor can swap it via
       postMessage without reloading the document and losing widget state. -->
  <style id="sw-extra-css">${resolvedCss}<\/style>
</head>
<body style="background:transparent!important;background-color:transparent!important">
  ${resolvedHtml}
  <script nonce="${nonce}">
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    // Authors that re-apply settings on 'onFieldsUpdate' can be updated in
    // place; the editor reloads the document for the ones that don't, so it
    // needs to know which kind this is before it decides.
    var swHandlesFieldUpdates = false;
    var swOriginalAddEventListener = window.addEventListener.bind(window);
    window.addEventListener = function(type) {
      if (type === 'onFieldsUpdate') swHandlesFieldUpdates = true;
      return swOriginalAddEventListener.apply(null, arguments);
    };
    window.StreamWizard = {
      stateUrl: ${stateUrl},
      userStateUrl: ${userStateUrl},
      session: null,
      /** Latest field values. Replaced on 'onWidgetLoad' and before each 'onFieldsUpdate'. */
      fieldData: ${initialFieldData},
      // Typed wrapper around the raw state API; see the editor's autocomplete
      // (StreamWizardStateApi). Throws outside a placed overlay widget, where
      // there is no session to authenticate with. Editor documents swap these
      // methods for the editor-only versions below.
      state: {
        _require: function() {
          var sw = window.StreamWizard;
          if (!sw.stateUrl || !sw.session || !sw.session.subscriberToken || !sw.session.overlayItemId) {
            throw new Error('StreamWizard.state is only available when the widget runs on an overlay or in the editor.');
          }
          return sw;
        },
        get: async function() {
          var sw = this._require();
          // Token travels in the Authorization header, never the URL
          var res = await fetch(sw.stateUrl + '?itemId=' + encodeURIComponent(sw.session.overlayItemId), {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Failed to load widget state (' + res.status + ')');
          var body = await res.json();
          return body.state != null ? body.state : null;
        },
        set: async function(state) {
          var sw = this._require();
          var res = await fetch(sw.stateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ itemId: sw.session.overlayItemId, state: state })
          });
          if (!res.ok) throw new Error('Failed to save widget state (' + res.status + ')');
        }
      },
      // Channel-wide state. Where .state above is this one placed widget's
      // private blob, this store is shared across the channel AND written by
      // the server -- stream lifecycle lands in 'sys.' keys. That is what lets
      // a widget find out about something that happened while it was closed,
      // instead of only learning it from an event it had to be connected for.
      userState: {
        _require: function() {
          var sw = window.StreamWizard;
          if (!sw.userStateUrl || !sw.session || !sw.session.subscriberToken) {
            throw new Error('StreamWizard.userState is only available when the widget runs on an overlay or in the editor.');
          }
          return sw;
        },
        get: async function(key) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl + '?key=' + encodeURIComponent(key), {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Failed to load channel state (' + res.status + ')');
          var body = await res.json();
          return body.value != null ? body.value : null;
        },
        getAll: async function() {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Failed to load channel state (' + res.status + ')');
          var body = await res.json();
          return body.state != null ? body.state : {};
        },
        set: async function(key, value) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ key: key, value: value })
          });
          if (!res.ok) throw new Error('Failed to save channel state (' + res.status + ')');
        },
        // Server-side atomic add: two widgets (or a mod command and a widget)
        // incrementing at once both count, unlike get-then-set. Numbers only.
        increment: async function(key, amount) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ key: key, op: 'increment', value: amount == null ? 1 : amount })
          });
          if (!res.ok) throw new Error('Failed to increment channel state (' + res.status + ')');
          var body = await res.json();
          return body.value;
        },
        delete: async function(key) {
          var sw = this._require();
          var res = await fetch(sw.userStateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sw.session.subscriberToken },
            body: JSON.stringify({ key: key, op: 'delete' })
          });
          if (!res.ok) throw new Error('Failed to delete channel state (' + res.status + ')');
        },
        // Live updates: every state mutation (this widget, another widget, the
        // server, later chat commands) is pushed into the overlay's room and
        // relayed here as an onEventReceived with listener
        // 'streamwizard.user_state'. Registering is safe anywhere; in the
        // editor it fires for the editor's own writes too. Returns an
        // unsubscribe function.
        onChange: function(callback) {
          var handler = function(e) {
            var d = e.detail;
            if (d && d.listener === 'streamwizard.user_state' && d.event) {
              callback(d.event.key, d.event.value, d.event.updatedAt);
            }
          };
          window.addEventListener('onEventReceived', handler);
          return function() { window.removeEventListener('onEventReceived', handler); };
        },
        subscribe: function(key, callback) {
          return this.onChange(function(changedKey, value, updatedAt) {
            if (changedKey === key) callback(value, updatedAt);
          });
        }
      },
      // Twitch lookups. EventSub hands the widget ids, not pictures; this
      // resolves them via the overlay origin so no Twitch credential ever
      // reaches the iframe. See the widget guide for the full contract.
      twitch: {
        twitchUrl: ${twitchUrl},
        // Assets only. Live counters are deliberately absent from this map --
        // memoising them would reintroduce exactly the staleness the server
        // refuses to introduce.
        _assets: {},
        _require: function() {
          var sw = window.StreamWizard;
          if (!sw.twitch.twitchUrl || !sw.session || !sw.session.subscriberToken) {
            throw new Error('StreamWizard.twitch is only available when the widget runs on an overlay or in the editor.');
          }
          return sw;
        },
        _get: async function(path) {
          var sw = this._require();
          var res = await fetch(sw.twitch.twitchUrl + path, {
            headers: { 'Authorization': 'Bearer ' + sw.session.subscriberToken }
          });
          if (!res.ok) throw new Error('Twitch lookup failed (' + res.status + ') for ' + path);
          return await res.json();
        },
        // One in-flight promise per asset key, kept forever: badge and emote
        // maps change on the order of hours, and the document is reloaded when
        // the overlay is.
        _asset: function(key, path, pick) {
          var self = this;
          if (!self._assets[key]) {
            self._assets[key] = self._get(path).then(pick).catch(function(err) {
              // Don't cache the failure -- a widget that loads during a blip
              // should recover on its next call.
              delete self._assets[key];
              throw err;
            });
          }
          return self._assets[key];
        },
        /** set_id -> version -> {url_1x,url_2x,url_4x,title,description}. */
        badges: function() {
          return this._asset('badges', '/badges', function(b) { return b.badges; });
        },
        /** lowercased prefix -> {prefix, tiers[]}, tiers sorted high to low. */
        cheermotes: function() {
          return this._asset('cheermotes', '/cheermotes', function(b) { return b.cheermotes; });
        },
        /** provider is '7tv', 'bttv' or 'ffz'. Returns code -> emote. */
        thirdPartyEmotes: function(provider) {
          return this._asset('emotes:' + provider, '/emotes?provider=' + encodeURIComponent(provider), function(b) { return b.emotes; });
        },
        /** Batched and memoised per id, so repeat chatters cost nothing. */
        users: async function(ids) {
          var self = this;
          var wanted = [];
          var out = {};
          for (var i = 0; i < ids.length; i++) {
            var key = 'user:' + ids[i];
            if (self._assets[key]) out[ids[i]] = await self._assets[key];
            else if (wanted.indexOf(ids[i]) === -1) wanted.push(ids[i]);
          }
          if (wanted.length) {
            var pending = self._get('/users?ids=' + wanted.map(encodeURIComponent).join(','));
            wanted.forEach(function(id) {
              self._assets['user:' + id] = pending.then(function(b) { return b.users[id]; });
            });
            var body = await pending;
            wanted.forEach(function(id) { out[id] = body.users[id]; });
          }
          return out;
        },
        user: async function(id) {
          var users = await this.users([id]);
          return users[id];
        },
        game: function(id) {
          return this._asset('game:' + id, '/game?id=' + encodeURIComponent(id), function(b) { return b.game; });
        },
        // --- live values: never memoised, never cached ---
        // Fetch at load for the true starting value, adjust locally from
        // events, and re-anchor every minute or so -- events can drop or
        // replay across a reconnect, so a counter that is only incremented
        // drifts over a long stream.
        followerTotal: async function() {
          var body = await this._get('/followers');
          return body.total;
        },
        subTotal: async function() {
          var body = await this._get('/subscribers');
          return body.total;
        },
        stream: async function() {
          var body = await this._get('/stream');
          return body.stream;
        },
        // --- local resolvers: no network, need the map fetched first ---
        /** badge is an EventSub badges[] entry: {set_id, id, info}. */
        badgeUrl: function(badge, scale) {
          var map = this._badgeMap;
          if (!map || !badge) return undefined;
          var versions = map[badge.set_id];
          var version = versions && versions[badge.id];
          if (!version) return undefined;
          return version['url_' + (scale || '2x')] || version.url_2x;
        },
        /** fragment is a message fragment's .cheermote: {prefix, bits, tier}. */
        cheermoteUrl: function(fragment, options) {
          var map = this._cheermoteMap;
          if (!map || !fragment) return undefined;
          var entry = map[String(fragment.prefix).toLowerCase()];
          if (!entry) return undefined;
          var opts = options || {};
          // Tiers are sorted descending, so the first one the cheer covers wins.
          var tier = null;
          for (var i = 0; i < entry.tiers.length; i++) {
            if (fragment.bits >= entry.tiers[i].min_bits) { tier = entry.tiers[i]; break; }
          }
          if (!tier) tier = entry.tiers[entry.tiers.length - 1];
          if (!tier) return undefined;
          var theme = tier.images[opts.theme || 'dark'] || tier.images.dark || {};
          var format = theme[opts.format || 'animated'] || theme.animated || theme.static || {};
          return format[opts.scale || '4'] || format['2'] || format['1'];
        },
        /**
         * Fetches badges and cheermotes and keeps them for the synchronous
         * badgeUrl/cheermoteUrl resolvers. Call once at load; after it settles,
         * per-message rendering is a plain object lookup with no awaits.
         */
        ready: async function() {
          var self = this;
          var maps = await Promise.all([self.badges(), self.cheermotes()]);
          self._badgeMap = maps[0];
          self._cheermoteMap = maps[1];
          return { badges: maps[0], cheermotes: maps[1] };
        }
      }
    };
    // The bare 'fieldData' global the docs and starters have always used. A
    // property, not a declaration: widget JS shares this script, so a 'var',
    // 'let' or 'const' here would make an author's own top-level
    // 'const fieldData' a SyntaxError. Kept in step with StreamWizard.fieldData.
    window.fieldData = window.StreamWizard.fieldData;${editorState}
    window.addEventListener('message', function(e) {
      if (e.data.type === 'onWidgetLoad') {
        if (e.data.payload && e.data.payload.session) window.StreamWizard.session = e.data.payload.session;
        if (e.data.payload && e.data.payload.fieldData) window.StreamWizard.fieldData = window.fieldData = e.data.payload.fieldData;
        window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: e.data.payload }));
      }
      // A setting changed while the document stayed loaded. Widgets that act on
      // this keep their runtime state; the reply tells the editor whether this
      // one did, so it can fall back to a reload for widgets that read
      // fieldData once at load.
      if (e.data.type === 'swFieldData') {
        window.StreamWizard.fieldData = window.fieldData = e.data.fieldData || {};
        window.dispatchEvent(new CustomEvent('onFieldsUpdate', { detail: { fieldData: window.StreamWizard.fieldData } }));
        try {
          parent.postMessage({ type: 'swFieldDataApplied', handled: swHandlesFieldUpdates }, '*');
        } catch (err) { /* parent gone */ }
      }
      if (e.data.type === 'onEventReceived') window.dispatchEvent(new CustomEvent('onEventReceived', { detail: e.data.payload }));
      if (e.data.type === 'onSessionUpdate') window.dispatchEvent(new CustomEvent('onSessionUpdate', { detail: e.data.payload }));
      // Editor-only: hot-swap author CSS in place. HTML and JS still need a
      // document reload, but CSS is the tab people iterate on most.
      if (e.data.type === 'swPatchCss') {
        var styleEl = document.getElementById('sw-extra-css');
        if (styleEl) styleEl.textContent = e.data.css || '';
      }
    });
    ${js}
  <\/script>
</body>
</html>`;
}
