import { z } from "zod";

// ─── Thresholds ──────────────────────────────────────────────────────────────
// One "poll" = one ingest stats sample = 1 second (the SRT sampler reports at
// 1 Hz). Fallback fires when ANY metric has been bad for its trigger_polls;
// recovery requires ALL metrics good for their recover_polls.
//
// The loss_* fields threshold UNRECOVERED loss (SRT drop_pct — packets the
// buffer gave up on, i.e. visible glitches), not raw pre-retransmit loss:
// cellular routinely shows 2-5% raw loss that the 4s ingest buffer recovers
// completely. Field names stay "loss" because that's what streamers call it
// and because renaming would invalidate stored advanced_thresholds rows.
//
// RTT maxima are sized against the ingest receiver buffer
// (INGEST_SRT_INGRESS_LATENCY_MS, 4000ms): SRT keeps recovering until RTT
// approaches roughly buffer/4 ≈ 1000ms, so triggers sit at 600-1200ms as a
// pre-emptive band rather than the old 250-400ms, which flipped scenes on
// cell bufferbloat the buffer would have absorbed invisibly.

export const autoSwitcherThresholdsSchema = z.object({
  bitrate_min_kbps: z.number().int().min(0),
  rtt_max_ms: z.number().int().min(0),
  loss_max_pct: z.number().min(0).max(100),

  bitrate_trigger_polls: z.number().int().min(1).max(120),
  rtt_trigger_polls: z.number().int().min(1).max(120),
  loss_trigger_polls: z.number().int().min(1).max(120),

  bitrate_recover_polls: z.number().int().min(1).max(300),
  rtt_recover_polls: z.number().int().min(1).max(300),
  loss_recover_polls: z.number().int().min(1).max(300),

  bitrate_startup_polls: z.number().int().min(1).max(120),
  rtt_startup_polls: z.number().int().min(1).max(120),
  loss_startup_polls: z.number().int().min(1).max(120),

  offline_timeout_seconds: z.number().int().min(2).max(60),
});

export type AutoSwitcherThresholds = z.infer<typeof autoSwitcherThresholdsSchema>;

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

export const AUTO_SWITCHER_PRESET_THRESHOLDS: Record<AutoSwitcherSensitivityPreset, AutoSwitcherThresholds> = {
  relaxed: bundle(800, 1200, 5, 6, 30, 8, 8),
  balanced: bundle(1000, 900, 2, 3, 20, 5, 5),
  fast: bundle(1200, 600, 1, 2, 10, 3, 3),
};

// ─── Config row ──────────────────────────────────────────────────────────────
// Mirrors public.obs_auto_switcher_configs. Used by the web server actions to
// validate writes and by the engine to parse config pushes off the ws feed.

export const autoSwitcherSceneModelSchema = z.enum(["two", "three"]);
export const autoSwitcherModeSchema = z.enum(["simple", "advanced"]);

export const autoSwitcherConfigSchema = z.object({
  user_id: z.string().uuid(),
  enabled: z.boolean(),
  mode: autoSwitcherModeSchema,
  scene_model: autoSwitcherSceneModelSchema,
  scene_live_uuid: z.string().nullable(),
  scene_live_name: z.string().nullable(),
  scene_degraded_uuid: z.string().nullable(),
  scene_degraded_name: z.string().nullable(),
  scene_offline_uuid: z.string().nullable(),
  scene_offline_name: z.string().nullable(),
  sensitivity_preset: z.enum(AUTO_SWITCHER_SENSITIVITY_PRESETS),
  advanced_thresholds: autoSwitcherThresholdsSchema.nullable(),
  pinned_stream_key_label: z.string().nullable(),
  log_events_enabled: z.boolean(),
  chat_notices_enabled: z.boolean(),
  chat_template_degraded: z.string().max(400),
  chat_template_offline: z.string().max(400),
  chat_template_recovered: z.string().max(400),
  warning_source_enabled: z.boolean(),
  warning_source_uuid: z.string().nullable(),
  warning_source_name: z.string().nullable(),
  auto_stop_enabled: z.boolean(),
  auto_stop_minutes: z.number().int().min(1).max(120),
  override_scene_uuid: z.string().nullable(),
  override_scene_name: z.string().nullable(),
  override_expires_at: z.string().nullable(),
});

