"use server";

import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  selectAutoSwitcherConfig,
  updateSceneOverride,
  upsertAutoSwitcherConfig,
  type AutoSwitcherConfigRow,
} from "@repo/supabase/queries/irl/auto-switcher";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@repo/schemas/auto-switcher/form";
import { guidSchema } from "@repo/schemas/ids";
import { reportError } from "@repo/sentry";
import { broadcastToUser } from "@repo/ws-client";
import { assertAdmin } from "@/lib/auth/assert-admin";
import { FORBIDDEN, tryAdminContext } from "@/lib/auth/admin-context";
import { env } from "@/lib/env";

type SwitcherResult = { ok: boolean; error?: string };

const overrideSchema = z.object({
  userId: guidSchema,
  sceneUuid: z.string().min(1).max(200),
  sceneName: z.string().max(200).nullable(),
  durationMinutes: z.number().min(1).max(24 * 60).nullable(),
});

// Every write ends with a push through ws-server /internal/broadcast so the
// engine reacts within ~1s. The DB row stays the source of truth: if the push
// fails (or ws-server pushes aren't configured here) the engine's
// periodic re-fetch picks the change up within a minute — so push failures
// never fail the save.
async function pushConfigToEngine(row: AutoSwitcherConfigRow): Promise<void> {
  const result = await broadcastToUser(row.user_id, "streamwizard.auto_switcher_config", row, { wsServerUrl: env.WS_SERVER_URL });
  if (!result.ok && (result.reason === "network" || result.reason === "signing")) {
    reportError(result.error, "auto-switcher.config-push");
  }
}

/** The user's switcher settings, or null when they have none (or the read fails). */
export async function getAutoSwitcherConfigForUser(userId: string): Promise<AutoSwitcherConfigRow | null> {
  await assertAdmin();
  const id = guidSchema.safeParse(userId);
  if (!id.success) return null;

  try {
    const { data, error } = await selectAutoSwitcherConfig(supabaseAdmin, id.data);
    if (error) reportError(error, "auto-switcher.get", { userId: id.data });
    return data;
  } catch (error) {
    reportError(error, "auto-switcher.get", { userId: id.data });
    return null;
  }
}

export async function upsertAutoSwitcherConfigForUser(
  userId: string,
  values: AutoSwitcherFormValues,
): Promise<{ ok: boolean; data?: AutoSwitcherConfigRow; error?: string }> {
  if (!(await tryAdminContext())) return { ok: false, error: FORBIDDEN };
  const id = guidSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "That user doesn't exist." };
  const parsed = autoSwitcherFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };

  try {
    const { data, error } = await upsertAutoSwitcherConfig(supabaseAdmin, id.data, parsed.data);
    if (error) {
      reportError(error, "auto-switcher.upsert", { userId: id.data });
      return { ok: false, error: "Could not save settings" };
    }
    await pushConfigToEngine(data);
    return { ok: true, data };
  } catch (err) {
    reportError(err, "auto-switcher.upsert", { userId: id.data });
    return { ok: false, error: "Could not save settings" };
  }
}

/** Writes the override columns and pushes the row; `messages` covers a failed
 * write and a user with no settings row. */
async function writeOverride(
  userId: string,
  fields: Parameters<typeof updateSceneOverride>[2],
  tag: string,
  messages: { failed: string; missing: string },
): Promise<SwitcherResult> {
  try {
    const { data, error } = await updateSceneOverride(supabaseAdmin, userId, fields);
    if (error || !data) {
      reportError(error, tag, { userId });
      return { ok: false, error: error ? messages.failed : messages.missing };
    }
    await pushConfigToEngine(data);
    return { ok: true };
  } catch (err) {
    reportError(err, tag, { userId });
    return { ok: false, error: messages.failed };
  }
}

export async function setSceneOverrideForUser(
  userId: string,
  sceneUuid: string,
  sceneName: string | null,
  durationMinutes: number | null,
): Promise<SwitcherResult> {
  if (!(await tryAdminContext())) return { ok: false, error: FORBIDDEN };
  const parsed = overrideSchema.safeParse({ userId, sceneUuid, sceneName, durationMinutes });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, error: field === "durationMinutes" ? "Invalid duration" : "Invalid scene" };
  }

  const { durationMinutes: minutes } = parsed.data;
  return writeOverride(
    parsed.data.userId,
    {
      override_scene_uuid: parsed.data.sceneUuid,
      override_scene_name: parsed.data.sceneName,
      override_expires_at: minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null,
    },
    "auto-switcher.override-set",
    { failed: "Could not set the override. Try again?", missing: "The user has no switcher settings yet" },
  );
}

export async function clearSceneOverrideForUser(userId: string): Promise<SwitcherResult> {
  if (!(await tryAdminContext())) return { ok: false, error: FORBIDDEN };
  const id = guidSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Could not clear the override" };

  return writeOverride(
    id.data,
    { override_scene_uuid: null, override_scene_name: null, override_expires_at: null },
    "auto-switcher.override-clear",
    { failed: "Could not clear the override. Try again?", missing: "Could not clear the override" },
  );
}
