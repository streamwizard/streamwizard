import type { BackupOverviewResponse, BackupVmDetailResponse } from "@repo/backups";
import { env } from "@/lib/env";
import { canCallInternal, internalAuthHeader } from "@/lib/internal-auth-header";

/**
 * Server-side reads of rest-api's /internal/backups, with a service token
 * (scope `backups`) signed per request. Browsers only ever talk to our own
 * /api/backups routes. Never throws: the page renders `error` instead.
 */

export type BackupFetch<T> = { data: T; error: null } | { data: null; error: string };

export const BACKUPS_NOT_CONFIGURED = "Backup monitoring is not configured for this environment.";

export async function callBackupsApi<T>(path: string, init: { method?: "GET" | "POST" } = {}): Promise<BackupFetch<T>> {
  if (!canCallInternal(env.REST_API_INTERNAL_SECRET)) return { data: null, error: BACKUPS_NOT_CONFIGURED };

  try {
    const authorization = (await internalAuthHeader("backups", env.REST_API_INTERNAL_SECRET))!;
    const res = await fetch(`${env.STREAMWIZARD_API_URL.replace(/\/+$/, "")}/internal/backups${path}`, {
      method: init.method ?? "GET",
      headers: { authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return { data: null, error: BACKUPS_NOT_CONFIGURED };
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { data: null, error: body?.error ?? `rest-api answered HTTP ${res.status}` };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (error) {
    const reason = (error as Error).name === "TimeoutError" ? "rest-api did not answer within 8 s" : (error as Error).message;
    return { data: null, error: reason };
  }
}

export const getBackupOverview = () => callBackupsApi<BackupOverviewResponse>("");

export const getBackupVm = (vmid: number) => callBackupsApi<BackupVmDetailResponse>(`/vms/${vmid}`);
