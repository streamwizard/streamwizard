"use server";
import { createAdminClient } from "@repo/supabase/next/admin";
import { createAccountDeletionFeedback } from "@repo/supabase/queries/account-deletion";
import type { Database } from "@repo/supabase/types/supabase";

type DeletionReason = Database["public"]["Enums"]["deletion_reason"];

export async function submitAccountDeletionFeedback(reason: DeletionReason, additionalComments?: string) {
  const supabase = createAdminClient();
  try {
    await createAccountDeletionFeedback(supabase, reason, additionalComments);
    return { success: true };
  } catch (error) {
    console.error("Failed to save deletion feedback:", error);
    return { success: false };
  }
}
