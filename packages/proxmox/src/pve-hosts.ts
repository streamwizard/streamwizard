import { z } from "zod";

export const pveHostSchema = z.object({
  /** Our label for the host, also the webhook `source` (e.g. "pve1"). */
  name: z.string().min(1),
  /** https://pve1.<tailnet>.ts.net:8006 — no /api2/json suffix. */
  url: z.string().url(),
  tokenId: z.string().min(1),
  tokenSecret: z.string().min(1),
  /** PVE node name, when it isn't `name`. Influx rows carry the node name. */
  node: z.string().min(1).optional(),
});

export type PveHostConfig = z.infer<typeof pveHostSchema>;

/**
 * PVE_HOSTS (a JSON array), parsed; empty when unset. Throws on a malformed
 * value; the error never echoes it, since it holds token secrets.
 */
export function parsePveHosts(raw: string | undefined): PveHostConfig[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("PVE_HOSTS is not valid JSON");
  }
  const parsed = z.array(pveHostSchema).safeParse(json);
  if (!parsed.success) {
    throw new Error(`PVE_HOSTS is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  return parsed.data;
}

/** The PVE node name of a host entry: `node`, else `name`. */
export const pveNodeName = (host: PveHostConfig) => host.node ?? host.name;
