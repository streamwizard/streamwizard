import { parsePveHosts, type PveHostConfig } from "@repo/proxmox";
import { env } from "./env";

export type { PveHostConfig };

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
  return {
    pbs: { url: env.PBS_URL, tokenId: env.PBS_TOKEN_ID, tokenSecret: env.PBS_TOKEN_SECRET },
    datastore: env.PBS_DATASTORE,
    namespace: env.PBS_NAMESPACE,
    pveHosts: parsePveHosts(env.PVE_HOSTS),
    pollSeconds: env.BACKUP_POLL_SECONDS,
    pollId: `${env.PBS_DATASTORE}/${env.PBS_NAMESPACE}`,
  };
}

export const backupConfig = loadBackupConfig();
