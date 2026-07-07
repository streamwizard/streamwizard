import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@repo/supabase/next/server";
import { env } from "@/lib/env";

// request.url's origin is the server's bind address (0.0.0.0) under Next
// standalone, so redirects are built from the configured base URL. The only
// header fallback is loopback hosts for local no-config runs — accepting
// arbitrary Host headers here would be an open redirect.
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

function requestOrigin(request: NextRequest): string {
  if (env.NEXT_PUBLIC_BASE_URL) return env.NEXT_PUBLIC_BASE_URL;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && LOOPBACK_HOST.test(host)) return `http://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const origin = requestOrigin(request);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  return NextResponse.redirect(`${origin}/ws`);
}