export type AutoSwitcherConfig = z.infer<typeof autoSwitcherConfigSchema>;

/** Thresholds the engine actually runs with, after preset/advanced resolution. */
export function resolveAutoSwitcherThresholds(config: {
  mode: AutoSwitcherConfig["mode"];
  sensitivity_preset: AutoSwitcherSensitivityPreset;
  advanced_thresholds: unknown;
}): AutoSwitcherThresholds {
  if (config.mode === "advanced") {
    const parsed = autoSwitcherThresholdsSchema.safeParse(config.advanced_thresholds);
    if (parsed.success) return parsed.data;
  }
  return AUTO_SWITCHER_PRESET_THRESHOLDS[config.sensitivity_preset];
}

// ─── Live status payload (streamwizard.auto_switcher_status) ────────────────
// Pushed by the engine into the user's ws-server room on every state change
// plus a 5s heartbeat while armed; rendered by the Auto Switcher status card.

export const autoSwitcherStateSchema = z.enum(["idle", "startup", "live", "degraded", "offline", "override"]);
export type AutoSwitcherState = z.infer<typeof autoSwitcherStateSchema>;

export const autoSwitcherSwitchReasonSchema = z.enum([
  "auto_fallback",
  "auto_recover",
  "auto_offline",
  "auto_stop",
  "override",
  "manual",
]);
export type AutoSwitcherSwitchReason = z.infer<typeof autoSwitcherSwitchReasonSchema>;

export const autoSwitcherSwitchEntrySchema = z.object({
  at: z.number(), // epoch ms
  from_scene: z.string().nullable(), // scene names for humans; uuids drive OBS
  to_scene: z.string(),
  reason: autoSwitcherSwitchReasonSchema,
  detail: z.string(),
  session_id: z.string().nullable(),
  label: z.string().nullable(),
});
export type AutoSwitcherSwitchEntry = z.infer<typeof autoSwitcherSwitchEntrySchema>;

const metricStreakSchema = z.object({ bad: z.number(), good: z.number() });

// Last ingest sample the engine judged against the thresholds. Every field is
// nullable because RTMP only reports throughput — the SRT transport metrics
// genuinely never arrive — and the whole object is null before the first
// sample of a session.
//
// Deliberately NOT part of the publish dirty-check (see statusKey() in
// user-monitor.ts): kbps changes every second, so keying on it would publish at
// 1 Hz forever and defeat the mechanism. Consumers get fresh numbers on every
// status they receive — 1 Hz while a streak is building, every 5s otherwise.
const autoSwitcherLatestSampleSchema = z.object({
  kbps: z.number().nullable(),
  rtt_ms: z.number().nullable(),
  /** Unrecovered loss (SRT drop_pct) — the value actually judged against loss_max_pct. */
  loss_pct: z.number().nullable(),
  /** Epoch ms the engine processed the sample. */
  at: z.number(),
});

export type AutoSwitcherLatestSample = z.infer<typeof autoSwitcherLatestSampleSchema>;

export const autoSwitcherStatusSchema = z.object({
  state: autoSwitcherStateSchema,
  armed: z.boolean(),
  override: z
    .object({
      scene_uuid: z.string(),
      scene_name: z.string().nullable(),
      expires_at: z.string().nullable(),
    })
    .nullable(),
  selected_session: z
    .object({
      session_id: z.string(),
      label: z.string().nullable(),
    })
    .nullable(),
  streaks: z.object({
    bitrate: metricStreakSchema,
    rtt: metricStreakSchema,
    loss: metricStreakSchema,
  }),
  thresholds: autoSwitcherThresholdsSchema,
  /**
   * Whether the "unstable connection" source is currently visible in OBS. Stays
   * false when the warning source is disabled or unconfigured, so an overlay
   * mirroring this lights up in lockstep with what viewers actually see on
   * stream rather than with a condition they were never shown.
   */
  warning_shown: z.boolean(),
  latest: autoSwitcherLatestSampleSchema.nullable(),
  last_switch: autoSwitcherSwitchEntrySchema.nullable(),
  last_error: z.string().nullable(),
  offline_since: z.number().nullable(),
  auto_stop_deadline: z.number().nullable(),
});

export type AutoSwitcherStatus = z.infer<typeof autoSwitcherStatusSchema>;
