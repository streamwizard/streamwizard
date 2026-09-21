// When each broadcaster last sent stream.offline, in this process. stream.online
// can spend a couple of minutes waiting for Helix to list the stream; if the
// stream ends in that window, offline has already marked the channel not live
// and online must not flip it back.
const lastOfflineAt = new Map<string, number>();

export function markStreamOffline(broadcasterId: string): void {
  lastOfflineAt.set(broadcasterId, Date.now());
}

export function wentOfflineSince(broadcasterId: string, since: number): boolean {
  return (lastOfflineAt.get(broadcasterId) ?? 0) >= since;
}
