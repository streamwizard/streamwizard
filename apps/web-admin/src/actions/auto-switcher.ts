"use server";

import { assertAdmin } from "@/lib/assert-admin";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import type { Database } from "@repo/supabase";
import { env } from "@/lib/env";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@/schemas/auto-switcher";
import { reportError } from "@repo/sentry";

export type AutoSwitcherConfigRow = Database["public"]["Tables"]["obs_auto_switcher_configs"]["Row"];

// Every write ends with a push through ws-server /internal/broadcast so the
// engine reacts within ~1s. The DB row stays the source of truth: if the push
// fails (or WS_SERVER_URL/CONSUMER_SECRET aren't configured here) the engine's
// periodic re-fetch picks the change up within a minute — so push failures
// never fail the save.
async function pushConfigToEngine(row: AutoSwitcherConfigRow): Promise<void> {
  if (!env.CONSUMER_SECRET || !env.WS_SERVER_URL) return;
  try {
    const httpUrl = env.WS_SERVER_URL.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
    await fetch(`${httpUrl}/internal/broadcast`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CONSUMER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: row.user_id, type: "streamwizard.auto_switcher_config", payload: row }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    reportError(error, "web-admin auto-switcher: config push");
  }
}

export async function getAutoSwitcherConfigForUser(userId: string): Promise<AutoSwitcherConfigRow | null> {
  await assertAdmin();
  const { data } = await supabaseAdmin
    .from("obs_auto_switcher_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function upsertAutoSwitcherConfigForUser(
  userId: string,
  values: AutoSwitcherFormValues,
): Promise<{ ok: boolean; data?: AutoSwitcherConfigRow; error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const parsed = autoSwitcherFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const { data, error } = await supabaseAdmin
    .from("obs_auto_switcher_configs")
    .upsert({ user_id: userId, ...parsed.data })
    .select()
    .single();
  if (error) {
    reportError(error, "web-admin auto-switcher: upsert");
    return { ok: false, error: "Could not save settings" };
  }

  await pushConfigToEngine(data);
  return { ok: true, data };
}

export async function setSceneOverrideForUser(
  userId: string,
  sceneUuid: string,
  sceneName: string | null,
  durationMinutes: number | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Forbidden" };
  }
  if (!sceneUuid || sceneUuid.length > 200) return { ok: false, error: "Invalid scene" };
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 24 * 60)) {
    return { ok: false, error: "Invalid duration" };
  }

  const { data, error } = await supabaseAdmin
    .from("obs_auto_switcher_configs")
    .update({
      override_scene_uuid: sceneUuid,
      override_scene_name: sceneName,
      override_expires_at: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null,
    })
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error || !data) {
    reportError(error, "web-admin auto-switcher: override set");
    return { ok: false, error: error ? `Could not set the override (${error.message})` : "The user has no switcher settings yet" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}

export async function clearSceneOverrideForUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { data, error } = await supabaseAdmin
    .from("obs_auto_switcher_configs")
    .update({ override_scene_uuid: null, override_scene_name: null, override_expires_at: null })
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error || !data) {
    reportError(error, "web-admin auto-switcher: override clear");
    return { ok: false, error: error ? `Could not clear the override (${error.message})` : "Could not clear the override" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}
