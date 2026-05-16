"use server";

import { randomBytes } from "crypto";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import type { Database } from "@repo/supabase";

export type IrlCollectorToken = Database["public"]["Tables"]["irl_collector_tokens"]["Row"];

export async function createIrlToken(name: string): Promise<{ data: { token_url: string } | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const token = randomBytes(32).toString("hex");
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("irl_collector_tokens")
    .insert({ user_id: user.id, token, name });

  if (error) return { data: null, error: error.message };

  const baseUrl = process.env.NEXT_PUBLIC_OVERLAY_URL ?? "";
  const token_url = `${baseUrl}/irl/collector?token=${encodeURIComponent(token)}`;

  revalidatePath("/dashboard/irl");
  return { data: { token_url }, error: null };
}

export async function listIrlTokens(): Promise<{ data: IrlCollectorToken[] | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("irl_collector_tokens")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return { data, error: error?.message ?? null };
}

export async function getIrlSubscriberToken(): Promise<{ data: string | null; error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("overlay_scenes")
    .select("subscriber_token")
    .eq("user_id", user.id)
    .not("subscriber_token", "is", null)
    .limit(1)
    .maybeSingle() as unknown as { data: { subscriber_token: string } | null; error: { message: string } | null };

  if (error) return { data: null, error: error.message };
  return { data: data?.subscriber_token ?? null, error: null };
}

export async function deleteIrlToken(id: string): Promise<{ error: string | null }> {
  let user;
  try {
    ({ user } = await getAuthContext());
  } catch {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("irl_collector_tokens")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/irl");
  return { error: error?.message ?? null };
}
