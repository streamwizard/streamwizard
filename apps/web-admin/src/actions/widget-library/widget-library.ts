"use server";

import { guidSchema } from "@repo/schemas/ids";
import { reportError } from "@repo/sentry";
import { revalidatePath } from "next/cache";
import {
  selectPendingLibraryEntries,
  approveLibraryEntry as approveEntry,
  deleteLibraryEntry,
} from "@repo/supabase/queries/overlays/widgets";
import { toActionError, toDataError, type ActionResult } from "@/lib/actions/action-error";
import { FORBIDDEN, tryAdminContext, type AdminContext } from "@/lib/auth/admin-context";

const WIDGET_LIBRARY_PATH = "/widget-library";
const GONE = "That widget is gone. Reload the page.";

export async function getPendingLibraryEntries() {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const failed = "Couldn't load the pending widgets. Try again?";
  try {
    const { data, error } = await selectPendingLibraryEntries(ctx.adminClient);
    if (error) reportError(error, "widget-library.list");
    return { data, error: error ? failed : null };
  } catch (error) {
    return toDataError(error, "widget-library.list", failed);
  }
}

/** Approve and reject share everything but the query and the copy. */
async function reviewEntry(
  entryId: string,
  write: (client: AdminContext["adminClient"], id: string) => PromiseLike<{ error: unknown }>,
  tag: string,
  failed: string,
): Promise<ActionResult> {
  const ctx = await tryAdminContext();
  if (!ctx) return { error: FORBIDDEN };
  const id = guidSchema.safeParse(entryId);
  if (!id.success) return { error: GONE };

  try {
    const { error } = await write(ctx.adminClient, id.data);
    revalidatePath(WIDGET_LIBRARY_PATH);
    if (error) reportError(error, tag, { entryId: id.data });
    return { error: error ? failed : null };
  } catch (error) {
    return toActionError(error, tag, failed, { entryId: id.data });
  }
}

export async function approveLibraryEntry(entryId: string): Promise<ActionResult> {
  return reviewEntry(entryId, approveEntry, "widget-library.approve", "Couldn't approve that widget. Try again?");
}

export async function rejectLibraryEntry(entryId: string): Promise<ActionResult> {
  return reviewEntry(entryId, deleteLibraryEntry, "widget-library.reject", "Couldn't reject that widget. Try again?");
}
