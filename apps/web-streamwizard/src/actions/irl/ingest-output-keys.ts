"use server";

import { guidSchema } from "@repo/schemas/ids";
import { toActionError } from "@/lib/action-error";

import { randomHexKey } from "@/lib/random-key";
import {
  deleteOutputKey as deleteOutputKeyRow,
  type IngestOutputKey,
  ingestKeyBelongsToUser,
  insertOutputKey,
  rotateOutputKeySecret,
  selectOutputKeys,
} from "@repo/supabase/queries/ingest/ingest";
import { tryAuthContext } from "@/lib/auth";
import { ingestKeyLabelSchema } from "@/schemas/ingest";
import { canCreateIngestKeys, INGEST_PLAN_REQUIRED } from "@/lib/obs/ingest-access";
import { track } from "@/lib/tracking/track";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";

const INGEST_SETTINGS_PATH = "/dashboard/irl/obs";

// An output key is the credential an OBS Media Source presents (as its SRT
// streamid) to pull a stream from the ingest output listener. Paired to an
// incoming key (key_id); one incoming stream can have several output keys
// (one per OBS pull).

export async function createOutputKey(
  keyId: string,
  label: string,
): Promise<{ data: IngestOutputKey | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;
  const parsedKeyId = guidSchema.safeParse(keyId);
  if (!parsedKeyId.success) return { data: null, error: "Stream key not found" };
  const parsedLabel = ingestKeyLabelSchema.safeParse(label);
  if (!parsedLabel.success) return { data: null, error: parsedLabel.error.issues[0]?.message ?? "Invalid name" };
  if (!(await canCreateIngestKeys(ctx.supabase))) return { data: null, error: INGEST_PLAN_REQUIRED };

  const adminClient = createAdminClient();
  // Ownership guard: the incoming key must belong to the caller.
  if (!(await ingestKeyBelongsToUser(adminClient, parsedKeyId.data, user.id))) {
    return { data: null, error: "Stream key not found" };
  }

  const { data, error } = await insertOutputKey(adminClient, {
    user_id: user.id,
    key_id: parsedKeyId.data,
    output_key: randomHexKey(),
    label: parsedLabel.data || "My OBS Output Key",
  });

  if (error) {
    return { data: null, error: toActionError(error, "actions/ingest-output-keys", "Couldn't create the output key. Try again?") };
  }

  revalidatePath(INGEST_SETTINGS_PATH);
  await track("ingest_key_created", { kind: "output" }, user);
  return { data, error: null };
}

export async function listOutputKeys(
  keyId?: string,
): Promise<{ data: IngestOutputKey[] | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;
  const parsedKeyId = guidSchema.optional().safeParse(keyId);
  if (!parsedKeyId.success) return { data: null, error: "Stream key not found" };

  const adminClient = createAdminClient();
  const { data, error } = await selectOutputKeys(adminClient, user.id, parsedKeyId.data);
  return { data, error: error ? toActionError(error, "actions/ingest-output-keys", "Couldn't load your output keys. Try again?") : null };
}

export async function rotateOutputKey(
  id: string,
): Promise<{ data: IngestOutputKey | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;
  const parsedId = guidSchema.safeParse(id);
  if (!parsedId.success) return { data: null, error: "Key not found" };
  if (!(await canCreateIngestKeys(ctx.supabase))) return { data: null, error: INGEST_PLAN_REQUIRED };

  const adminClient = createAdminClient();
  const { data, error } = await rotateOutputKeySecret(adminClient, parsedId.data, user.id, randomHexKey());

  if (error) {
    return { data: null, error: toActionError(error, "actions/ingest-output-keys", "Couldn't rotate the output key. Try again?") };
  }

  revalidatePath(INGEST_SETTINGS_PATH);
  await track("ingest_key_rotated", { kind: "output" }, user);
  return { data, error: null };
}

export async function deleteOutputKey(id: string): Promise<{ error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };
  const { user } = ctx;
  const parsedId = guidSchema.safeParse(id);
  if (!parsedId.success) return { error: "Key not found" };

  const adminClient = createAdminClient();
  const { error } = await deleteOutputKeyRow(adminClient, parsedId.data, user.id);

  revalidatePath(INGEST_SETTINGS_PATH);
  if (error) return { error: toActionError(error, "actions/ingest-output-keys", "Couldn't delete the output key. Try again?") };
  await track("ingest_key_deleted", { kind: "output" }, user);
  return { error: null };
}
