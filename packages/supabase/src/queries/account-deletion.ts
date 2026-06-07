import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;
type DeletionReason = Database["public"]["Enums"]["deletion_reason"];

export async function createAccountDeletionFeedback(
  client: DBClient,
  reason: DeletionReason,
  additionalComments?: string
) {
  const { error } = await client.from("account_deletion_feedback").insert({
    reason,
    additional_comments: additionalComments ?? null,
  });

  if (error) throw error;
}
