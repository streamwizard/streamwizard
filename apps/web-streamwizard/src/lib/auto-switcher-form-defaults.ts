import type { AutoSwitcherSensitivityPreset, AutoSwitcherThresholds } from "@repo/schemas";
import type { AutoSwitcherConfigRow } from "@/actions/supabase/auto-switcher";
import type { AutoSwitcherFormValues } from "@/schemas/auto-switcher";

// Shared by the dashboard form and the phone deck's switcher tab so the two
// surfaces can't drift on defaults or preset wording.

export const PRESET_COPY: Record<AutoSwitcherSensitivityPreset, { title: string; blurb: string }> = {
  relaxed: { title: "Relaxed", blurb: "Waits ~6s of bad signal before switching, ~30s stable before switching back. Fewest false alarms." },
  balanced: { title: "Balanced", blurb: "Switches after ~3s bad, back after ~20s stable. The right pick for most IRL setups." },
  fast: { title: "Fast", blurb: "Switches after ~2s bad, back after ~10s stable. For when a single frozen frame is one too many." },
};

/** Maps a nullable config row to form defaults, mirroring the column defaults in SQL. */
export function defaultsFrom(row: AutoSwitcherConfigRow | null): AutoSwitcherFormValues {
  return {
    enabled: row?.enabled ?? false,
    mode: (row?.mode as "simple" | "advanced") ?? "simple",
    scene_model: (row?.scene_model as "two" | "three") ?? "three",
    scene_live_uuid: row?.scene_live_uuid ?? null,
    scene_live_name: row?.scene_live_name ?? null,
    scene_degraded_uuid: row?.scene_degraded_uuid ?? null,
    scene_degraded_name: row?.scene_degraded_name ?? null,
    scene_offline_uuid: row?.scene_offline_uuid ?? null,
    scene_offline_name: row?.scene_offline_name ?? null,
    sensitivity_preset: (row?.sensitivity_preset as AutoSwitcherSensitivityPreset) ?? "balanced",
    advanced_thresholds: (row?.advanced_thresholds as AutoSwitcherThresholds | null) ?? null,
    pinned_stream_key_label: row?.pinned_stream_key_label ?? null,
    log_events_enabled: row?.log_events_enabled ?? true,
    chat_notices_enabled: row?.chat_notices_enabled ?? false,
    chat_template_degraded: row?.chat_template_degraded ?? "Connection unstable — switching to backup scene ({bitrate} kbps, {rtt} ms RTT)",
    chat_template_offline: row?.chat_template_offline ?? "Stream signal lost — hang tight!",
    chat_template_recovered: row?.chat_template_recovered ?? "Signal restored — back live!",
    warning_source_enabled: row?.warning_source_enabled ?? false,
    warning_source_uuid: row?.warning_source_uuid ?? null,
    warning_source_name: row?.warning_source_name ?? null,
    auto_stop_enabled: row?.auto_stop_enabled ?? false,
    auto_stop_minutes: row?.auto_stop_minutes ?? 10,
  };
}
