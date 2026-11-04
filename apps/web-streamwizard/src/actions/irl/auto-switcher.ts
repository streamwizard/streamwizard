"use server";

import {
  selectAutoSwitcherConfig,
  updateSceneOverride,
  upsertAutoSwitcherConfig as upsertConfigRow,
  type AutoSwitcherConfigRow,
} from "@repo/supabase/queries/irl/auto-switcher";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@repo/schemas/auto-switcher/form";
import { reportError } from "@repo/sentry";
import { track } from "@/lib/tracking/track";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "@/lib/env";
import { tryAuthContext } from "@/lib/auth";
import { sceneOverrideSchema } from "@/schemas/auto-switcher";

// Every write ends with a push through ws-server /internal/broadcast so the
// engine reacts within ~1s. The DB row stays the source of truth: if the push
// fails (or ws-server pushes aren't configured here) the engine's periodic re-fetch
// picks the change up within a minute — so push failures never fail the save.
async function pushConfigToEngine(row: AutoSwitcherConfigRow): Promise<void> {
  const result = await broadcastToUser(row.user_id, "streamwizard.auto_switcher_config", row, { wsServerUrl: env.WS_SERVER_URL });
  if (!result.ok && (result.reason === "network" || result.reason === "signing")) {
    reportError(result.error, "auto-switcher: config push");
  }
}

export async function getAutoSwitcherConfig(): Promise<AutoSwitcherConfigRow | null> {
  const ctx = await tryAuthContext();
  if (!ctx) return null;
  const { data } = await selectAutoSwitcherConfig(ctx.supabase);
  return data;
}

export async function upsertAutoSwitcherConfig(
  values: AutoSwitcherFormValues,
): Promise<{ ok: boolean; data?: AutoSwitcherConfigRow; error?: string }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { ok: false, error: "Not signed in" };
  const { supabase, user } = ctx;

  const parsed = autoSwitcherFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const { data, error } = await upsertConfigRow(supabase, user.id, parsed.data);
  if (error) {
    reportError(error, "auto-switcher: upsert");
    return { ok: false, error: "Could not save settings" };
  }

  await pushConfigToEngine(data);
  await track("auto_switcher_config_saved", {}, user);
  // The saved row goes back to the caller so client state (the deck's switcher
  // tab) can refresh without a page load.
  return { ok: true, data };
}

export async function setSceneOverride(
  sceneUuid: string,
  sceneName: string | null,
  durationMinutes: number | null,
): Promise<{ ok: boolean; error?: string }> {
  // tryAuthContext's getUser refreshes an expired session (and distinguishes
  // "logged out" from "no config row") -- the deck stays open for hours on a
  // phone, so a stale cookie is a real path here, not an edge case.
  const ctx = await tryAuthContext();
  if (!ctx) return { ok: false, error: "Session expired. Refresh the page." };
  const { supabase, user } = ctx;

  const parsed = sceneOverrideSchema.safeParse({ sceneUuid, sceneName, durationMinutes });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid scene" };
  const override = parsed.data;

  const { data, error } = await updateSceneOverride(supabase, user.id, {
    override_scene_uuid: override.sceneUuid,
    override_scene_name: override.sceneName,
    override_expires_at: override.durationMinutes
      ? new Date(Date.now() + override.durationMinutes * 60_000).toISOString()
      : null,
  });
  if (error || !data) {
    reportError(error, "auto-switcher: override set");
    return { ok: false, error: error ? "Could not set the override. Try again?" : "Save your switcher settings first" };
  }

  await pushConfigToEngine(data);
  await track("scene_override_set", { timed: override.durationMinutes !== null }, user);
  return { ok: true };
}

export async function clearSceneOverride(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { ok: false, error: "Session expired. Refresh the page." };
  const { supabase, user } = ctx;

  const { data, error } = await updateSceneOverride(supabase, user.id, {
    override_scene_uuid: null,
    override_scene_name: null,
    override_expires_at: null,
  });
  if (error || !data) {
    reportError(error, "auto-switcher: override clear");
    return { ok: false, error: error ? "Could not clear the override. Try again?" : "Could not clear the override" };
  }

  await pushConfigToEngine(data);
  await track("scene_override_cleared", {}, user);
  return { ok: true };
}
