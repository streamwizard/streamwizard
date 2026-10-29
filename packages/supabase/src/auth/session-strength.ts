import type { Factor, JwtPayload, User } from "@supabase/supabase-js";

// Re-exported so apps that only depend on @repo/supabase can type their gates
// without adding a direct @supabase/supabase-js dependency.
export type { Factor, JwtPayload, User };

/**
 * A "strong" session is one that proves more than a single OAuth redirect:
 * the user completed a TOTP challenge after signing in, so the session is
 * `aal2`.
 *
 * Passkey sign-in used to count too, but passkeys are a Supabase beta and
 * GoTrue lets any signed-in session register one, so a stolen Twitch session
 * could add its own and pass this check (SW-483). TOTP is a real MFA factor:
 * once an admin has one verified, GoTrue refuses to enrol another factor
 * without aal2.
 *
 * web-admin requires a strong session before rendering anything or running a
 * server action; see apps/web-admin/src/lib/admin-session.ts. The SQL twin is
 * public.is_strong_admin().
 */
export function isStrongSession(claims: Pick<JwtPayload, "aal"> | null | undefined): boolean {
  return claims?.aal === "aal2";
}

export function verifiedTotpFactors(user: Pick<User, "factors"> | null | undefined): Factor[] {
  return (user?.factors ?? []).filter((f) => f.factor_type === "totp" && f.status === "verified");
}

export function hasVerifiedTotp(user: Pick<User, "factors"> | null | undefined): boolean {
  return verifiedTotpFactors(user).length > 0;
}
