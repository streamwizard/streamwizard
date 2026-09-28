import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { getBackupOverview } from "@/lib/backups";

export const dynamic = "force-dynamic";

/** SWR refresh for /backups. Proxies rest-api so the browser never sees its secret. */
export async function GET() {
  const { session } = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getBackupOverview());
}
