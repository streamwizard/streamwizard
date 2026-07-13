import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@repo/supabase/next/server";

// Relative Location headers are resolved by the browser against the origin it
// is already on, so redirects stay same-origin by construction — no need to
// reconstruct our own origin from config or (spoofable) Host headers.
// NextResponse.redirect() only accepts absolute URLs, hence the manual 307.
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return redirectTo("/login?error=oauth_failed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectTo("/login?error=oauth_failed");
  }

  return redirectTo("/ws");
}
