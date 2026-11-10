// What each service may ask the others to do. Kept apart from the signing and
// verifying code (and its jose import) so app env schemas can check a signing
// key's svc without pulling crypto into a browser bundle.

/** The services that verify tokens. A token is signed for exactly one. */
export const SERVICE_AUDIENCES = ["ws-server", "rest-api", "discord-bot"] as const;
export type ServiceAudience = (typeof SERVICE_AUDIENCES)[number];

/** What a token can be used for. One scope per token. */
export const SERVICE_SCOPES = [
  /** POST /internal/broadcast */
  "broadcast",
  /** POST /internal/revoke */
  "revoke",
  /** role=consumer socket: the firehose of every user's events */
  "consumer",
  /** role=bot socket: push events into any user's room */
  "bot",
  /** role=ingest-node socket: one ingest node's live data. rest-api signs
   *  these for a node (claim `node`); the node holds the token, not a key. */
  "ingest-node",
  /** POST /internal/ingest-sessions(/:id/end): the live session registry */
  "ingest-sessions",
  /** role=monitor socket: the sanitized ops feed. web-admin signs these in a
   *  server action after its admin check; the admin's browser holds the
   *  token, not a key. */
  "monitor",
  /** rest-api /internal/backups: read backup state and force a poll */
  "backups",
  /** discord-bot /internal/guilds/*: drop caches and run dashboard actions */
  "discord-guilds",
] as const;
export type ServiceScope = (typeof SERVICE_SCOPES)[number];

/** Which service accepts each scope. The token's audience comes from here, so
 *  a token for one service is refused by every other. */
export const SCOPE_AUDIENCE = {
  broadcast: "ws-server",
  revoke: "ws-server",
  consumer: "ws-server",
  bot: "ws-server",
  "ingest-node": "ws-server",
  "ingest-sessions": "ws-server",
  monitor: "ws-server",
  backups: "rest-api",
  "discord-guilds": "discord-bot",
} as const satisfies Record<ServiceScope, ServiceAudience>;

/** Every service that signs tokens, and what each one may do. */
export const SERVICE_POLICY = {
  "rest-api": ["broadcast", "revoke", "ingest-node", "ingest-sessions"],
  "web-streamwizard": ["broadcast", "revoke"],
  "web-admin": ["broadcast", "revoke", "monitor", "backups", "discord-guilds"],
  "web-overlay": ["broadcast"],
  "obs-auto-switcher": ["consumer", "bot"],
  "streamwizard-bot": ["bot"],
} as const satisfies Record<string, readonly ServiceScope[]>;
export type ServiceName = keyof typeof SERVICE_POLICY;
export const SERVICE_NAMES = Object.keys(SERVICE_POLICY) as ServiceName[];

export function isServiceName(value: unknown): value is ServiceName {
  return typeof value === "string" && Object.hasOwn(SERVICE_POLICY, value);
}

export function serviceMay(service: ServiceName, scope: ServiceScope): boolean {
  return (SERVICE_POLICY[service] as readonly ServiceScope[]).includes(scope);
}
