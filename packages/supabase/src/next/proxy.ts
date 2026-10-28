import { createServerClient } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/account", "/deck"];

/**
 * Refresh the Supabase session cookies for this request and return the
 * verified JWT claims (null when signed out). updateSession is built on this;
 * apps with their own gate (web-admin) call it directly.
 */
export async function refreshSession(request: NextRequest): Promise<{ response: NextResponse; claims: JwtPayload | null }> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Mirror server.ts: fall back to the non-prefixed Doppler vars. In a
  // standalone build the NEXT_PUBLIC_ values are only baked in when Supabase
  // env is present at *build* time; reading the plain names keeps the
  // middleware pointed at the right project (so cookie names match) even when
  // the build ran without them and only runtime env is available.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response: supabaseResponse, claims: data?.claims ?? null };
}

export async function updateSession(request: NextRequest) {
  const { response: supabaseResponse, claims: user } = await refreshSession(request);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Carry the original destination so login can send the user back to it
    // (the login page forwards this through the OAuth flow as `next`).
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
