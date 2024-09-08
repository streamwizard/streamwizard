import { Action, EditorCanvasCardType, integrationTypes, NodeTypes, Trigger } from "@/types/workflow";
import type { Node } from "@xyflow/react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { EditorCanvasDefaultCard } from "./workflow-const";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function msToTime(duration: number) {
  var seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60);

  return minutes + ":" + seconds;
}

export function secondsToHoursMinutesSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${hours}:${minutes}`;
}

// create a function that converts seconds to minutes
export function secondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

export function capitalizeFirstLetter(inputString: string) {
  return inputString.replace(/\b\w/g, function (match) {
    return match.toUpperCase();
  });
}

export const onDragStart = (event: any, nodeType: EditorCanvasCardType["type"], catagory: string) => {
  event.dataTransfer.setData("application/reactflow", `${catagory}:${nodeType}`);
  event.dataTransfer.effectAllowed = "move";
};

type PlaceholderTypeKeysProps = {
  nodeType: NodeTypes;
  integration: string;
  integrationType: integrationTypes;
};

export function getNode({ integration, nodeType, integrationType }: PlaceholderTypeKeysProps): Trigger | Action | undefined {
  const providerData = EditorCanvasDefaultCard["twitch"];


  if (!providerData) {
    return undefined; // Handle case where the integration is not found
  }


  // Determine if we are dealing with actions or triggers based on nodeType
  const nodes = nodeType === "Trigger" ? providerData.triggers : providerData.actions;

  return nodes.find((node) => node.type === integrationType);
}

// check for missing twitch event subscriptions
export function TwitchEventSubscriptions(user_id: string) {
  return [
    {
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: user_id,
        user_id: user_id,
      },
    },
    {
      type: "channel.update",
      version: "2",
      condition: {
        broadcaster_user_id: user_id,
      },
    },
    {
      type: "channel.channel_points_custom_reward.update",
      version: "1",
      condition: {
        broadcaster_user_id: user_id,
        // reward_id: "9001", // optional to only get notifications for a specific reward
      },
    },

    {
      type: "channel.channel_points_custom_reward.remove",
      version: "1",
      condition: {
        broadcaster_user_id: user_id,
        // reward_id: "9001", // optional to only get notifications for a specific reward
      },
    },

    {
      type: "channel.channel_points_custom_reward_redemption.add",
      version: "1",
      condition: {
        broadcaster_user_id: user_id,
        // reward_id: "92af127c-7326-4483-a52b-b0da0be61c01", // optional; gets notifications for a specific reward
      },
    },
    {
      type: "channel.ad_break.begin",
      version: "1",
      condition: {
        broadcaster_user_id: user_id,
      },
    },
    {
      type: "channel.raid",
      version: "1",
      condition: {
        to_broadcaster_user_id: user_id,
      },
    },
    {
      type: "channel.shoutout.create",
      version: "1",
      condition: {
        broadcaster_user_id: user_id,
        moderator_user_id: user_id,
      },
    },
    {
      type: "channel.shoutout.receive",
      version: "1",
      condition: {
        broadcaster_user_id: user_id,
        moderator_user_id: user_id,
      },
    },
  ];
}
