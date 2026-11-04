/**
 * "The same failure" as a short key: ids and numbers blanked, so "clip 123
 * failed" and "clip 456 failed" share one key. Used by the throttle and the
 * error limiter.
 */
export function failureKey(text: string): string {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 200);
}
