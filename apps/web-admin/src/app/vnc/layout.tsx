import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { isUserAdmin } from "@repo/supabase/queries/obs-nodes";

// /vnc lives outside the (monitor) group so the popup gets a bare full-viewport
// page without the sidebar chrome — which also means it misses that layout's
// admin gate, so the same check runs here.
export default async function VncLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?error=signin_required");

  if (!(await isUserAdmin(supabaseAdmin, data.user.id))) redirect("/no-access");

  return children;
}
