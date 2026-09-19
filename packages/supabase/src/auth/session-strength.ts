import type { Factor, JwtPayload, PasskeyListItem, User } from "@supabase/supabase-js";

// Re-exported so apps that only depend on @repo/supabase can type their gates
// without adding a direct @supabase/supabase-js dependency.
export type { Factor, JwtPayload, PasskeyListItem, User };

/**
 * A "strong" session is one that proves more than a single OAuth redirect:
 *
 * - `aal2`: the user completed an MFA challenge (TOTP) after signing in, or
 * - the session was created by a passkey ceremony, which GoTrue records as an
 *   `amr` entry with method `passkey` while leaving `aal` at `aal1`.
 *
 * web-admin requires one of the two before rendering anything or running a
 * server action; see apps/web-admin/src/lib/admin-session.ts.
 */
export function isStrongSession(claims: Pick<JwtPayload, "aal" | "amr"> | null | undefined): boolean {
  if (!claims) return false;
  if (claims.aal === "aal2") return true;
  return sessionMethods(claims).includes("passkey");
}

/** AMR entries arrive as `{ method, timestamp }` objects, but older tokens (and
 * some client-side decoders) surface plain strings. Normalise to method names. */
export function sessionMethods(claims: Pick<JwtPayload, "amr"> | null | undefined): string[] {
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return [];
  return amr.map((entry) => (typeof entry === "string" ? entry : entry.method)).filter(Boolean);
}

export function verifiedTotpFactors(user: Pick<User, "factors"> | null | undefined): Factor[] {
  return (user?.factors ?? []).filter((f) => f.factor_type === "totp" && f.status === "verified");
}

export function hasVerifiedTotp(user: Pick<User, "factors"> | null | undefined): boolean {
  return verifiedTotpFactors(user).length > 0;
}
