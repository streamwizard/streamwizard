import { env } from "@/env";

// The latency budget of StreamWizard Live sessions (SWIRL-133). The session
// owns it: the phone takes latency_ms from POST /api/live/sessions and the
// ingest node from its lookup, so the two ends can't differ. Both answers
// read it here, from LIVE_LATENCY_MS.
//
// There is no column for it: a session gets the value current at each
// answer. It only changes with a restart, so a session created before a
// restart that changed LIVE_LATENCY_MS and looked up after it would get two
// values; the node would then use the new one while the phone keeps the
// old one. Acceptable while the value is one per deployment; a per-session
// budget needs a column.

/** latency_ms for a session answer, in milliseconds (800..5000). */
export function sessionLatencyMs(): number {
  return env.LIVE_LATENCY_MS;
}
