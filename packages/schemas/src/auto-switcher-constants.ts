// Plain auto switcher data with no zod at runtime: the sensitivity presets,
// their wording and the default chat notices. Kept apart from ./auto-switcher
// and ./auto-switcher-form so the marketing pages can show the real numbers and
// strings without shipping zod. Bundle-sensitive code imports it as
// "@repo/schemas/auto-switcher-constants"; it is also re-exported from the root.

import type { AutoSwitcherThresholds } from "./auto-switcher";

export const AUTO_SWITCHER_SENSITIVITY_PRESETS = ["relaxed", "balanced", "fast"] as const;
export type AutoSwitcherSensitivityPreset = (typeof AUTO_SWITCHER_SENSITIVITY_PRESETS)[number];

function bundle(
  bitrateMin: number,
  rttMax: number,
  lossMax: number,
  trigger: number,
  recover: number,
  startup: number,
  offlineTimeout: number,
): AutoSwitcherThresholds {
  return {
    bitrate_min_kbps: bitrateMin,
    rtt_max_ms: rttMax,
    loss_max_pct: lossMax,
    bitrate_trigger_polls: trigger,
    rtt_trigger_polls: trigger,
    loss_trigger_polls: trigger,
    bitrate_recover_polls: recover,
    rtt_recover_polls: recover,
    loss_recover_polls: recover,
    bitrate_startup_polls: startup,
    rtt_startup_polls: startup,
    loss_startup_polls: startup,
    offline_timeout_seconds: offlineTimeout,
  };
}

// Tuned for IRL over SRT/SRTLA on the move, against the ingest's 4000 ms
// ingress receiver buffer (INGEST_SRT_INGRESS_LATENCY_MS):
//
// - rtt_max_ms: SRT recovers loss while latency >= ~4x RTT and gives up below
//   ~3x, so with a 4 s buffer ARQ is comfortable to ~1000 ms and failing past
//   ~1300 ms. Cellular on the move idles at 50-300 ms and spikes past 1000 ms
//   on handover/bufferbloat, which the buffer absorbs — the old 250-400 ms
//   thresholds fired on ordinary handovers. NOALBS ships 1500 ms for the same
//   job. If a node's ingress latency changes, these move with it.
// - loss_max_pct: read as drop_pct (see above). Any sustained drop is visible
//   damage, so the numbers are small; ~380 pkt/s at 4 Mbps makes 0.5% ≈ 2
//   packets in a 1 s window.
// - bitrate_min_kbps: adaptive encoders (BELABOX/Moblin/IRLPro) ride down to
//   500-1000 kbps in bad spots and stay watchable, so the floor is a
//   last-resort signal rather than the primary one. NOALBS defaults to 450.
// - offline_timeout_seconds: OBS still has ~4 s of buffered good video when
//   stats stop, so cutting to the offline scene sooner than that cuts away
//   from a picture that is still fine.
// - trigger_polls: the buffer means a bad sample now becomes visible
//   corruption ~4 s later, so there is slack here; no need to be twitchy.
// - recover_polls: NOALBS switches back the instant the link is good. We can't
//   quite — the ingest buffer drains during the outage and needs roughly its
//   own depth (~4 s) of over-delivery to refill, so recovering sooner than that
//   cuts back to a stuttering picture. That makes ~5 s the physical floor.
//   Beyond it the only thing a longer streak buys is flap protection, and it is
//   expensive: the good streak resets to zero on a single bad sample across all
//   three metrics, so a 20-30 s requirement can leave a usable stream parked on
//   the backup scene indefinitely.
export const AUTO_SWITCHER_PRESET_THRESHOLDS: Record<AutoSwitcherSensitivityPreset, AutoSwitcherThresholds> = {
  relaxed: bundle(300, 2000, 2, 6, 15, 8, 10),
  balanced: bundle(500, 1500, 1, 4, 8, 6, 7),
  fast: bundle(800, 1000, 0.5, 2, 5, 4, 5),
};

export const PRESET_COPY: Record<AutoSwitcherSensitivityPreset, { title: string; blurb: string }> = {
  relaxed: { title: "Relaxed", blurb: "Waits ~6s of bad signal before switching, ~15s stable before switching back. Rides out tunnels and dead spots." },
  balanced: { title: "Balanced", blurb: "Switches after ~4s bad, back after ~8s stable. The right pick for most IRL setups." },
  fast: { title: "Fast", blurb: "Switches after ~2s bad, back after ~5s stable. For when a single frozen frame is one too many." },
};

/**
 * The chat notice templates a fresh config starts with, matching the column
 * defaults in SQL. Exported because the public cloud OBS page shows them as
 * the shipped defaults, and a marketing page quoting a different string than
 * the product hands out is the kind of drift nobody notices for a year.
 */
export const AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS = {
  degraded: "Connection unstable — switching to backup scene ({bitrate} kbps, {rtt} ms RTT)",
  offline: "Stream signal lost — hang tight!",
  recovered: "Signal restored — back live!",
} as const;
