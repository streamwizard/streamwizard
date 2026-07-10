export interface WidgetFieldDef {
  type: string;
  label?: string;
  value?: unknown;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
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
  overlayOrigin?: string
): string {
  const { resolvedHtml, resolvedCss } = resolveWidgetTemplate(html, extraCss, fields, fieldValues);
  const stateUrl = overlayOrigin ? JSON.stringify(`${overlayOrigin}/api/widgets/state`) : "null";
  const nonce = documentNonce();
  const connectSrc = [
    overlayOrigin,
    "https://api.open-meteo.com",
    "https://nominatim.openstreetmap.org",
  ].filter(Boolean).join(" ");
  return `<!DOCTYPE html>
<html style="background:transparent!important;background-color:transparent!important;color-scheme:normal">
<head>
  <meta name="color-scheme" content="normal">
  <meta http-equiv="Content-Security-Policy" content="connect-src ${connectSrc}">
  <script nonce="${nonce}" src="https://cdn.tailwindcss.com"><\/script>
  <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
  <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/TextPlugin.min.js"><\/script>
  <script nonce="${nonce}">
    console.log('[widget] gsap:', typeof gsap, '| TextPlugin:', typeof TextPlugin);
    gsap.registerPlugin(TextPlugin);
  <\/script>
  <style>
    *,html,body{box-sizing:border-box;margin:0;padding:0}
    html,body{background:transparent!important;background-color:transparent!important;color-scheme:normal;width:100%;height:100%;overflow:hidden}
    ${resolvedCss}
  <\/style>
</head>
<body style="background:transparent!important;background-color:transparent!important">
  ${resolvedHtml}
  <script nonce="${nonce}">
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    window.StreamWizard = { stateUrl: ${stateUrl} };
    window.addEventListener('message', function(e) {
      if (e.data.type === 'onWidgetLoad') window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: e.data.payload }));
      if (e.data.type === 'onEventReceived') window.dispatchEvent(new CustomEvent('onEventReceived', { detail: e.data.payload }));
      if (e.data.type === 'onSessionUpdate') window.dispatchEvent(new CustomEvent('onSessionUpdate', { detail: e.data.payload }));
    });
    ${js}
  <\/script>
</body>
</html>`;
}
