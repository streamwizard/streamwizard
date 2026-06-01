"use client";

import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { MonitorSnapshot } from "@/lib/monitor-ws";

const SERVER_NODE_ID = "server";
const BOT_NODE_ID = "bot";
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const CONN_NODE_WIDTH = 120;
const CONN_NODE_HEIGHT = 60;

interface LayoutOptions {
  expanded: boolean;
}

export function useTopologyLayout(
  snapshot: MonitorSnapshot | null,
  options: LayoutOptions
) {
  return useMemo(() => {
    if (!snapshot) return { nodes: [] as Node[], edges: [] as Edge[] };

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 60 });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    g.setNode(SERVER_NODE_ID, { width: NODE_WIDTH, height: NODE_HEIGHT });
    nodes.push({
      id: SERVER_NODE_ID,
      type: "serverNode",
      position: { x: 0, y: 0 },
      data: {
        totalConnections: snapshot.totalConnections,
        roomCount: snapshot.rooms.length,
      },
    });

    g.setNode(BOT_NODE_ID, { width: NODE_WIDTH, height: NODE_HEIGHT });
    nodes.push({
      id: BOT_NODE_ID,
      type: "botNode",
      position: { x: 0, y: 0 },
      data: {
        connected: snapshot.bot.connected,
        connId: snapshot.bot.connId,
        connectedAt: snapshot.bot.connectedAt,
      },
    });
    edges.push({
      id: `e-bot-server`,
      source: BOT_NODE_ID,
      target: SERVER_NODE_ID,
      type: "animatedEdge",
      style: { stroke: "#a855f7", strokeWidth: 1.5 },
      data: { dotColor: "#a855f7" },
    });
    g.setEdge(BOT_NODE_ID, SERVER_NODE_ID);

    for (const room of snapshot.rooms) {
      const roomNodeId = `room-${room.roomId}`;

      g.setNode(roomNodeId, { width: NODE_WIDTH, height: NODE_HEIGHT });
      nodes.push({
        id: roomNodeId,
        type: "roomNode",
        position: { x: 0, y: 0 },
        data: {
          roomId: room.roomId,
          hasPublisher: room.hasPublisher,
          subscriberCount: room.subscriberCount,
          streamId: room.streamId,
          isAnimating: false,
        },
      });

      edges.push({
        id: `e-server-${roomNodeId}`,
        source: SERVER_NODE_ID,
        target: roomNodeId,
        type: "animatedEdge",
        style: { stroke: "#a1a1aa", strokeWidth: 1.5 },
        data: { dotColor: "#4ade80" },
      });

      if (options.expanded && room.connections) {
        for (const conn of room.connections) {
          const connNodeId = `conn-${room.roomId}-${conn.connId}`;

          g.setNode(connNodeId, { width: CONN_NODE_WIDTH, height: CONN_NODE_HEIGHT });
          nodes.push({
            id: connNodeId,
            type: "connectionNode",
            position: { x: 0, y: 0 },
            data: {
              connId: conn.connId,
              role: conn.role,
              connectedAt: conn.connectedAt,
              channels: conn.channels,
            },
          });

          const connColor = conn.role === "publisher" ? "#60a5fa" : "#4ade80";
          edges.push({
            id: `e-${roomNodeId}-${connNodeId}`,
            source: roomNodeId,
            target: connNodeId,
            type: "animatedEdge",
            style: { stroke: connColor, strokeWidth: 1.5 },
            data: { dotColor: connColor },
          });

          g.setEdge(roomNodeId, connNodeId);
        }
      }

      g.setEdge(SERVER_NODE_ID, roomNodeId);
    }

    dagre.layout(g);

    for (const node of nodes) {
      const nodeInfo = g.node(node.id);
      if (nodeInfo) {
        node.position = { x: nodeInfo.x - nodeInfo.width / 2, y: nodeInfo.y - nodeInfo.height / 2 };
      }
    }

    return { nodes, edges };
  }, [snapshot, options.expanded]);
}
