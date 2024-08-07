import { ConnectionProviderProps } from "@/providers/connections-provider";
import { Node } from "@xyflow/react";
import React from "react";

type TwitchTriggersTypes = "channel.channel_points_custom_reward_redemption.add";
type TwitchActionsTypes = "custom_reward_update" | "send_chat_message";

type Actions = TwitchActionsTypes | "none";
type Triggers = TwitchTriggersTypes | "none";

type NodeTypes = "Action" | "Trigger";
type NodeCards = "DefaultAction" | "DefaultTrigger";

export type Metadata = Record<string, any>;

export type WorkflowEditor = {
  nodes: EditorNodeType[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
  selectedNode: EditorNodeType | null;
};
export type EditorState = {
  editor: WorkflowEditor;
  history: HistoryState;
};

export type HistoryState = {
  history: WorkflowEditor[];
  currentIndex: number;
};

export type EditorCanvasCardType = {
  title: string;
  description: string;
  metadata: Metadata;
  type: Triggers | Actions;
};

export type EditorNodeType = {
  id: string;
  type: NodeTypes;
  position: {
    x: number;
    y: number;
  };
  data: Trigger | Action;
};

export type EditorActions =
  | { type: "LOAD_DATA"; payload: { nodes: EditorNodeType[]; edges: { id: string; source: string; target: string }[] } }
  | { type: "UPDATE_NODE"; payload: { nodes: EditorNodeType[] } }
  | { type: "REDO" }
  | { type: "UNDO" }
  | { type: "SELECTED_NODE"; payload: { id: string | null } }
  | { type: "UPDATE_METADATA"; payload: { id: string; metadata: Metadata } }
  | { type: "UPDATE_TRIGGER"; payload: { id: string; event_id: string } };


export type EditorCanvasDefaultCardType = {
  [provider: string]: {
    Actions: Action[];
    Triggers: Trigger[];
  };
};

export type Trigger = {
  id: string
  title: string;
  description: string;
  type: Triggers;
  event_id: string | null;
  nodeType: NodeTypes;
  metaData?: Metadata;
  settingsComponent?: React.FC;
};

export type Action = {
  id: string
  title: string;
  description: string;
  type: Actions;
  nodeType: NodeTypes;
  metaData?: Metadata;
};
