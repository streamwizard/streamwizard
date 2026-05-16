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

export function buildWidgetSrcdoc(
  html: string,
  js: string,
  extraCss: string,
  fields: WidgetFieldSchema,
  fieldValues: Record<string, unknown>
): string {
  const { resolvedHtml, resolvedCss } = resolveWidgetTemplate(html, extraCss, fields, fieldValues);
  return `<!DOCTYPE html>
<html style="background:transparent!important;background-color:transparent!important;color-scheme:normal">
<head>
  <meta name="color-scheme" content="normal">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/TextPlugin.min.js"><\/script>
  <script>
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
  <script>
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
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
