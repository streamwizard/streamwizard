import { NextResponse } from "next/server";
import { EMPTY_SUPABASE_METRICS, fetchSupabaseMetrics } from "@/lib/supabase-metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  try {
    return NextResponse.json(await fetchSupabaseMetrics(fluxRange, window));
  } catch (err) {
    console.error("[supabase metrics]", err);
    return NextResponse.json(EMPTY_SUPABASE_METRICS);
  }
}
