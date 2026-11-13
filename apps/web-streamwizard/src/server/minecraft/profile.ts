import "server-only";

import { z } from "zod";
import { TtlCache } from "@repo/ttl-cache";
import { MINECRAFT_USERNAME_PATTERN } from "@/schemas/smp";

/*
 * Resolves a Minecraft Java name to the account's UUID through Mojang's public
 * profile API. The game server lets players in by UUID, and a name can change,
 * so the UUID is what the waitlist is keyed on.
 */

export type MinecraftProfileLookup =
  /** `name` is Mojang's own spelling, which can differ in case from what was typed. */
  | { status: "found"; uuid: string; name: string }
  | { status: "not_found" }
  /** Mojang did not answer, or answered with something unexpected. Worth a retry. */
  | { status: "unavailable" };

interface MinecraftProfile {
  uuid: string;
  name: string;
}

const LOOKUP_URL = "https://api.mojang.com/users/profiles/minecraft/";
const LOOKUP_TIMEOUT_MS = 5_000;

const profileResponseSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/i),
  name: z.string().regex(MINECRAFT_USERNAME_PATTERN),
});

// A found profile is stable for a while; a miss is kept only briefly, because
// "I just made the account" and "I fixed the typo" both follow a miss.
const profiles = new TtlCache<MinecraftProfile>({ ttlMs: 10 * 60_000, negativeTtlMs: 30_000, maxEntries: 1_000 });

/** Mojang returns the UUID as 32 hex digits; Postgres and the game server use the dashed form. */
function dashedUuid(hex: string): string {
  const h = hex.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Null when Mojang says there is no such account. Throws when it cannot say. */
async function fetchProfile(name: string): Promise<MinecraftProfile | null> {
  const response = await fetch(`${LOOKUP_URL}${encodeURIComponent(name)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    cache: "no-store",
  });
  // 404 today; 204 is what the same endpoint answered for years.
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw new Error(`Mojang profile lookup failed: ${response.status}`);
  const profile = profileResponseSchema.parse(await response.json());
  return { uuid: dashedUuid(profile.id), name: profile.name };
}

/**
 * `name` must already have passed MINECRAFT_USERNAME_PATTERN: it goes into a
 * URL, and anything else is a wasted request.
 */
export async function resolveMinecraftProfile(name: string): Promise<MinecraftProfileLookup> {
  if (!MINECRAFT_USERNAME_PATTERN.test(name)) return { status: "not_found" };
  try {
    const profile = await profiles.fetch(name.toLowerCase(), () => fetchProfile(name));
    return profile ? { status: "found", ...profile } : { status: "not_found" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Tests only: start each case with a cold cache. */
export function resetMinecraftProfileCache(): void {
  profiles.clear();
}
