import { NextResponse } from "next/server";
import { assertTraefikScope, assertValidFluxDuration } from "@repo/metrics";
import { getAdminSession } from "@/lib/admin-session";
import { fetchTraefikSeries } from "@/lib/traefik";

export const dynamic = "force-dynamic";

/**
 * Chart and error-table refresh for the /traefik page.
 * - `?env=prod` (or staging, shared, other, all) → every series of that scope
 * Plus `range` and `window` (Flux durations) from the header controls.
 */
export async function GET(request: Request) {
  const { session } = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";
  try {
    assertValidFluxDuration(range, "range");
    assertValidFluxDuration(window, "window");
    const scope = assertTraefikScope(searchParams.get("env") ?? "");
    return NextResponse.json(await fetchTraefikSeries(scope, range, window));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
