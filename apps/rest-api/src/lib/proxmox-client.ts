/**
 * Minimal read-only client for the PBS and PVE JSON APIs. Only GET exists on
 * purpose: the monitoring tokens can't write anyway, and neither can this.
 *
 * TLS is plain verification. PBS and the PVE hosts serve `tailscale cert`
 * certificates, so there is nothing to pin or disable here.
 */

export class ProxmoxApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ProxmoxApiError";
  }
}

export interface ProxmoxClient {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
}

export interface ProxmoxClientOptions {
  /** https://host:port, without /api2/json */
  baseUrl: string;
  /** Full Authorization header value. */
  authorization: string;
  /** Label used in error messages ("pbs", "pve1"). */
  label: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** PBS separates token id and secret with a colon. */
export const pbsAuthorization = (tokenId: string, secret: string) => `PBSAPIToken=${tokenId}:${secret}`;
/** PVE separates them with an equals sign. */
export const pveAuthorization = (tokenId: string, secret: string) => `PVEAPIToken=${tokenId}=${secret}`;

export function createProxmoxClient(opts: ProxmoxClientOptions): ProxmoxClient {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  return {
    async get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
      const url = new URL(`${base}/api2/json${path}`);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
      }

      let res: Response;
      try {
        res = await doFetch(url, {
          method: "GET",
          headers: { Authorization: opts.authorization, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const reason = (error as Error).name === "TimeoutError" ? `timed out after ${timeoutMs / 1000}s` : (error as Error).message;
        throw new ProxmoxApiError(`${opts.label} GET ${path}: ${reason}`, null);
      }

      if (!res.ok) {
        // Proxmox puts the reason in the status text or a {message} body.
        const body = await res.text().catch(() => "");
        const detail = (body.match(/"message"\s*:\s*"([^"]{1,200})/)?.[1] ?? res.statusText ?? "").replace(/\\n/g, " ").trim();
        throw new ProxmoxApiError(`${opts.label} GET ${path}: HTTP ${res.status}${detail ? ` ${detail}` : ""}`, res.status);
      }

      const json = (await res.json()) as { data?: T };
      if (json.data === undefined) throw new ProxmoxApiError(`${opts.label} GET ${path}: response has no data`, res.status);
      return json.data;
    },
  };
}
