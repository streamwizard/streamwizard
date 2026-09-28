"use server";

import type { BackupOverviewResponse } from "@repo/backups";
import { assertAdmin } from "@/lib/assert-admin";
import { callBackupsApi, type BackupFetch } from "@/lib/backups";

/** "Refresh now" on /backups: one poll of PBS and the PVE hosts. rest-api
 * allows it once a minute and answers with the fresh overview. */
export async function refreshBackups(): Promise<BackupFetch<BackupOverviewResponse>> {
  await assertAdmin();
  return callBackupsApi<BackupOverviewResponse>("/refresh", { method: "POST" });
}
