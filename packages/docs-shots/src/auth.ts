import { execFileSync } from "node:child_process";

/**
 * Real users arrive through Twitch OAuth, so there is no password to type.
 * The local stack keeps a password user for exactly this; signing it in and
 * minting the @supabase/ssr cookie by hand is what lets a headless browser
 * open a protected route.
 */
const SMOKE_EMAIL = process.env.SHOTS_USER_EMAIL ?? "deck-smoke-test@example.com";
const SMOKE_PASSWORD = process.env.SHOTS_USER_PASSWORD ?? "deck-smoke-test-pass-123";

/** @supabase/ssr chunks a cookie above this, and the server rejoins the parts. */
const COOKIE_CHUNK_LIMIT = 3180;

export interface LocalSupabase {
  url: string;
  anonKey: string;
  serviceKey: string;
}

/**
 * Read the local stack's keys from the CLI rather than from a file, and refuse
 * to run against anything that is not localhost. Mirrors the guard in
 * scripts/cms-mock/seed.ts.
 */
export function localSupabase(): LocalSupabase {
  const raw = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
  const env = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m?.[1] && m[2] !== undefined) env.set(m[1], m[2]);
  }
  const url = env.get("API_URL");
  const anonKey = env.get("ANON_KEY") ?? env.get("PUBLISHABLE_KEY");
  const serviceKey = env.get("SERVICE_ROLE_KEY") ?? env.get("SECRET_KEY");
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Could not read the local Supabase keys. Is `supabase start` running?");
  }
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to run against ${host}. The harness is local-only.`);
  }
  return { url, anonKey, serviceKey };
}

/**
 * The cookie name is derived from the Supabase host, so a local stack on
 * 127.0.0.1 looks for `sb-127-auth-token`.
 */
function cookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

export async function signInCookie(supabase: LocalSupabase): Promise<string> {
  const res = await fetch(`${supabase.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabase.anonKey },
    body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(
      `Could not sign in as ${SMOKE_EMAIL} (${res.status}). ` +
        `Create the user, or set SHOTS_USER_EMAIL and SHOTS_USER_PASSWORD.`,
    );
  }
  const session = await res.json();
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const name = cookieName(supabase.url);

  if (encoded.length <= COOKIE_CHUNK_LIMIT) return `${name}=${encoded}`;

  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += COOKIE_CHUNK_LIMIT) {
    chunks.push(encoded.slice(i, i + COOKIE_CHUNK_LIMIT));
  }
  return chunks.map((chunk, i) => `${name}.${i}=${chunk}`).join("; ");
}
