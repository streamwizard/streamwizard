import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { listTwitchIntegrationsWithToken, setTwitchScopesByBroadcasterId } from "@repo/supabase/queries/twitch-scopes";
import { TwitchApi } from "@repo/twitch-api";

/**
 * Twitch requires apps to validate every user token on start-up and hourly
 * after that. The validate response also names the token's scopes, so the
 * same sweep keeps integrations_twitch.twitch_scopes current, which is what
 * the dashboard reads to decide whether to ask for a feature's scopes.
 */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/** Let the process settle before the first pass; every restart runs one. */
const FIRST_SWEEP_DELAY_MS = 60 * 1000;

/** Concurrent validate calls. Each one is a single id.twitch.tv request. */
const CONCURRENCY = 4;

export interface TwitchTokenValidatorDeps {
  listBroadcasters: () => Promise<string[]>;
  validate: (broadcasterId: string) => Promise<{ scopes: string[] }>;
  saveScopes: (broadcasterId: string, scopes: string[]) => Promise<void>;
  onError?: (broadcasterId: string, error: unknown) => void;
}

export interface SweepResult {
  checked: number;
  synced: number;
  failed: number;
}

export function createTwitchTokenValidator(deps: TwitchTokenValidatorDeps) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<SweepResult> | null = null;

  /**
   * One pass over every stored token. A failure for one broadcaster is
   * counted and reported, never thrown: a dead token (revoked, refresh
   * rejected) is the normal reason, and user.authorization.revoke already
   * cleans those accounts up.
   */
  async function sweep(): Promise<SweepResult> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const result: SweepResult = { checked: 0, synced: 0, failed: 0 };
      let broadcasters: string[];
      try {
        broadcasters = await deps.listBroadcasters();
      } catch (error) {
        reportError(error, "twitch-token-validator: list");
        return result;
      }

      const queue = [...broadcasters];
      const worker = async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          result.checked++;
          try {
            const { scopes } = await deps.validate(id);
            await deps.saveScopes(id, scopes);
            result.synced++;
          } catch (error) {
            result.failed++;
            deps.onError?.(id, error);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return result;
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function start(): void {
    if (timer) return;
    const run = () =>
      sweep()
        .then((r) => console.log(`[twitch-token-validator] checked ${r.checked}, synced ${r.synced}, failed ${r.failed}`))
        .catch((error) => reportError(error, "twitch-token-validator: sweep"));
    setTimeout(run, FIRST_SWEEP_DELAY_MS).unref?.();
    timer = setInterval(run, SWEEP_INTERVAL_MS);
    timer.unref?.();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { sweep, start, stop };
}

export const twitchTokenValidator = createTwitchTokenValidator({
  listBroadcasters: async () => (await listTwitchIntegrationsWithToken(supabase)).map((row) => row.twitch_user_id),
  validate: (broadcasterId) => new TwitchApi(broadcasterId).auth.validateUserToken(),
  saveScopes: async (broadcasterId, scopes) => {
    const { error } = await setTwitchScopesByBroadcasterId(supabase, broadcasterId, scopes);
    if (error) throw error;
  },
  // A refresh that Twitch rejects is already written to the token refresh log
  // by @repo/twitch-api; a line here is enough to trace the sweep itself.
  onError: (broadcasterId, error) =>
    console.warn("[twitch-token-validator] token failed validation", {
      broadcasterId,
      error: (error as Error).message,
    }),
});
