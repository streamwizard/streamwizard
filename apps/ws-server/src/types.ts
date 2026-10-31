import type { OverlayEventType } from "@repo/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServerWebSocket<T = any> = import("bun").ServerWebSocket<T>;

export interface ConnectionData {
  role: "subscriber" | "bot" | "monitor" | "consumer";
  userId: string;
  channels: Set<OverlayEventType>;
  connectedAt: number;
  connId: string;
  /**
   * Consumer-only: message types this consumer wants (from `?types=` CSV).
   * Empty/absent = every bot-routed type. Unlike subscriber `channels`, a
   * consumer sees ALL users' rooms — the role is gated on CONSUMER_SECRET.
   */
  consumerTypes?: Set<string>;
  /**
   * Self-declared identity of a bot connection ("ingest-node:<id>",
   * "streamwizard-bot"). Observability-only: every bot shares the same
   * secret, so a forged source can mislabel but not escalate.
   */
  source?: string;
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
