import CustomRewardUpdate from "@/components/workflows/custom-settings/actions/custom_reward_update";
import SendChatMessage from "@/components/workflows/custom-settings/actions/send_chat_message";
import DefaultSettings from "@/components/workflows/custom-settings/default";
import ChannelpointsCustomRewardRedemptionAddSettings from "@/components/workflows/custom-settings/triggers/channel.channel_points_custom_reward_redemption.add";
import { EditorCanvasDefaultCardType } from "@/types/workflow";

export const EditorCanvasDefaultCard: EditorCanvasDefaultCardType = {
  Twitch: {
    Actions: [
      {
        id: "",
        title: "Update channelpoint details",
        description: "Updates a custom reward.",
        type: "custom_reward_update",
        nodeType: "Action",
        metaData: {
          reward_id: "",
          cost: "",
        },
      },
      {
        id: "",
        title: "Send Chat Message",
        description: "Sends a message to the broadcaster's chat room.",
        type: "send_chat_message",
        nodeType: "Action",
        metaData: {
          message: "Hello from StreamWizard 🧙",
        },
      },
    ],

    Triggers: [
      {
        id: "",
        title: "Channel Points Custom Reward Redemption Add",
        description: "A viewer has redeemed a custom channel points reward on the specified channel.",
        type: "channel.channel_points_custom_reward_redemption.add",
        nodeType: "Trigger",
        event_id: null,
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
  custom_reward_update: CustomRewardUpdate,
  send_chat_message: SendChatMessage,
  "default-settings": DefaultSettings,
};
