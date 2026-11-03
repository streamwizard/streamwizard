import type { BotOutboundMessage } from "@repo/types";
import { trackWsMessage, trackWsMessageDrop } from "@repo/metrics";
import { addBotSocket, broadcastNodeBandwidth } from "@/modules/monitor";
import { updateNodeBandwidth } from "@/modules/ingest/bandwidth";
import type { ConnectionData, ServerWebSocket } from "@/types";
import { routeBotBroadcast } from "./route-broadcast";

// role=bot: fan-out broadcasts into users' rooms, plus heartbeats and the
// legacy node-scoped bandwidth messages.
export function handleBotMessage(ws: ServerWebSocket<ConnectionData>, rawStr: string): void {
  // Re-register on every message (Map.set by connId — effectively free).
  // The registry fills at open(), but a dev --hot reload resets module
  // state while sockets stay open: bandwidth state self-heals because
  // it's message-driven, and without this the bot would stay invisible
  // in the snapshot/topology until it reconnected.
  addBotSocket(ws);

  let msg: BotOutboundMessage;
  try {
    msg = JSON.parse(rawStr) as BotOutboundMessage;
  } catch {
    console.warn("[bot] malformed message");
    trackWsMessageDrop("bot", "malformed_json");
    return;
  }

  // Node-scoped messages: never room-routed. (`kind` only exists on
  // node-scoped messages, so `in` splits them from fan-out broadcasts.)
  if ("kind" in msg) {
    // Heartbeat echo — the bot client uses the pong to tell a healthy
    // link from a half-open TCP connection.
    if (msg.kind === "ping") {
      ws.send(JSON.stringify({ kind: "pong", ts: msg.ts }));
      return;
    }

    // Metrics fold into the per-node bandwidth state (feeds the 5s
    // snapshot) and forward live to monitors.
    const p = msg.payload;
    if (typeof p?.node_id !== "string" || p.node_id.length === 0 || typeof p.rx_bytes_per_sec !== "number" || typeof p.tx_bytes_per_sec !== "number") {
      trackWsMessageDrop("bot", "malformed_node_metrics");
      return;
    }
    trackWsMessage("bot", "node_metrics", ws.data.source);
    updateNodeBandwidth(p);
    broadcastNodeBandwidth({ ts: Date.now(), kind: "node_bandwidth", source: ws.data.source, payload: p });
    return;
  }

  // A broadcast without a target user can't be routed or mirrored
  // (maskRoomId needs a string) — treat it as malformed.
  if (typeof msg.userId !== "string" || msg.userId.length === 0) {
    trackWsMessageDrop("bot", "malformed_json");
    return;
  }

  routeBotBroadcast(msg, ws.data.source);
}
