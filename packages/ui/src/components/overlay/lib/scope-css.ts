/**
 * Streamer-written CSS, fenced in to one element. Every rule is rewritten to
 * sit under `scope`, so CSS for one alert box can't reach another widget on
 * the scene, or the dashboard around the editor canvas.
 *
 * Hand-rolled rather than native nesting or `@scope`: OBS ships an older
 * Chromium that has neither. It reads just enough CSS to be safe, and the
 * output is always balanced, whatever goes in:
 * - each selector in a list gets the scope in front; `:root`, `html` and
 *   `body` become the scope itself
 * - `@media`, `@supports`, `@container` and `@layer` blocks are scoped inside
 * - `@keyframes` pass through as they are
 * - every other at-rule (`@import`, `@font-face`, `@charset`…) is dropped
 * - a rule with a nested block, or with no selector, is dropped
 * - `<` never reaches the output, so nothing can close the `<style>` tag
 * Anything else that is invalid is left for the browser, which skips it.
 */

const GROUPING_AT_RULES = new Set(["media", "supports", "container", "layer"]);
const KEYFRAMES_AT_RULES = new Set(["keyframes", "-webkit-keyframes"]);

/** Most nesting followed; deeper @media inside @supports inside… is dropped. */
const MAX_DEPTH = 4;

export function scopeCss(css: string, scope: string): string {
  if (!css.trim()) return "";
  const clean = css.replace(/\/\*[\s\S]*?(\*\/|$)/g, "").replace(/</g, "");
  return scopeBlock(clean, scope, 0);
}

/** Index just past the string that opens at `i`, or the end of the text. */
function skipString(css: string, i: number): number {
  const quote = css[i];
  let j = i + 1;
  while (j < css.length && css[j] !== quote) {
    if (css[j] === "\\") j++;
    // An unclosed string ends at the line, as it does for the browser.
    if (css[j] === "\n") return j;
    j++;
  }
  return j + 1;
}

/**
 * Index of the first of `stops` at the top level from `i`, outside strings,
 * brackets and parentheses; -1 when there is none.
 */
function findTopLevel(css: string, i: number, stops: string): number {
  let depth = 0;
  for (let j = i; j < css.length; j++) {
    const c = css[j]!;
    if (c === '"' || c === "'") {
      j = skipString(css, j) - 1;
    } else if (c === "(" || c === "[") {
      depth++;
    } else if (c === ")" || c === "]") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && stops.includes(c)) {
      return j;
    }
  }
  return -1;
}

/** Index of the `}` closing the block opened at `open`; -1 when unclosed. */
function findBlockEnd(css: string, open: number): number {
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    const c = css[j]!;
    if (c === '"' || c === "'") {
      j = skipString(css, j) - 1;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/** The scope plus `selector`; the page roots stand for the scope itself. */
function scopeSelector(selector: string, scope: string): string {
  const pageRoot = /^(?::root|html|body)(?=$|[\s>+~.:#[])/i;
  let rest = selector;
  let rooted = false;
  // `html body .x` is still just "inside the alert".
  for (;;) {
    const m = pageRoot.exec(rest);
    if (!m) break;
    rooted = true;
    rest = rest.slice(m[0].length);
    if (!/^\s+(?::root|html|body)(?=$|[\s>+~.:#[])/i.test(rest)) break;
    rest = rest.trimStart();
  }
  return rooted ? `${scope}${rest}` : `${scope} ${selector}`;
}

function scopeSelectorList(prelude: string, scope: string): string {
  const parts: string[] = [];
  let start = 0;
  for (;;) {
    const comma = findTopLevel(prelude, start, ",");
    const part = prelude.slice(start, comma === -1 ? undefined : comma).trim();
    if (part) parts.push(scopeSelector(part, scope));
    if (comma === -1) break;
    start = comma + 1;
  }
  return parts.join(",");
}

function scopeBlock(css: string, scope: string, depth: number): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /[\s;}]/.test(css[i]!)) i++;
    if (i >= css.length) break;

    const stop = findTopLevel(css, i, "{;}");
    // Trailing text with no block: a declaration list with no rule, dropped.
    if (stop === -1) break;
    if (css[stop] !== "{") {
      i = stop + 1;
      continue;
    }

    const prelude = css.slice(i, stop).trim();
    const end = findBlockEnd(css, stop);
    // An unclosed block runs to the end, as the browser reads it.
    const body = css.slice(stop + 1, end === -1 ? undefined : end);
    i = end === -1 ? css.length : end + 1;

    if (prelude.startsWith("@")) {
      const name = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase() ?? "";
      if (GROUPING_AT_RULES.has(name) && depth < MAX_DEPTH) {
        const inner = scopeBlock(body, scope, depth + 1);
        if (inner) out += `${prelude}{${inner}}`;
      } else if (KEYFRAMES_AT_RULES.has(name) && balanced(body)) {
        out += `${prelude}{${body}}`;
      }
      continue;
    }

    // Nesting needs a newer browser than OBS has; skip the rule outright.
    if (body.includes("{") || !prelude) continue;
    const selectors = scopeSelectorList(prelude, scope);
    if (selectors) out += `${selectors}{${body.trim()}}`;
  }
  return out;
}

/** Whether every `{` in `css` (outside strings) has its `}`. */
function balanced(css: string): boolean {
  let depth = 0;
  for (let j = 0; j < css.length; j++) {
    const c = css[j]!;
    if (c === '"' || c === "'") j = skipString(css, j) - 1;
    else if (c === "{") depth++;
    else if (c === "}" && --depth < 0) return false;
  }
  return depth === 0;
}
