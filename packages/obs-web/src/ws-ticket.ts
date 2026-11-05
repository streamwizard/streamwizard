// Browsers can't set an Authorization header on `new WebSocket()`, so auth has
// to ride on the URL -- and a bearer token in a WS URL leaks into node/proxy
// access logs and browser history. Instead we mint a short-lived, single-use,
// scope+instance-bound ticket from obs-instance-manager over an authenticated
// POST, and only that ticket goes on the socket. Mirrors how Twitch EventSub
// keeps the OAuth token off the WebSocket. Tickets are ~30s and single-use, so
// they must be minted immediately before each connect (including every
// reconnect), never cached.
//
// The POST itself carries a node token (see @repo/node-token), never the
// user's Supabase session: getToken asks the app's server action for one,
// bound to this node, instance and the ws-ticket scope.

export type WsTicketScope = "metrics" | "obsws" | "selkies";

export type GetNodeToken = () => Promise<string>;

async function getWsTicket(
  apiUrl: string,
  ticketPath: string,
  scope: WsTicketScope,
  getToken: GetNodeToken,
): Promise<string> {
  const token = await getToken();

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}${ticketPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ scope }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to get WebSocket ticket (${res.status})`);
  }

  const { ticket } = (await res.json()) as { ticket: string };
  return ticket;
}

function nodeUrl(apiUrl: string, path: string): URL {
  const url = new URL(apiUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`;
  return url;
}

// apiUrl must come from a trusted server-side lookup (never the query string):
// the ticket is appended and the URL dialed as a WebSocket, so an attacker-
// controlled apiUrl would exfiltrate the ticket to an arbitrary host.
export async function mintWsUrl(
  apiUrl: string,
  opts: { ticketPath: string; wsPath: string; scope: WsTicketScope; getToken: GetNodeToken },
): Promise<string> {
  const ticket = await getWsTicket(apiUrl, opts.ticketPath, opts.scope, opts.getToken);
  const url = nodeUrl(apiUrl, opts.wsPath);
  url.searchParams.set("ticket", ticket);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

// URL of an instance's Selkies viewer, served by obs-instance-manager's proxy
// on the node; the window just navigates there. The ticket goes in the
// fragment (#token=), which browsers never send to a server: the Selkies
// client reads it and presents it on its own API calls and WebSockets, where
// the node checks it (and instance ownership) on every connect. viewerPath
// must end in "/selkies/". Same trusted-apiUrl rule as above.
export async function mintSelkiesViewerUrl(
  apiUrl: string,
  opts: { ticketPath: string; viewerPath: string; getToken: GetNodeToken },
): Promise<string> {
  const ticket = await getWsTicket(apiUrl, opts.ticketPath, "selkies", opts.getToken);
  const url = nodeUrl(apiUrl, opts.viewerPath);
  url.hash = new URLSearchParams({ token: ticket }).toString();
  return url.toString();
}
