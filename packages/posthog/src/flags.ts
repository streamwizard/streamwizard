import { PostHog } from "posthog-node";

// Every flag the server checks. A typo in a flag key would silently read as
// "off", so the keys are typed here the same way events are in event-map.ts.
export const FEATURE_FLAGS = ["cms-admin", "cms-public", "cms-comments"] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

// What a flag check asks PostHog: the values of `keys` for one distinct id.
export type FlagSource = (distinctId: string, keys: readonly string[]) => Promise<Record<string, unknown>>;

interface FlagReaderOptions {
  // null when PostHog isn't configured: every flag reads as off.
  source: FlagSource | null;
  // Read on every check, so a test (or a config reload) can change it.
  overrides?: () => Map<string, boolean>;
  ttlMs?: number;
  timeoutMs?: number;
  now?: () => number;
  onError?: (error: unknown) => void;
}

interface Snapshot {
  values: Record<string, unknown>;
  expiresAt: number;
}

// Public pages check a flag on every request, so one /flags round trip per
// distinct id is cached for ttlMs. All known flags are fetched together:
// a page that checks two flags costs one request, not two.
const DEFAULT_TTL_MS = 30_000;

// A flag check sits in front of a page render. PostHog being slow must not
// make the page slow, so the check gives up and falls back after this long.
const DEFAULT_TIMEOUT_MS = 1_500;

// Who an anonymous check is evaluated for. Flags gating public pages are
// global (on or off for everyone), so the id only has to be stable.
export const ANONYMOUS_FLAG_ID = "anonymous";

// FEATURE_FLAG_OVERRIDES="cms-admin,cms-public=false" for local dev and tests.
// A bare key means on. Unknown keys are kept so a new flag works before it is
// added to FEATURE_FLAGS.
export function parseFlagOverrides(raw: string | undefined): Map<string, boolean> {
  const overrides = new Map<string, boolean>();
  for (const part of (raw ?? "").split(",")) {
    const [rawKey, rawValue] = part.split("=", 2);
    const key = rawKey?.trim();
    if (!key) continue;
    const value = rawValue?.trim().toLowerCase();
    overrides.set(key, value === undefined || value === "" || value === "true" || value === "1" || value === "on");
  }
  return overrides;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`feature flag request timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Never throws. On any failure the last known value wins (even if expired),
// so a PostHog hiccup can't switch a live feature off; with nothing known yet
// the answer is off.
export function createFlagReader(options: FlagReaderOptions) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const snapshots = new Map<string, Snapshot>();
  const inFlight = new Map<string, Promise<Record<string, unknown> | null>>();

  async function load(distinctId: string): Promise<Record<string, unknown> | null> {
    const source = options.source;
    if (!source) return null;
    try {
      const values = await withTimeout(source(distinctId, FEATURE_FLAGS), timeoutMs);
      snapshots.set(distinctId, { values, expiresAt: now() + ttlMs });
      return values;
    } catch (error) {
      options.onError?.(error);
      return snapshots.get(distinctId)?.values ?? null;
    }
  }

  return async function isFlagEnabled(flag: FeatureFlag, distinctId: string = ANONYMOUS_FLAG_ID): Promise<boolean> {
    const override = options.overrides?.().get(flag);
    if (override !== undefined) return override;

    const cached = snapshots.get(distinctId);
    let values: Record<string, unknown> | null;
    if (cached && cached.expiresAt > now()) {
      values = cached.values;
    } else {
      let pending = inFlight.get(distinctId);
      if (!pending) {
        pending = load(distinctId).finally(() => inFlight.delete(distinctId));
        inFlight.set(distinctId, pending);
      }
      values = await pending;
    }
    // Multivariate flags count as on for any variant.
    const value = values?.[flag];
    return value === true || (typeof value === "string" && value.length > 0);
  };
}

let flagClient: PostHog | null | undefined;
let reportFlagError: (error: unknown) => void = (error) => console.error("[posthog] flags", error);

// Its own client, separate from tracking: tracking only sends from deployed
// environments, but local dev should read the (staging) flags too. It never
// captures anything. With POSTHOG_FLAGS_SECRET_KEY set, flags are evaluated
// locally from definitions polled every 30 s instead of one /flags request
// per check.
function getFlagClient(): PostHog | null {
  if (flagClient !== undefined) return flagClient;
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    flagClient = null;
    return flagClient;
  }
  flagClient = new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    secretKey: process.env.POSTHOG_FLAGS_SECRET_KEY || undefined,
    featureFlagsPollingInterval: 30_000,
    disableGeoip: true,
  });
  flagClient.on("error", (error: unknown) => reportFlagError(error));
  return flagClient;
}

const defaultReader = createFlagReader({
  // getAllFlags, not evaluateFlags: reading a value through the snapshot fires
  // a $feature_flag_called event, and a flag check must not record anything.
  source: (distinctId, keys) => {
    const client = getFlagClient();
    if (!client) return Promise.resolve({});
    return client.getAllFlags(distinctId, { flagKeys: [...keys], disableGeoip: true });
  },
  overrides: (() => {
    let source: string | undefined;
    let parsed = new Map<string, boolean>();
    return () => {
      const current = process.env.FEATURE_FLAG_OVERRIDES;
      if (current !== source) {
        source = current;
        parsed = parseFlagOverrides(current);
      }
      return parsed;
    };
  })(),
  onError: (error) => reportFlagError(error),
});

// Is `flag` on for this account (or, without an id, for everyone)? Server
// only. Call it outside any cached function, so flipping a flag in PostHog
// takes effect without a cache revalidation.
export function isFlagEnabled(flag: FeatureFlag, distinctId?: string): Promise<boolean> {
  return defaultReader(flag, distinctId);
}

export function configureFlags(next: { onError?: (error: unknown) => void }): void {
  if (next.onError) reportFlagError = next.onError;
}

export async function shutdownFlags(): Promise<void> {
  try {
    await flagClient?.shutdown();
  } catch (error) {
    reportFlagError(error);
  }
}
