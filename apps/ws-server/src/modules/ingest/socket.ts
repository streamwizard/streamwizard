import { reportError } from "@repo/sentry";
import { trackWsMessage, trackWsMessageDrop } from "@repo/metrics";
import { warnOnce } from "@/lib/warn-once";
import { addBotSocket, broadcastNodeBandwidth } from "@/modules/monitor";
import { routeBotBroadcast } from "@/modules/broadcast/route-broadcast";
import type { ConnectionData, ServerWebSocket } from "@/types";
import { updateNodeBandwidth } from "./bandwidth";
import { ingestSessions } from "./sessions";
import { nodeBandwidthFrom, parseIngestNodeMessage, resolveIngestStats } from "./messages";

// role=ingest-node: pings, the node's NIC throughput and live session stats.
// The node id comes from the socket's token (ws.data.ingestNodeId), never from
// the message. Frames are parsed against @repo/schemas/ws-server; a bad one
// is dropped, counted, and logged once per kind.
export function handleIngestNodeMessage(ws: ServerWebSocket<ConnectionData>, rawStr: string): void {
  addBotSocket(ws);
  const nodeId = ws.data.ingestNodeId;
  if (!nodeId) {
    trackWsMessageDrop("bot", "malformed_json");
    return;
  }
  const parsed = parseIngestNodeMessage(rawStr);
  if (!parsed.ok) {
    trackWsMessageDrop("bot", parsed.reason);
    warnOnce(`ingest-node:${parsed.reason}`, `[ingest-node] dropped a frame (${parsed.reason}) source=${ws.data.source ?? "unknown"}`);
    return;
  }
  const msg = parsed.msg;

  if (msg.kind === "ping") {
    ws.send(JSON.stringify({ kind: "pong", ts: msg.ts }));
    return;
  }

  if (msg.kind === "node_metrics") {
    const payload = nodeBandwidthFrom(nodeId, msg.payload);
    trackWsMessage("bot", "node_metrics", ws.data.source);
    updateNodeBandwidth(payload);
    broadcastNodeBandwidth({ ts: Date.now(), kind: "node_bandwidth", source: ws.data.source, payload });
    return;
  }

  // ingest_stats. Async (a session the registry doesn't know is looked up
  // once), so it can't throw into the caller's try/catch: report here instead.
  void resolveIngestStats(ingestSessions, nodeId, msg)
    .then((result) => {
      if (!result.ok) {
        trackWsMessageDrop("bot", result.reason);
        return;
      }
      routeBotBroadcast({ userId: result.userId, type: "streamwizard.ingest_stats", payload: result.payload }, ws.data.source);
    })
    .catch((err) => reportError(err, "ws.ingest_stats", { source: ws.data.source }));
}
