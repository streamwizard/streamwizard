import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { getProductAccess } from "@repo/supabase/queries/subscriptions";

/** Product the IRL ingest pages are gated on (see dashboard/irl/ingest/page.tsx). */
export const INGEST_PRODUCT = "cloud_obs";

export const INGEST_PLAN_REQUIRED = "IRL ingest needs an active plan.";

/**
 * Creating or rotating an ingest or output key costs ingest capacity, so it
 * needs the same plan as the page: active or trialing, period not over. The
 * page redirect alone didn't stop a direct server-action call.
 */
export async function canCreateIngestKeys(supabase: SupabaseClient<Database>): Promise<boolean> {
  const access = await getProductAccess(supabase, INGEST_PRODUCT);
  return access.canInteract;
}
