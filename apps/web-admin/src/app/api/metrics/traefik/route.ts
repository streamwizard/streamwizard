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
  // Only the input checks answer 400 with their message; a failed Influx
  // query is left to Next's generic 500.
  let scope: ReturnType<typeof assertTraefikScope>;
  try {
    assertValidFluxDuration(range, "range");
    assertValidFluxDuration(window, "window");
    scope = assertTraefikScope(searchParams.get("env") ?? "");
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  return NextResponse.json(await fetchTraefikSeries(scope, range, window));
}
