/** Why a sync didn't start: one is running, or one started within the cooldown. */
export type ClipSyncSkipped = { skipped: true; running: boolean; lastSync: string | null };

export type ClipSyncStart = { started: true } | ClipSyncSkipped;

interface ClipSyncStarterDeps {
  /** Takes the user's sync slot, or says why it can't be taken. */
  claim: (broadcasterId: string) => Promise<{ claimed: true; userId: string } | ClipSyncSkipped>;
  /** Runs a claimed sync to the end and records the result on the sync row. */
  run: (userId: string) => Promise<number>;
  reportError: (error: unknown, context: string, extra?: Record<string, unknown>) => void;
}

/**
 * Starts a clip sync without waiting for it. The claim is awaited, so the
 * cooldown and "already running" answers still reach the caller; the sync
 * itself carries on after the caller has its answer. A sync that fails has
 * already marked its row failed, so here it only goes to Sentry.
 */
export function createClipSyncStarter(deps: ClipSyncStarterDeps) {
  return async function startClipSync(broadcasterId: string): Promise<ClipSyncStart> {
    const claim = await deps.claim(broadcasterId);
    if (!("claimed" in claim)) return claim;

    const { userId } = claim;
    deps.run(userId).catch((error: unknown) => {
      deps.reportError(error, "clips-sync.run", { userId });
    });
    return { started: true };
  };
}
