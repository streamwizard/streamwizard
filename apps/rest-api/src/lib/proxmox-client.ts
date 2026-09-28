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

type Params = Record<string, string | number | boolean | undefined>;

export interface ProxmoxClient {
  get<T>(path: string, params?: Params): Promise<T>;
  /** Raw response body (PBS file downloads). Aborts past `maxBytes`. */
  getRaw(path: string, params: Params, opts: { maxBytes: number; timeoutMs?: number }): Promise<Uint8Array>;
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

  async function request(path: string, params: Params, accept: string, requestTimeoutMs: number): Promise<Response> {
    const url = new URL(`${base}/api2/json${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
    }

    let res: Response;
    try {
      res = await doFetch(url, {
        method: "GET",
        headers: { Authorization: opts.authorization, Accept: accept },
        // Covers reading the body too, not only the headers.
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      throw new ProxmoxApiError(`${opts.label} GET ${path}: ${failReason(error, requestTimeoutMs)}`, null);
    }

    if (!res.ok) {
      // Proxmox puts the reason in the status text or a {message} body.
      const body = await res.text().catch(() => "");
      const detail = (body.match(/"message"\s*:\s*"([^"]{1,200})/)?.[1] ?? res.statusText ?? "").replace(/\\n/g, " ").trim();
      throw new ProxmoxApiError(`${opts.label} GET ${path}: HTTP ${res.status}${detail ? ` ${detail}` : ""}`, res.status);
    }
    return res;
  }

  return {
    async get<T>(path: string, params: Params = {}): Promise<T> {
      const res = await request(path, params, "application/json", timeoutMs);
      const json = (await res.json()) as { data?: T };
      if (json.data === undefined) throw new ProxmoxApiError(`${opts.label} GET ${path}: response has no data`, res.status);
      return json.data;
    },

    async getRaw(path: string, params: Params, { maxBytes, timeoutMs: rawTimeoutMs = timeoutMs }): Promise<Uint8Array> {
      const res = await request(path, params, "application/octet-stream", rawTimeoutMs);
      const declared = Number(res.headers.get("content-length"));
      if (declared > maxBytes) {
        await res.body?.cancel().catch(() => {});
        throw new ProxmoxApiError(`${opts.label} GET ${path}: ${declared} bytes is over the ${maxBytes} byte limit`, res.status);
      }
      if (!res.body) return new Uint8Array(0);

      // Read in pieces so an unexpectedly large file is cut off, not buffered.
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let total = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new ProxmoxApiError(`${opts.label} GET ${path}: over the ${maxBytes} byte limit`, res.status);
          }
          parts.push(value);
        }
      } catch (error) {
        if (error instanceof ProxmoxApiError) throw error;
        throw new ProxmoxApiError(`${opts.label} GET ${path}: ${failReason(error, rawTimeoutMs)}`, null);
      }

      const out = new Uint8Array(total);
      let offset = 0;
      for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
      }
      return out;
    },
  };
}

function failReason(error: unknown, timeoutMs: number): string {
  return (error as Error).name === "TimeoutError" ? `timed out after ${timeoutMs / 1000}s` : (error as Error).message;
}
