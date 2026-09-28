import { z } from "zod";
import { env } from "./env";

const pveHostSchema = z.object({
  /** Our label for the host, also the webhook `source` (e.g. "pve1"). */
  name: z.string().min(1),
  /** https://pve1.<tailnet>.ts.net:8006 — no /api2/json suffix. */
  url: z.string().url(),
  tokenId: z.string().min(1),
  tokenSecret: z.string().min(1),
});

export type PveHostConfig = z.infer<typeof pveHostSchema>;

export interface BackupConfig {
  pbs: { url: string; tokenId: string; tokenSecret: string };
  datastore: string;
  namespace: string;
  pveHosts: PveHostConfig[];
  pollSeconds: number;
  /** backup_poll_state.id */
  pollId: string;
}

/**
 * The Proxmox monitoring config, or null when it isn't configured (every
 * environment except prod). A malformed PVE_HOSTS fails boot instead of
 * quietly monitoring fewer hosts; the error never echoes the value, which
 * holds token secrets.
 */
function loadBackupConfig(): BackupConfig | null {
  if (!env.PBS_URL || !env.PBS_NAMESPACE || !env.PBS_TOKEN_ID || !env.PBS_TOKEN_SECRET) return null;

  let pveHosts: PveHostConfig[] = [];
  if (env.PVE_HOSTS) {
    let raw: unknown;
    try {
      raw = JSON.parse(env.PVE_HOSTS);
    } catch {
      throw new Error("PVE_HOSTS is not valid JSON");
    }
    const parsed = z.array(pveHostSchema).safeParse(raw);
    if (!parsed.success) {
      throw new Error(`PVE_HOSTS is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    }
    pveHosts = parsed.data;
  }

  return {
    pbs: { url: env.PBS_URL, tokenId: env.PBS_TOKEN_ID, tokenSecret: env.PBS_TOKEN_SECRET },
    datastore: env.PBS_DATASTORE,
    namespace: env.PBS_NAMESPACE,
    pveHosts,
    pollSeconds: env.BACKUP_POLL_SECONDS,
    pollId: `${env.PBS_DATASTORE}/${env.PBS_NAMESPACE}`,
  };
}

export const backupConfig = loadBackupConfig();
