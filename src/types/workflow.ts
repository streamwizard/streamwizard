import { ConnectionProviderProps } from "@/providers/connections-provider";
import { Node } from "@xyflow/react";
import React from "react";
import { z } from "zod";

export const EditUserProfileSchema = z.object({
  email: z.string().email("Required"),
  name: z.string().min(1, "Required"),
});

export const WorkflowFormSchema = z.object({
  name: z.string().min(1, "Required"),
  description: z.string().min(1, "Required"),
});

export type ConnectionTypes = "Twitch" | "Discord";

export type Connection = {
  title: ConnectionTypes;
  description: string;
  image: string;
  connectionKey: keyof ConnectionProviderProps;
  accessTokenKey?: string;
  alwaysTrue?: boolean;
  slackSpecial?: boolean;
};

export type EditorCanvasCardType = {
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
  metadata: any;
  type: TwitchTriggersTypes | Actions;
};

export type EditorNodeType = {
  id: string;
  type: EditorCanvasCardType["type"];
  position: {
    x: number;
    y: number;
  };
  data: EditorCanvasCardType;
};

export type EditorNode = EditorNodeType;

export type EditorActions =
  | {
      type: "LOAD_DATA";
      payload: {
        nodes: Node[];
        edges: {
          id: string;
          source: string;
          target: string;
        }[];
      };
    }
  | {
      type: "UPDATE_NODE";
      payload: {
        nodes: Node[];
      };
    }
  | { type: "REDO" }
  | { type: "UNDO" }
  | {
      type: "SELECTED_NODE";
      payload: {
        node: Node;
      };
    } | {
      type: "UPDATE_METADATA";
      payload: {
        id: string;
        metadata: Metadata
      };
    }

export const nodeMapper: Record<string, string> = {
  Notion: "notionNode",
  Slack: "slackNode",
  Discord: "discordNode",
  "Google Drive": "googleNode",
};

type Metadata = Record<string, any>;

type TwitchTriggersTypes = "channel.channel_points_custom_reward_redemption.add";
type TwitchActionsTypes = "custom_reward_update" | "send_chat_message";

type Actions = TwitchActionsTypes;
type Triggers = TwitchTriggersTypes;

export type EditorCanvasDefaultCardType = {
  [provider: string]: {
    Actions: Action[];
    Triggers: Trigger[];
  };
};

type NodeTypes = "Action" | "Trigger";
type NodeCards = "DefaultAction" | "DefaultTrigger";

export type Trigger = {
  title: string;
  description: string;
  type: Triggers;
  nodeType: NodeTypes;
  nodeCard: NodeCards;
  metaData?: Metadata;
  settingsComponent?: React.FC
};

export type Action = {
  title: string;
  description: string;
  type: Actions;
  nodeType: NodeTypes;  
  nodeCard: NodeCards;
  metaData?: Metadata;
};
