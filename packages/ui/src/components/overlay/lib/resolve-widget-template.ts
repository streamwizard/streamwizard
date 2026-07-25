export interface WidgetFieldDef {
  // Free-form, but the editors special-case: "text", "number", "color",
  // "dropdown", "checkbox", and the media-library asset types "image",
  // "audio", "video" (value = public CDN URL string).
  type: string;
  label?: string;
  value?: unknown;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
}

/** Field types whose value is a media-library asset URL. */
export const ASSET_FIELD_TYPES = ["image", "audio", "video"] as const;

export function isAssetFieldType(type: string): boolean {
  return (ASSET_FIELD_TYPES as readonly string[]).includes(type);
}

export type WidgetFieldSchema = Record<string, WidgetFieldDef>;

export function mergeFieldValues(
  fields: WidgetFieldSchema,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(fields)) {
    result[key] = key in overrides ? overrides[key] : def.value;
  }
  return result;
}

export function resolveWidgetTemplate(
  html: string,
  extraCss: string,
  fields: WidgetFieldSchema,
  fieldValues: Record<string, unknown>
): { resolvedHtml: string; resolvedCss: string } {
  const merged = mergeFieldValues(fields, fieldValues);
  const replace = (template: string) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      key in merged ? String(merged[key] ?? "") : ""
    );
  return { resolvedHtml: replace(html), resolvedCss: replace(extraCss) };
}

// srcdoc iframes inherit the embedding page's CSP. The dashboard serves a
// nonce-based script-src without 'unsafe-inline', so every script tag below
// (inline and CDN) must carry the page's nonce to execute there. The nonce
// content attribute is hidden from the DOM, but the IDL property on any of
// Next's own nonce'd scripts still exposes it. Under the overlay app's
// 'unsafe-inline' policy the attribute is inert, so stamping is always safe.
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
  }
): string {
  const { resolvedHtml, resolvedCss } = resolveWidgetTemplate(html, extraCss, fields, fieldValues);
  const stateUrl = overlayOrigin ? JSON.stringify(`${overlayOrigin}/api/widgets/state`) : "null";
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

  return `<!DOCTYPE html>
<html style="background:transparent!important;background-color:transparent!important;color-scheme:normal">
<head>
  <meta name="color-scheme" content="normal">
  <meta http-equiv="Content-Security-Policy" content="connect-src ${connectSrc}">
${logForwarder}  <script nonce="${nonce}" src="https://cdn.tailwindcss.com"><\/script>
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
    window.StreamWizard = {
      stateUrl: ${stateUrl},
      session: null,
      // Typed wrapper around the raw state API; see the editor's autocomplete
      // (StreamWizardStateApi). Throws outside a placed overlay widget, where
      // there is no session to authenticate with.
      state: {
        _require: function() {
          var sw = window.StreamWizard;
          if (!sw.stateUrl || !sw.session || !sw.session.subscriberToken || !sw.session.overlayItemId) {
            throw new Error('StreamWizard.state is only available when the widget runs on an overlay (not in the editor preview).');
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
      }
    };
    window.addEventListener('message', function(e) {
      if (e.data.type === 'onWidgetLoad') {
        if (e.data.payload && e.data.payload.session) window.StreamWizard.session = e.data.payload.session;
        window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: e.data.payload }));
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
