// Discord lets a channel be renamed twice per ten minutes. Past that it
// answers 429 and discord.js would quietly hold the rename until the window
// opens, leaving /voice-rename hanging. This keeps the bot's own count per
// channel so it can say "not yet, try again at ..." up front, and takes
// Discord's word for it when Discord knows better (another bot or a person
// renamed the channel, or the bot restarted and lost its count).

export const RENAME_LIMIT = 2;
export const RENAME_WINDOW_MS = 10 * 60 * 1000;

export class RenameLimiter {
  private readonly history = new Map<string, number[]>();
  private readonly blockedUntil = new Map<string, number>();

  constructor(
    private readonly limit = RENAME_LIMIT,
    private readonly windowMs = RENAME_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Milliseconds until `channelId` can be renamed again. 0 when it can right now. */
  waitMs(channelId: string): number {
    const now = this.now();
    const recent = this.recent(channelId, now);
    const blocked = Math.max(0, (this.blockedUntil.get(channelId) ?? 0) - now);
    const oldest = recent[0];
    const byCount = recent.length >= this.limit && oldest !== undefined ? oldest + this.windowMs - now : 0;
    return Math.max(blocked, byCount, 0);
  }

  /** A rename went through. */
  record(channelId: string): void {
    const now = this.now();
    this.history.set(channelId, [...this.recent(channelId, now), now]);
  }

  /** Discord refused with a rate limit: nothing gets through for `ms`. */
  block(channelId: string, ms: number): void {
    this.blockedUntil.set(channelId, this.now() + Math.max(0, ms));
  }

  /** The channel is gone. */
  forget(channelId: string): void {
    this.history.delete(channelId);
    this.blockedUntil.delete(channelId);
  }

  private recent(channelId: string, now: number): number[] {
    const kept = (this.history.get(channelId) ?? []).filter((at) => now - at < this.windowMs);
    if (kept.length === 0) this.history.delete(channelId);
    else this.history.set(channelId, kept);
    if ((this.blockedUntil.get(channelId) ?? 0) <= now) this.blockedUntil.delete(channelId);
    return kept;
  }
}
