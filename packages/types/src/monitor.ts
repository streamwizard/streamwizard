import type { IngestNodeBandwidthPayload } from "./overlay-ws";

/**
 * Frames ws-server sends to `role=monitor` sockets (web-admin's /ws and
 * /ingest pages). ws-server builds them in `modules/monitor/broadcast.ts`;
 * web-admin reads them in `lib/monitor/`. Room ids are masked before they
 * leave ws-server.
 */

export interface ConnectionSnapshot {
  connId: string;
  role: "subscriber";
  connectedAt: number;
  channels: string[];
}

export interface RoomSnapshot {
  roomId: string;
  subscriberCount: number;
  connections: ConnectionSnapshot[];
}

export interface BotSnapshot {
  connected: boolean;
  connId: string | null;
  connectedAt: number | null;
}

export interface BotConnSnapshot {
  connId: string;
  connectedAt: number;
  source: string;
}

export interface ConsumerConnSnapshot {
  connId: string;
  connectedAt: number;
  source: string;
  /** Message-type filter the consumer subscribed with (empty = everything). */
  types: string[];
}

/** Latest non-stale bandwidth reading for one ingest node (host NIC totals). */
export interface IngestNodeLive {
  nodeId: string;
  /** Sample timestamp from the node (epoch ms). */
  ts: number;
  rxBps: number;
  txBps: number;
  tsRxBps: number;
  tsTxBps: number;
}

export interface MonitorEnvelope {
  ts: number;
  kind: "message" | "connect" | "disconnect" | "room";
  direction: "inbound" | "outbound" | "system";
  role: "subscriber" | "bot" | "consumer";
  roomId: string;
  eventType?: string;
  payload?: unknown;
  /** Bot self-declared identity ("ingest-node:<id>"), when the sender is a bot. */
  source?: string;
  meta?: {
    subscriberCount?: number;
    durationMs?: number;
    /**
     * For bot messages: whether a room existed and the message actually
     * reached subscribers. Mirrored envelopes are sent to monitors either way
     * so ops can see stats for streams nobody is watching.
     */
    delivered?: boolean;
  };
}

export interface MonitorSnapshot {
  ts: number;
  kind: "snapshot";
  rooms: RoomSnapshot[];
  totalConnections: number;
  /** Legacy single-bot view, derived from `bots`; kept for older monitor UIs. */
  bot: BotSnapshot;
  bots: BotConnSnapshot[];
  consumers: ConsumerConnSnapshot[];
  ingestNodes: IngestNodeLive[];
  ingestFleet: { rxBps: number; txBps: number; nodeCount: number };
}

/** Live per-node bandwidth forward. No roomId, so no masking applies. */
export interface MonitorNodeBandwidth {
  ts: number;
  kind: "node_bandwidth";
  source?: string;
  payload: IngestNodeBandwidthPayload;
}

/** Any frame a monitor socket receives. */
export type MonitorMessage = MonitorEnvelope | MonitorSnapshot | MonitorNodeBandwidth;
