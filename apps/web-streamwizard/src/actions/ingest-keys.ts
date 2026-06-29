"use server";

import { randomBytes } from "crypto";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import type { Database } from "@repo/supabase";

export type IngestStreamKey = Database["public"]["Tables"]["ingest_stream_keys"]["Row"];

const INGEST_SETTINGS_PATH = "/dashboard/irl/ingest";

function generateStreamKey(): string {
  return randomBytes(32).toString("hex");
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
