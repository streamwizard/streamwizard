import type { Page } from "playwright";
import type { Redaction } from "./manifest";

/**
 * Substitute a plausible value in place of a real one. docs/branding.md is
 * explicit that a black box is the wrong answer: it points at exactly the part
 * you were trying to hide.
 */
export async function applyRedactions(page: Page, redactions: readonly Redaction[] = []) {
  for (const r of redactions) {
    await page.$$eval(
      r.selector,
      (els, spec) => {
        for (const el of els) {
          if (spec.text !== undefined) el.textContent = spec.text;
          if (spec.attr) el.setAttribute(spec.attr.name, spec.attr.value);
        }
      },
      r,
    );
  }
}

/**
 * A redaction that silently stops matching after a refactor is worse than no
 * redaction, because nobody finds out until the screenshot is published. These
 * patterns fail the shot instead.
 */
const LEAK_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["an email address", /[\w.+-]+@(?!example\.(?:com|org))[\w-]+\.[\w.]{2,}/],
  ["a JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ["a Supabase key", /\bsb(?:p|_)[a-z]*_[A-Za-z0-9_-]{20,}/],
  ["a Twitch stream key", /\blive_\d{6,}_[A-Za-z0-9]{20,}/],
  ["an SRT stream id", /streamid=[^\s&"']{16,}/],
  ["an ingest key", /\b[0-9a-f]{64}\b/],
  // An overlay URL is the key to that overlay's live data: branding doc §8.
  ["an overlay id", /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/],
  ["the real account name", /\bjochemwhite\b/i],
];

/** Everything a viewer could read off the page, including attribute values. */
async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [document.body?.innerText ?? ""];
    for (const el of document.querySelectorAll("[href],[src],[value],[title],[alt]")) {
      for (const attr of ["href", "src", "value", "title", "alt"]) {
        const v = el.getAttribute(attr);
        if (v) parts.push(v);
      }
    }
    return parts.join("\n");
  });
}

export async function assertNoLeaks(page: Page, shotId: string): Promise<void> {
  const text = await visibleText(page);
  for (const [label, pattern] of LEAK_PATTERNS) {
    const hit = text.match(pattern);
    if (hit) {
      throw new Error(
        `${shotId}: ${label} is visible on the page (${hit[0].slice(0, 32)}…). ` +
          `Add a redaction for it, or change the fixture.`,
      );
    }
  }
}
