import type { OverlayEventType } from "@repo/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServerWebSocket<T = any> = import("bun").ServerWebSocket<T>;

export interface ConnectionData {
  role: "publisher" | "subscriber" | "bot" | "monitor";
  userId: string;
  session_id?: string;
  channels: Set<OverlayEventType>;
  connectedAt: number;
  connId: string;
}

export interface RoomData {
  publisher: ServerWebSocket<ConnectionData> | null;
  subscribers: Set<ServerWebSocket<ConnectionData>>;
  session_id: string;
  stream_id: string | null;
}
