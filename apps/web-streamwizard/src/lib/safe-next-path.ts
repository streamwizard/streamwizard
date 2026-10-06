// Stand-in origin for resolving a candidate path. `.invalid` never resolves
// (RFC 2606), so it can't collide with a host someone actually owns.
const PROBE_ORIGIN = "https://self.invalid";

// Backslashes and ASCII control characters. Browsers read "\" as "/" and drop
// tabs and newlines while parsing a URL, so "/\evil.example" and
// "/<tab>/evil.example" both end up as "//evil.example", another site.
const UNSAFE_CHARS = /[\\\u0000-\u001f\u007f]/;

/**
 * Returns `next` when it is a path on this site, and null when it is anything
 * else, so a `?next=` value or a server action argument can be handed to
 * `redirect()` or `router.push()` without sending the user somewhere else.
 *
 * The value comes back untouched, query string and hash included.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (UNSAFE_CHARS.test(next)) return null;

  // Belt and braces: whatever the rules above let through must still land on
  // the origin it was resolved against.
  try {
    if (new URL(next, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return null;
  } catch {
    return null;
  }

  return next;
}
