export interface MonitorEnvelope {
  ts: number;
  kind: "message" | "connect" | "disconnect" | "room" | "snapshot";
  direction: "inbound" | "outbound" | "system";
  role: "publisher" | "subscriber" | "bot";
  roomId: string;
  eventType?: string;
  payload?: unknown;
  meta?: {
    subscriberCount?: number;
    hasPublisher?: boolean;
    durationMs?: number;
    sessionId?: string;
  };
}

export interface ConnectionSnapshot {
  connId: string;
  role: "publisher" | "subscriber";
  connectedAt: number;
  channels: string[];
}

export interface RoomSnapshot {
  roomId: string;
  hasPublisher: boolean;
  subscriberCount: number;
  sessionId: string;
  streamId: string | null;
  connections: ConnectionSnapshot[];
}

export interface BotSnapshot {
  connected: boolean;
  connId: string | null;
  connectedAt: number | null;
}

export interface MonitorSnapshot {
  ts: number;
  kind: "snapshot";
  rooms: RoomSnapshot[];
  totalConnections: number;
  bot: BotSnapshot;
}

export type MonitorMessage = MonitorEnvelope | MonitorSnapshot;
