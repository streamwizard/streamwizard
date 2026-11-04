import { botBroadcastMessageSchema, botNodeScopedMessageSchema } from "@repo/schemas/ws-server";
import { trackWsMessage, trackWsMessageDrop } from "@repo/metrics";
import { warnOnce } from "@/lib/warn-once";
import { addBotSocket, broadcastNodeBandwidth } from "@/modules/monitor";
import { updateNodeBandwidth } from "@/modules/ingest/bandwidth";
import { nodeBandwidthFrom } from "@/modules/ingest/messages";
import type { ConnectionData, ServerWebSocket } from "@/types";
import { routeBotBroadcast } from "./route-broadcast";

function drop(ws: ServerWebSocket<ConnectionData>, reason: "malformed_json" | "malformed_node_metrics"): void {
  trackWsMessageDrop("bot", reason);
  warnOnce(`bot:${reason}`, `[bot] dropped a frame (${reason}) source=${ws.data.source ?? "unknown"}`);
}

// role=bot: fan-out broadcasts into users' rooms, plus heartbeats and the
// legacy node-scoped bandwidth messages. Frames are parsed against
// @repo/schemas/ws-server; a bad one is dropped, counted, and logged once.
export function handleBotMessage(ws: ServerWebSocket<ConnectionData>, rawStr: string): void {
  // Re-register on every message (Map.set by connId — effectively free).
  // The registry fills at open(), but a dev --hot reload resets module
  // state while sockets stay open: bandwidth state self-heals because
  // it's message-driven, and without this the bot would stay invisible
  // in the snapshot/topology until it reconnected.
  addBotSocket(ws);

  let json: unknown;
  try {
    json = JSON.parse(rawStr);
  } catch {
    return drop(ws, "malformed_json");
  }

  // Node-scoped messages: never room-routed. (`kind` only exists on
  // node-scoped messages, so it splits them from fan-out broadcasts.)
  if (typeof json === "object" && json !== null && "kind" in json) {
    const parsed = botNodeScopedMessageSchema.safeParse(json);
    if (!parsed.success) {
      return drop(ws, (json as { kind?: unknown }).kind === "node_metrics" ? "malformed_node_metrics" : "malformed_json");
    }
    const msg = parsed.data;
    // Heartbeat echo — the bot client uses the pong to tell a healthy
    // link from a half-open TCP connection.
    if (msg.kind === "ping") {
      ws.send(JSON.stringify({ kind: "pong", ts: msg.ts }));
      return;
    }

    // Metrics fold into the per-node bandwidth state (feeds the 5s
    // snapshot) and forward live to monitors.
    const payload = nodeBandwidthFrom(msg.payload.node_id, msg.payload);
    trackWsMessage("bot", "node_metrics", ws.data.source);
    updateNodeBandwidth(payload);
    broadcastNodeBandwidth({ ts: Date.now(), kind: "node_bandwidth", source: ws.data.source, payload });
    return;
  }

  // A broadcast without a target user or type can't be routed or mirrored.
  const parsed = botBroadcastMessageSchema.safeParse(json);
  if (!parsed.success) return drop(ws, "malformed_json");
  routeBotBroadcast(parsed.data, ws.data.source);
}
