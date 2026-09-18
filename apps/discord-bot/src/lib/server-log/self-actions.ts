// Things the bot is about to do to the server (create a ticket channel, give
// the join role) so the server log doesn't report them as staff actions. The
// audit log also identifies the bot as executor, but only when the bot can
// read it; this works without that permission. Entries expire on their own.

export type SelfActionKind = "channel" | "roles";

const TTL_MS = 30_000;

const marks = new Map<string, ReturnType<typeof setTimeout>>();

const key = (kind: SelfActionKind, id: string) => `${kind}:${id}`;

/** Call right before the bot performs the action; the gateway event follows within seconds. */
export function markSelfAction(kind: SelfActionKind, id: string): void {
  const k = key(kind, id);
  const existing = marks.get(k);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => marks.delete(k), TTL_MS);
  timer.unref?.();
  marks.set(k, timer);
}

/** Whether the bot marked this id recently. Does not consume the mark: one action can raise several events. */
export function isSelfAction(kind: SelfActionKind, id: string): boolean {
  return marks.has(key(kind, id));
}
