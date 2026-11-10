import { NextResponse } from "next/server";
import { assertAppEnv, assertAppName, assertValidFluxDuration } from "@repo/metrics";
import { getAdminSession } from "@/lib/auth/admin-session";
import { fetchAppSeries, fetchServerSeries } from "@/lib/apps/apps";

export const dynamic = "force-dynamic";

/**
 * Chart refresh for the /apps pages.
 * - `?env=prod&app=rest-api` → every series of that app
 * - `?server=1`              → every series of the Dokploy server
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
  let target: { env: ReturnType<typeof assertAppEnv>; app: ReturnType<typeof assertAppName> } | null = null;
  try {
    assertValidFluxDuration(range, "range");
    assertValidFluxDuration(window, "window");
    if (!searchParams.has("server")) {
      target = { env: assertAppEnv(searchParams.get("env") ?? ""), app: assertAppName(searchParams.get("app") ?? "") };
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  if (!target) return NextResponse.json(await fetchServerSeries(range, window));
  return NextResponse.json(await fetchAppSeries(target.env, target.app, range, window));
}
