const warned = new Set<string>();

/**
 * Logs `message` the first time `key` comes up in this process. For dropped
 * frames: a sender stuck on a bad shape shows up once in the logs instead of
 * once per frame (the drop metrics still count every one). Keys are a fixed
 * set like "bot:malformed_json", never ids, so the set stays small.
 */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}
