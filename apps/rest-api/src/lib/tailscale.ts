import { env } from "./env";

// "-" is Tailscale's shorthand for "the tailnet this credential belongs to" --
// works for OAuth clients since each one is scoped to exactly one tailnet.
const TAILSCALE_TAILNET = "-";

async function getTailscaleAccessToken(): Promise<string> {
  const res = await fetch("https://api.tailscale.com/api/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TAILSCALE_OAUTH_CLIENT_ID,
      client_secret: env.TAILSCALE_OAUTH_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tailscale OAuth token request failed ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** The ACL tags the OAuth client (TAILSCALE_OAUTH_CLIENT_ID) is allowed to
 *  mint keys for. Adding a tag here also means adding it to the client's
 *  scope in the Tailscale admin console, or minting silently returns null. */
export type TailscaleNodeTag = "tag:ingest-node" | "tag:obs-node";

// Mints a fresh, single-use, pre-authorized auth key carrying the given tag --
// this is what lets a node's install.sh join Tailscale automatically instead
// of an admin pasting a manually-generated key into the install command.
// Scoped to a short lifetime since it's only ever needed for the one
// `tailscale up` call made right after the claim response arrives. Non-fatal
// on failure: returns null rather than throwing, so a Tailscale API hiccup
// doesn't fail the whole claim -- install.sh falls back to warning and
// requiring a manual `tailscale up` in that case, same as if no key were
// available at all.
export async function mintTailscaleAuthKey(opts: {
  nodeId: string;
  tag: TailscaleNodeTag;
  description: string;
}): Promise<string | null> {
  try {
    const accessToken = await getTailscaleAccessToken();
    const res = await fetch(`https://api.tailscale.com/api/v2/tailnet/${TAILSCALE_TAILNET}/keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capabilities: {
          devices: {
            create: {
              reusable: false,
              ephemeral: false,
              preauthorized: true,
              tags: [opts.tag],
            },
          },
        },
        expirySeconds: 3600,
        description: opts.description,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Tailscale key creation failed ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { key: string };
    return data.key;
  } catch (err) {
    console.warn("[tailscale] failed to mint auth key", {
      nodeId: opts.nodeId,
      tag: opts.tag,
      error: (err as Error).message,
    });
    return null;
  }
}
