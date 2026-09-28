import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { fetchEventsubMetrics } from "@/lib/eventsub-metrics";

export const dynamic = "force-dynamic";

// Unlike the older /api/metrics/* routes this one is gated: it carries
// session ids and the subscription inventory from Helix.
export async function GET(request: Request) {
  const { session } = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "15m";

  try {
    return NextResponse.json(await fetchEventsubMetrics(fluxRange, window));
  } catch (err) {
    // Only a bad range/window gets here; every source handles its own errors.
    console.error("[eventsub metrics]", err);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
