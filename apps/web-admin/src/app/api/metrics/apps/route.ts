import { NextResponse } from "next/server";
import { assertAppEnv, assertAppName, assertValidFluxDuration } from "@repo/metrics";
import { getAdminSession } from "@/lib/admin-session";
import { fetchAppSeries, fetchServerSeries } from "@/lib/apps";

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
  try {
    assertValidFluxDuration(range, "range");
    assertValidFluxDuration(window, "window");
    if (searchParams.has("server")) return NextResponse.json(await fetchServerSeries(range, window));
    const env = assertAppEnv(searchParams.get("env") ?? "");
    const app = assertAppName(searchParams.get("app") ?? "");
    return NextResponse.json(await fetchAppSeries(env, app, range, window));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
