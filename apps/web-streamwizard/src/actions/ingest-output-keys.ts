"use server";

import { randomBytes } from "crypto";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import type { Database } from "@repo/supabase";

export type IngestOutputKey = Database["public"]["Tables"]["ingest_output_keys"]["Row"];

const INGEST_SETTINGS_PATH = "/dashboard/irl/obs";

// The credential an OBS Media Source presents (as its SRT streamid) to pull a
// stream from the ingest output listener. Paired to an incoming key (key_id);
// one incoming stream can have several output keys (one per OBS pull).
function generateOutputKey(): string {
  return randomBytes(32).toString("hex");
}

/** Ownership guard: the incoming key must belong to the caller. */
async function assertOwnsKey(
  adminClient: ReturnType<typeof createAdminClient>,
  keyId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("ingest_stream_keys")
    .select("id")
    .eq("id", keyId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function createOutputKey(
  keyId: string,
  label: string,
): Promise<{ data: IngestOutputKey | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  if (!(await assertOwnsKey(adminClient, keyId, user.id))) {
    return { data: null, error: "Stream key not found" };
  }

  const { data, error } = await adminClient
    .from("ingest_output_keys")
    .insert({
      user_id: user.id,
      key_id: keyId,
      output_key: generateOutputKey(),
      label: label.trim() || "My OBS Output Key",
    })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath(INGEST_SETTINGS_PATH);
  return { data, error: null };
}

export async function listOutputKeys(
  keyId?: string,
): Promise<{ data: IngestOutputKey[] | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  let query = adminClient
    .from("ingest_output_keys")
    .select("*")
    .eq("user_id", user.id);
  if (keyId) query = query.eq("key_id", keyId);

  const { data, error } = await query.order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function rotateOutputKey(
  id: string,
): Promise<{ data: IngestOutputKey | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("ingest_output_keys")
    .update({ output_key: generateOutputKey() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath(INGEST_SETTINGS_PATH);
  return { data, error: null };
}

export async function deleteOutputKey(id: string): Promise<{ error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("ingest_output_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath(INGEST_SETTINGS_PATH);
  return { error: error?.message ?? null };
}
