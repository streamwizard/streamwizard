import { NextResponse } from "next/server";
import { assertProxmoxName, assertValidFluxDuration } from "@repo/metrics";
import { getAdminSession } from "@/lib/admin-session";
import { fetchGuestSeries, fetchHostSeries } from "@/lib/vms";

export const dynamic = "force-dynamic";

/**
 * Chart refresh for the /vms pages.
 * - `?host=pve1&vmid=100` → every series of that guest
 * - `?host=pve1`          → every series of that PVE host and its storages
 * Plus `range` and `window` (Flux durations) from the header controls.
 */
export async function GET(request: Request) {
  const { session } = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";
  const host = searchParams.get("host") ?? "";
  const rawVmid = searchParams.get("vmid");
  let vmid: number | null = null;
  try {
    assertValidFluxDuration(range, "range");
    assertValidFluxDuration(window, "window");
    assertProxmoxName(host, "host");
    if (rawVmid !== null) {
      if (!/^\d{1,9}$/.test(rawVmid) || Number(rawVmid) <= 0) throw new Error("Invalid vmid");
      vmid = Number(rawVmid);
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  return NextResponse.json(vmid === null ? await fetchHostSeries(host, range, window) : await fetchGuestSeries(host, vmid, range, window));
}
