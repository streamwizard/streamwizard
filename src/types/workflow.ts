import type { Connection, Edge, EdgeChange, Node, NodeChange } from "@xyflow/react";
import type React from "react";

type TwitchTriggersTypes = "channel.channel_points_custom_reward_redemption.add";
type TwitchActionsTypes = "custom_reward_update" | "send_chat_message";

type Actions = TwitchActionsTypes | "none";
type Triggers = TwitchTriggersTypes | "none";

type NodeTypes = "Action" | "Trigger";

export type Metadata = Record<string, string>;

export type WorkflowEditor = {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  parrentNodes: Node[] | null;
  sidebar: "triggers" | "actions" | "settings";
};
export type EditorState = {
  editor: WorkflowEditor;
  // history for in the future
};

export type EditorCanvasCardType = {
  title: string;
  description: string;
  metadata: Metadata;
  type: Triggers | Actions;
};

export type EditorActions =
  | { type: "LOAD_DATA"; payload: { nodes: Node[]; edges: Edge[] } }
  | { type: "UPDATE_NODE"; payload: { nodes: Node } }
  | { type: "SELECTED_NODE"; payload: { id: string | null } }
  | { type: "UPDATE_METADATA"; payload: { id: string; metadata: Metadata } }
  | { type: "UPDATE_NODES"; payload: { nodes: NodeChange<Node>[] } }
  | { type: "UPDATE_EDGES"; payload: { edges: EdgeChange[] } }
  | { type: "ON_CONNECT"; payload: { connection: Connection } }
  | { type: "ADD_NODE"; payload: { node: Node } }
  | { type: "SET_SIDEBAR"; payload: { sidebar: "triggers" | "actions" | "settings" } };

export type EditorCanvasDefaultCardType = {
  [provider: string]: {
    Actions: Action[];
    Triggers: Trigger[];
  };
};

export type Trigger = {
  id: string;
  title: string;
  description: string;
  type: Triggers;
  event_id: string | null;
  nodeType: NodeTypes;
  metaData?: Metadata;
  settingsComponent?: React.FC;
};

export type Action = {
  id: string;
  title: string;
  description: string;
  type: Actions;
  nodeType: NodeTypes;
  metaData?: Metadata;
};
