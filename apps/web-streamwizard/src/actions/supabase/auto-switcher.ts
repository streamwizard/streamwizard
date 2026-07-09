"use server";

import { createClient } from "@repo/supabase/next/server";
import type { Database } from "@repo/supabase";
import { env } from "@/lib/env";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@/schemas/auto-switcher";

export type AutoSwitcherConfigRow = Database["public"]["Tables"]["obs_auto_switcher_configs"]["Row"];

// Every write ends with a push through ws-server /internal/broadcast so the
// engine reacts within ~1s. The DB row stays the source of truth: if the push
// fails (or CONSUMER_SECRET isn't configured) the engine's periodic re-fetch
// picks the change up within a minute — so push failures never fail the save.
async function pushConfigToEngine(row: AutoSwitcherConfigRow): Promise<void> {
  if (!env.CONSUMER_SECRET) return;
  const httpUrl = env.WS_SERVER_URL.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
  try {
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
    console.error("[auto-switcher] config push failed (engine will catch up on re-fetch):", error);
  }
}

export async function getAutoSwitcherConfig(): Promise<AutoSwitcherConfigRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("obs_auto_switcher_configs").select("*").maybeSingle();
  return data;
}

export async function upsertAutoSwitcherConfig(values: AutoSwitcherFormValues): Promise<{ ok: boolean; error?: string }> {
  const parsed = autoSwitcherFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase
    .from("obs_auto_switcher_configs")
    .upsert({ user_id: user.id, ...parsed.data })
    .select()
    .single();
  if (error) {
    console.error("[auto-switcher] upsert failed:", error);
    return { ok: false, error: "Could not save settings" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}

export async function setSceneOverride(
  sceneUuid: string,
  sceneName: string | null,
  durationMinutes: number | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!sceneUuid || sceneUuid.length > 200) return { ok: false, error: "Invalid scene" };
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 24 * 60)) {
    return { ok: false, error: "Invalid duration" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obs_auto_switcher_configs")
    .update({
      override_scene_uuid: sceneUuid,
      override_scene_name: sceneName,
      override_expires_at: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null,
    })
    .select()
    .single();
  if (error || !data) {
    console.error("[auto-switcher] override set failed:", error);
    return { ok: false, error: "Could not set the override — save your switcher settings first" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}

export async function clearSceneOverride(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obs_auto_switcher_configs")
    .update({ override_scene_uuid: null, override_scene_name: null, override_expires_at: null })
    .select()
    .single();
  if (error || !data) {
    console.error("[auto-switcher] override clear failed:", error);
    return { ok: false, error: "Could not clear the override" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}
