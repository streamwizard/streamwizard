import { cache } from "react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import type { Factor, PasskeyListItem } from "@repo/supabase/auth/session-strength";

// Server-only. The Supabase Auth side of a user for /users/[id]: sign-in
// history, ban state, second factors. Kept apart from the DB queries because
// it goes through the GoTrue admin API, not PostgREST.

/** What an admin wrote when banning, kept on the auth user's app_metadata. */
export interface BanNote {
  reason: string;
  by: string;
  at: string;
  discord: boolean;
}

export interface UserAuthState {
  lastSignInAt: string | null;
  /** Set while banned; GoTrue refuses sign-in and token refresh until then. */
  bannedUntil: string | null;
  ban: BanNote | null;
  providers: string[];
  /** Every TOTP factor, verified or not (an unverified one is a setup left halfway). */
  totpFactors: Factor[];
  passkeys: PasskeyListItem[];
}

/** Far enough ahead to mean "until an admin lifts it". */
export const PERMANENT_BAN = "876000h";

function readBanNote(meta: Record<string, unknown> | undefined): BanNote | null {
  const ban = meta?.ban as Partial<BanNote> | null | undefined;
  if (!ban || typeof ban.reason !== "string") return null;
  return { reason: ban.reason, by: String(ban.by ?? ""), at: String(ban.at ?? ""), discord: !!ban.discord };
}

export const loadUserAuthState = cache(async (userId: string): Promise<UserAuthState | null> => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  const user = data.user;

  const passkeys = await supabaseAdmin.auth.admin.passkey.listPasskeys({ userId });
  const bannedUntil = user.banned_until && new Date(user.banned_until).getTime() > Date.now() ? user.banned_until : null;

  return {
    lastSignInAt: user.last_sign_in_at ?? null,
    bannedUntil,
    ban: bannedUntil ? readBanNote(user.app_metadata) : null,
    providers: [...new Set((user.identities ?? []).map((identity) => identity.provider))],
    totpFactors: (user.factors ?? []).filter((factor) => factor.factor_type === "totp"),
    // Passkeys off on the project (local config) reads as none, like the admin gate.
    passkeys: passkeys.error ? [] : (passkeys.data ?? []),
  };
});
