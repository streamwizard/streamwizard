import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("irl_sessions")
    .select("total_distance_meters")
    .eq("subscriber_token", token)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ total_distance_meters: data?.total_distance_meters ?? 0 });
}
