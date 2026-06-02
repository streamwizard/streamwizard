"use server";

import { createAdminClient } from "@repo/supabase/next/admin";
import { createClient } from "@repo/supabase/next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export type DeleteAccountResult = { error: string | null };

/**
 * Permanently deletes the signed-in user's application data and auth record.
 * Third-party processors (PostHog, Sentry) require separate admin erasure — see docs/compliance-workflows.md.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  let userId: string;

  try {
    ({ user: { id: userId } } = await getAuthContext());
  } catch {
    return { error: "You must be signed in to delete your account." };
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("delete_user_data");

  if (rpcError) {
    return { error: rpcError.message };
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(userId);

  if (authError) {
    return { error: authError.message };
  }

  revalidatePath("/", "layout");
  redirect("/?account_deleted=1");
}
