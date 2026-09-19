import { getAdminSession } from "@/lib/admin-session";

/** Server actions are their own POST endpoints — the layout's guard doesn't
 * cover them, so every mutation re-checks admin here first. Same rules as the
 * layout gate (admin role + strong session); throws instead of redirecting.
 * Returns the acting user's id for audit columns. */
export async function assertAdmin(): Promise<string> {
  const result = await getAdminSession();
  if (result.session) return result.session.userId;

  switch (result.redirect) {
    case "/login?error=signin_required":
      throw new Error("Not signed in");
    case "/no-access":
      throw new Error("Not authorized");
    default:
      throw new Error("Verification required");
  }
}
