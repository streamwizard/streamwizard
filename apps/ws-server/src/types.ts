import type { CONNECTION_ROLES } from "@/modules/connections/schemas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServerWebSocket<T = any> = import("bun").ServerWebSocket<T>;

export interface ConnectionData {
  role: (typeof CONNECTION_ROLES)[number];
  userId: string;
  /** Subscriber only: event types from `?channels=` CSV. Empty = every type. */
  channels: Set<string>;
  connectedAt: number;
  connId: string;
  /**
   * Consumer-only: message types this consumer wants (from `?types=` CSV).
   * Empty/absent = every bot-routed type. Unlike subscriber `channels`, a
   * consumer sees ALL users' rooms — the role is gated on a service token.
   */
  consumerTypes?: Set<string>;
  /**
   * Who a bot, consumer, ingest-node or monitor connection is ("streamwizard-bot",
   * "ingest-node:<id>"). Taken from the verified service token.
   */
  source?: string;
  /**
   * Ingest-node only: the node this socket speaks for, from the `node` claim
   * of the token rest-api signed. Never from anything the node sends.
   */
  ingestNodeId?: string;
  /**
   * Subscriber only: the credential the upgrade was authorised with,
   * so it can be re-checked later (see revoke.ts). "scene" is an overlay's
   * subscriber_token, "session" a dashboard user's Supabase JWT.
   */
  credential?: { kind: "scene" | "session"; token: string };
}

export interface RoomData {
  subscribers: Set<ServerWebSocket<ConnectionData>>;
}
