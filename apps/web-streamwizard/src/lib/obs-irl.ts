// The fixed scene/source StreamWizard auto-wires a user's primary ingest key
// into. Fixed names (rather than per-key naming) keep the auto-wire and
// missing-source checks a simple lookup instead of a persisted mapping.
export const IRL_SCENE_NAME = "IRL";
export const IRL_SOURCE_NAME = "StreamWizard Ingest";

// Every StreamWizard Cloud OBS instance ships with this scene pre-built —
// it's meant to be cloned into other scenes as a source (OBS's "Scene" as a
// source), not switched to directly, so it's excluded from the scene picker
// via useObsWebSocket's `_`/`-` prefix filter.
export const ALERTS_SCENE_NAME = "_alerts";

// The default template scene every instance boots with, named as a nudge for
// the user to remove it. Not a real destination for anything, so it's left
// out of scene pickers even though it isn't `_`/`-` prefixed.
export const WELCOME_SCENE_NAME = "Welcome (Delete me)";

// SRT receiver latency for the OBS pull. This hop is server-to-server over the
// tailnet (RTT single-digit to ~30ms), so 300ms (~10x worst-case RTT) is ample
// retransmit budget — the 4s cellular safety buffer lives on the ingest
// ingress side (INGEST_SRT_INGRESS_LATENCY_MS). SRT negotiates
// max(sender, receiver), so this must stay in sync with
// INGEST_SRT_EGRESS_LATENCY_MS on the ingest node or the higher value wins.
export const OBS_PULL_LATENCY_MS = 300;

/** The SRT URL an OBS Media Source uses to pull a feed from the ingest server.
 * `host` is the ingest node's tailnet IP, resolved server-side from the linked
 * node and threaded down (see CloudObsPage). */
export function obsPullUrl(host: string, outputKey: string) {
  return `srt://${host}:9000?streamid=${outputKey}&latency=${OBS_PULL_LATENCY_MS}`;
}
