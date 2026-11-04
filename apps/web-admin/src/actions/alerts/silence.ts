"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guidSchema } from "@repo/schemas/ids";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { silenceAlertState } from "@repo/supabase/queries/alerts/alerts";
import { toActionError, type ActionResult } from "@/lib/actions/action-error";
import { requireAdmin } from "@/lib/auth/admin-context";

// Up to a week; the menu offers 1, 8 and 24 hours.
const silenceSchema = z.object({ stateId: guidSchema, hours: z.number().int().min(1).max(168).nullable() });

/** hours = null clears the silence. The engine skips notifications while
 * silenced_until is in the future but keeps recording state/events. */
export async function silenceAlert(stateId: string, hours: number | null): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = silenceSchema.safeParse({ stateId, hours });
    if (!parsed.success) return { error: "That alert is gone. Reload the page." };

    const silenced_until = parsed.data.hours === null ? null : new Date(Date.now() + parsed.data.hours * 3_600_000).toISOString();
    await silenceAlertState(supabaseAdmin, parsed.data.stateId, silenced_until);

    revalidatePath("/alerts");
    return { error: null };
  } catch (error) {
    return toActionError(error, "alerts.silence", "Couldn't change the silence. Try again?");
  }
}
