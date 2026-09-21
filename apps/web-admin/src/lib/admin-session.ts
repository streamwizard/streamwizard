import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { isUserAdmin } from "@repo/supabase/queries/obs-nodes";
import {
  isStrongSession,
  verifiedTotpFactors,
  type Factor,
  type JwtPayload,
  type PasskeyListItem,
  type User,
} from "@repo/supabase/auth/session-strength";

export type AdminSession = {
  userId: string;
  email: string;
  user: User;
  claims: JwtPayload;
  /** Verified TOTP factors (Supabase allows at most one). */
  totpFactors: Factor[];
  passkeys: PasskeyListItem[];
  /** `aal2` (TOTP verified this session) or signed in with a passkey. */
  strong: boolean;
};

export type AdminSessionRedirect = "/login?error=signin_required" | "/no-access" | "/auth/verify" | "/auth/setup";

export type AdminSessionResult =
  | { session: AdminSession; redirect: null }
  | { session: null; redirect: AdminSessionRedirect };

/**
 * The one place that decides whether a request may act as an admin.
 *
 * 1. Signed in, and `user_roles` says `admin` (service-role lookup).
 * 2. The session is strong: the admin completed a TOTP challenge after the
 *    Twitch redirect (`aal2`), or signed in with a passkey (`amr` carries
 *    `passkey`). Twitch alone is one factor and is not enough.
 *
 * When (2) fails the caller is told where to send the user: `/auth/verify`
 * if they already have a factor to prove, `/auth/setup` if they have none.
 * Layouts redirect; server actions throw (see assert-admin.ts).
 */
// "Auth session missing!" is a logged-out visit, not a failure; logging it as a
// warning sent every visit to the login page to Sentry Logs.
function isMissingSession(error: { name?: string }): boolean {
  return error.name === "AuthSessionMissingError";
}

export async function getAdminSession(): Promise<AdminSessionResult> {
  const inventory = await loadAdminInventory();
  if (inventory.redirect) return inventory;

  const { session } = inventory;
  if (!session.strong) {
    const hasAnyFactor = session.totpFactors.length > 0 || session.passkeys.length > 0;
    return { session: null, redirect: hasAnyFactor ? "/auth/verify" : "/auth/setup" };
  }
  return { session, redirect: null };
}

/** Layout-side gate: redirects instead of returning the failure branch. */
export async function requireAdminSession(): Promise<AdminSession> {
  const result = await getAdminSession();
  if (result.redirect) redirect(result.redirect);
  return result.session;
}

/**
 * For the pages that *serve* the weak-session states (/auth/verify,
 * /auth/setup): they need the admin's factor inventory even when the session
 * is not strong yet. Still refuses non-admins and signed-out users.
 */
export async function getAdminInventory(): Promise<
  { session: AdminSession; redirect: null } | { session: null; redirect: "/login?error=signin_required" | "/no-access" }
> {
  return loadAdminInventory();
}

async function loadAdminInventory(): Promise<
  { session: AdminSession; redirect: null } | { session: null; redirect: "/login?error=signin_required" | "/no-access" }
> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims) {
    // A missing session is normal for a first visit, but a real error (bad or
    // expired token, misconfigured client) deserves a paper trail.
    if (claimsError && !isMissingSession(claimsError)) {
      console.warn("[web-admin] getClaims failed at admin gate:", claimsError.message);
    }
    return { session: null, redirect: "/login?error=signin_required" };
  }

  // getUser() is what carries `factors`; getClaims() is what carries aal/amr.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    if (userError && !isMissingSession(userError)) {
      console.warn("[web-admin] getUser failed at admin gate:", userError.message);
    }
    return { session: null, redirect: "/login?error=signin_required" };
  }
  const user = userData.user;

  if (!(await isUserAdmin(supabaseAdmin, user.id))) {
    return { session: null, redirect: "/no-access" };
  }

  return {
    session: {
      userId: user.id,
      email: user.email ?? "",
      user,
      claims,
      totpFactors: verifiedTotpFactors(user),
      passkeys: await listPasskeys(user.id),
      strong: isStrongSession(claims),
    },
    redirect: null,
  };
}

async function listPasskeys(userId: string): Promise<PasskeyListItem[]> {
  const { data, error } = await supabaseAdmin.auth.admin.passkey.listPasskeys({ userId });
  if (error) {
    // Passkeys disabled on the project (local config not flipped yet, or the
    // hosted toggle off) must not lock every admin out: treat as "none".
    console.warn("[web-admin] listPasskeys failed:", error.message);
    return [];
  }
  return data ?? [];
}
