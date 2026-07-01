"use server";

import { randomBytes } from "crypto";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getDiscordUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { sendDiscordDirectMessage } from "@repo/discord-api";
import { revalidatePath } from "next/cache";
import type { Database } from "@repo/supabase";

export type IngestStreamKey = Database["public"]["Tables"]["ingest_stream_keys"]["Row"];

const INGEST_SETTINGS_PATH = "/dashboard/irl/obs";

function generateStreamKey(): string {
  return randomBytes(32).toString("hex");
}

function ingestUrls(host: string, key: string) {
  return [
    `SRT: srt://${host}:8888?streamid=${key}`,
    `SRTLA: host ${host}, port 5000, streamid ${key}`,
  ];
}

function ingestKeyDmContent(label: string, streamKey: string) {
  const host = process.env.NEXT_PUBLIC_INGEST_HOST ?? "your-stream-server";
  return [`Ingest key: **${label}**`, ...ingestUrls(host, streamKey)].join("\n");
}

/**
 * Best-effort: DMs the key straight to the user's Discord if they've linked
 * one, so they don't have to type it out on a phone/encoder keyboard. Never
 * throws — a failed DM (e.g. the user has server DMs off) shouldn't block
 * key creation.
 */
async function notifyDiscord(userId: string, label: string, streamKey: string) {
  try {
    const adminClient = createAdminClient();
    const discordUserId = await getDiscordUserIdByUserIdMaybe(adminClient, userId);
    if (!discordUserId) return;

    await sendDiscordDirectMessage(discordUserId, { content: ingestKeyDmContent(label, streamKey) });
  } catch (err) {
    console.error("[ingest-keys] Couldn't DM ingest key to Discord", err);
  }
}

/** User-triggered resend, from the "Your keys" list — unlike notifyDiscord, this reports back so a missing link or failed send shows up as a real error instead of silently doing nothing. */
export async function sendIngestKeyDiscordDM(id: string): Promise<{ error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data: key, error: keyError } = await adminClient
    .from("ingest_stream_keys")
    .select("label, stream_key")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (keyError || !key) return { error: keyError?.message ?? "Key not found" };

  const discordUserId = await getDiscordUserIdByUserIdMaybe(adminClient, user.id);
  if (!discordUserId) {
    return { error: "Connect Discord in Settings → Integrations first" };
  }

  try {
    await sendDiscordDirectMessage(discordUserId, { content: ingestKeyDmContent(key.label, key.stream_key) });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't send that DM" };
  }

  return { error: null };
}

export async function createIngestKey(label: string): Promise<{ data: IngestStreamKey | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("ingest_stream_keys")
    .insert({ user_id: user.id, stream_key: generateStreamKey(), label: label.trim() || "My Ingest Key" })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };

  // Every incoming key needs an OBS output key to be pullable. The user never
  // manages this directly, so it's created here rather than surfaced as a step.
  await adminClient.from("ingest_output_keys").insert({
    user_id: user.id,
    key_id: data.id,
    output_key: generateStreamKey(),
    label: "OBS output",
  });

  await notifyDiscord(user.id, data.label, data.stream_key);

  revalidatePath(INGEST_SETTINGS_PATH);
  return { data, error: null };
}

export async function listIngestKeys(): Promise<{ data: IngestStreamKey[] | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("ingest_stream_keys")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return { data, error: error?.message ?? null };
}

export async function rotateIngestKey(id: string): Promise<{ data: IngestStreamKey | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("ingest_stream_keys")
    .update({ stream_key: generateStreamKey() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath(INGEST_SETTINGS_PATH);
  return { data, error: null };
}

export async function deleteIngestKey(id: string): Promise<{ error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("ingest_stream_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath(INGEST_SETTINGS_PATH);
  return { error: error?.message ?? null };
}
