import { EditorCanvasDefaultCardType } from "@/types/workflow";
import ChannelpointsCustomRewardRedemptionAddSettings from "../editor/[editorId]/_components/custom-settings/channel.channel_points_custom_reward_redemption.add";
import DefaultSettings from "../editor/[editorId]/_components/custom-settings/default";

export const EditorCanvasDefaultCard: EditorCanvasDefaultCardType = {
  Twitch: {
    Actions: [
      {
        title: "Update channelpoint details",
        description: "Updates a custom reward.",
        type: "custom_reward_update",
        nodeCard: "DefaultAction",
        nodeType: "Action",
      },
      {
        title: "Send Chat Message",
        description: "Sends a message to the broadcaster's chat room.",
        type: "send_chat_message",
        nodeCard: "DefaultAction",
        nodeType: "Action",
        metaData: {
          message: "Hello from StreamWizard 🧙",
        },
      },
    ],

    Triggers: [
      {
        title: "Channel Points Custom Reward Redemption Add",
        description: "A viewer has redeemed a custom channel points reward on the specified channel.",
        type: "channel.channel_points_custom_reward_redemption.add",
        nodeCard: "DefaultTrigger",
        nodeType: "Trigger",
      },
    ],
  },
  Discord: {
    Actions: [],
    Triggers: [],
  },
};



export const NodeSettingsComponent = {
  "channel.channel_points_custom_reward_redemption.add": ChannelpointsCustomRewardRedemptionAddSettings,

  "default-settings": DefaultSettings,
};