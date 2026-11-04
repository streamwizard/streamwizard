import { createAdminClient } from "@repo/supabase/next/admin";
import { ActionError } from "@/lib/actions/action-error";
import { assertAdmin } from "@/lib/auth/assert-admin";

// The admin gate for server actions, built on assertAdmin(). Pick the form
// that matches how the action reports failure:
//   - requireAdmin / requireAdminContext throw an ActionError, for actions
//     that catch and return `toActionError(...)` (the section wrappers
//     requireCmsAdmin and requireDiscordAdmin build on requireAdmin);
//   - tryAdminContext returns null, for actions that answer `{ error: FORBIDDEN }`.

export interface AdminContext {
  /** The acting admin, for audit columns. */
  userId: string;
  /** A fresh service-role client. Only reached after the admin check. */
  adminClient: ReturnType<typeof createAdminClient>;
}

export const FORBIDDEN = "Forbidden";

/** assertAdmin(), with its refusal ("Not signed in", "Not authorized",
 * "Verification required") as an ActionError. Returns the admin's user id. */
export async function requireAdmin(): Promise<string> {
  try {
    return await assertAdmin();
  } catch (error) {
    throw new ActionError(error instanceof Error ? error.message : "Not authorized");
  }
}

/** requireAdmin() plus a service-role client. */
export async function requireAdminContext(): Promise<AdminContext> {
  const userId = await requireAdmin();
  return { userId, adminClient: createAdminClient() };
}

/** requireAdminContext(), or null when the caller isn't a strong-session admin. */
export async function tryAdminContext(): Promise<AdminContext | null> {
  try {
    return await requireAdminContext();
  } catch {
    return null;
  }
}
