import CustomRewardUpdate from "@/components/workflows/custom-settings/actions/custom_reward_update";
import SendChatMessage from "@/components/workflows/custom-settings/actions/send_chat_message";
import DefaultSettings from "@/components/workflows/custom-settings/default";
import ChannelpointsCustomRewardRedemptionAddSettings from "@/components/workflows/custom-settings/triggers/channel.channel_points_custom_reward_redemption.add";
import { SendChatMessageMetaData } from "@/schemas/workflow-node-settings";
import { EditorCanvasDefaultCardType } from "@/types/workflow";
import { MdControlPoint, MdOutlineMessage } from "react-icons/md";
import { RiAdvertisementLine } from "react-icons/ri";
import { FaBullhorn } from "react-icons/fa";

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
        icon: MdControlPoint,
      },
      {
        id: "",
        title: "Get Ad Schedule",
        description: "This endpoint returns ad schedule related information, including snooze, when the last ad was run, when the next ad is scheduled, and if the channel is currently in pre-roll free time.",
        type: "get_ad_schedule",
        nodeType: "Action", 
        icon: RiAdvertisementLine,
      },
      {
        id: "",
        title: "Send Chat Message",
        description: "Sends a message to the broadcaster's chat room.",
        type: "send_chat_message",
        nodeType: "Action",
        metaData: {
          message: "Hello from StreamWizard 🧙",
          sender_id: "956066753",
        } as SendChatMessageMetaData,
        icon: MdOutlineMessage,
      },
      {
        id: "",
        title: "Send Chat Announcement",
        description: "Sends an announcement to the broadcaster’s chat room.",
        type: "send_chat_announcement",
        nodeType: "Action",
        metaData: {
          message: "Hello from StreamWizard 🧙",
          sender_id: "956066753",
        } as SendChatMessageMetaData,
        icon: FaBullhorn ,
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
        icon: MdControlPoint,
      },
      {
        id: "",
        title: "Ad break begin",
        description: "Triggers when a user runs a midroll commercial break, either manually or automatically via ads manager.",
        type: "channel.ad_break.begin",
        nodeType: "Trigger",
        event_id: null,
        icon: RiAdvertisementLine,
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
  "send_chat_announcement": SendChatMessage,
  "default-settings": DefaultSettings,
};
