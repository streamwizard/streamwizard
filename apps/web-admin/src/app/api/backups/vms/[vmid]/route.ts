import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { getBackupVm } from "@/lib/backups";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ vmid: string }> }) {
  const { session } = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const vmid = Number((await params).vmid);
  if (!Number.isInteger(vmid) || vmid <= 0) return NextResponse.json({ error: "Invalid vmid" }, { status: 400 });
  return NextResponse.json(await getBackupVm(vmid));
}
