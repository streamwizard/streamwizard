import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { updateSession } from "@/lib/supabase/middleware";
import { env } from "./lib/env";
import { supabaseAdmin } from "./lib/supabase/admin";
export async function middleware(request: NextRequest) {

  if(env.NODE_ENV === "test") {
    const clientIP = (await headers()).get("x-forwarded-for") || null;

    console.log(clientIP);

    if (!clientIP) return NextResponse.redirect(env.NEXT_PUBLIC_BASE_URL);
  
    const { data, error } = await supabaseAdmin.from("dev_access_ips").select("*").eq("ip_address", clientIP).eq("is_active", true).single();
  
    if (error) {
      console.error(error);
      return NextResponse.redirect(env.NEXT_PUBLIC_BASE_URL);
    }
  
    if (!data) {
      return NextResponse.redirect(env.NEXT_PUBLIC_BASE_URL);
    }
  }
  
  
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
