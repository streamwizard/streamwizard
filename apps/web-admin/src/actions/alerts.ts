"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { assertAdmin } from "@/lib/assert-admin";
import { silenceAlertState } from "@repo/supabase/queries/alerts";

/** hours = null clears the silence. The engine skips notifications while
 * silenced_until is in the future but keeps recording state/events. */
export async function silenceAlert(stateId: string, hours: number | null): Promise<void> {
  await assertAdmin();

  const silenced_until = hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
  await silenceAlertState(supabaseAdmin, stateId, silenced_until);

  revalidatePath("/alerts");
}
