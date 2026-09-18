import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { isUserAdmin } from "@repo/supabase/queries/obs-nodes";

/** Server actions are their own POST endpoints — the layout's guard doesn't
 * cover them, so every alerts mutation re-checks admin here first.
 * Returns the acting user's id for audit columns. */
export async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");

  if (!(await isUserAdmin(supabaseAdmin, data.user.id))) throw new Error("Not authorized");

  return data.user.id;
}
