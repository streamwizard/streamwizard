"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAdminSession } from "@/lib/admin-session";

const SECURITY_PATH = "/security";

type Result = { error: string | null };

/** Removals go through the server so the "keep at least one method" rule
 * can't be skipped from devtools. Adds and renames stay client-side: they
 * only ever make the account safer or change a label. */
async function requireStrongAdmin() {
  const result = await getAdminSession();
  if (!result.session) throw new Error("Forbidden");
  return result.session;
}

export async function removeTotpFactorAction(factorId: string): Promise<Result> {
  let session;
  try {
    session = await requireStrongAdmin();
  } catch {
    return { error: "Forbidden" };
  }

  if (!session.totpFactors.some((f) => f.id === factorId)) return { error: "That authenticator isn't on your account." };
  if (session.passkeys.length === 0) {
    return { error: "Add a passkey first. Your account must keep at least one second factor." };
  }

  const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: factorId, userId: session.userId });
  if (error) return { error: error.message };

  revalidatePath(SECURITY_PATH);
  return { error: null };
}

export async function removePasskeyAction(passkeyId: string): Promise<Result> {
  let session;
  try {
    session = await requireStrongAdmin();
  } catch {
    return { error: "Forbidden" };
  }

  if (!session.passkeys.some((p) => p.id === passkeyId)) return { error: "That passkey isn't on your account." };
  const otherMethods = session.totpFactors.length + (session.passkeys.length - 1);
  if (otherMethods === 0) {
    return { error: "Set up an authenticator app first. Your account must keep at least one second factor." };
  }

  const { error } = await supabaseAdmin.auth.admin.passkey.deletePasskey({ userId: session.userId, passkeyId });
  if (error) return { error: error.message };

  revalidatePath(SECURITY_PATH);
  return { error: null };
}
