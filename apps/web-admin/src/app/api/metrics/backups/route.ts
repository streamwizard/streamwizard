import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { fetchBackupSeries } from "@/lib/backup-series";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { session } = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  return NextResponse.json(await fetchBackupSeries(searchParams.get("range") ?? "24h", searchParams.get("window") ?? "1h"));
}
