import { refreshSession } from "@repo/supabase/next/proxy";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { isUserAdmin } from "@repo/supabase/queries/obs-nodes";
import { isStrongSession, type JwtPayload } from "@repo/supabase/auth/session-strength";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

// Paths that render without an admin session. Everything else is denied here,
// before any page runs: a layout gate alone is not enough, because App Router
// renders a page's segments in parallel with its layout (and RSC requests can
// skip shared layouts), so a page's service-role reads would still stream out.
// API routes check their own bearer secret or admin session.
const PUBLIC_PATHS = ["/login", "/auth", "/no-access", "/api", "/monitoring"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Same rule as getAdminSession, minus the factor inventory the auth pages need. */
async function adminRedirect(claims: JwtPayload | null): Promise<string | null> {
  if (!claims?.sub) return "/login?error=signin_required";
  if (!(await isUserAdmin(supabaseAdmin, claims.sub))) return "/no-access";
  // /auth/verify sends admins with no factor yet on to /auth/setup.
  if (!isStrongSession(claims)) return "/auth/verify";
  return null;
}

export async function proxy(request: NextRequest) {
  // Per-request nonce'd CSP. The header must be on the *request* before
  // refreshSession builds its pass-through response (Next reads the nonce from
  // the forwarded request header to tag its inline scripts) and on the
  // *response* (so the browser enforces it). A static header without a nonce
  // would need script-src 'unsafe-inline', defeating CSP's XSS protection.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  request.headers.set("content-security-policy", csp);
  // Next reads the nonce from the CSP header for its own inline scripts, but
  // next-themes' anti-flash script can't see it. Expose it so the root layout
  // can pass it to the ThemeProvider.
  request.headers.set("x-nonce", nonce);

  const session = await refreshSession(request);
  let response = session.response;
  if (!isPublicPath(request.nextUrl.pathname)) {
    const to = await adminRedirect(session.claims);
    if (to) {
      const redirect = NextResponse.redirect(new URL(to, request.url));
      // Keep any cookies the session refresh just rotated.
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      response = redirect;
    }
  }
  // In dev the policy is report-only: nothing is blocked (local Supabase and
  // ws-server run on plain http/ws), but violations still log to the browser
  // console so missing directives surface before staging. The *request* header
  // above must keep the enforcing name either way — Next reads the nonce from it.
  const responseHeader =
    process.env.NODE_ENV === "development" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  response.headers.set(responseHeader, csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
