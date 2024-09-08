"use client";
import CustomRewardUpdate from "@/components/workflows/custom-settings/actions/custom_reward_update";
import SendChatMessage from "@/components/workflows/custom-settings/actions/send_chat_message";
import DefaultSettings from "@/components/workflows/custom-settings/default";
import ChannelpointsCustomRewardRedemptionAddSettings from "@/components/workflows/custom-settings/triggers/channel.channel_points_custom_reward_redemption.add";
import { SendChatMessageMetaData } from "@/schemas/workflow-node-settings";
import { EditorCanvasDefaultCardType } from "@/types/workflow";
import { MdControlPoint, MdOutlineMessage } from "react-icons/md";
import { RiAdvertisementLine } from "react-icons/ri";
import { FaBullhorn } from "react-icons/fa";
import { FaParachuteBox } from "react-icons/fa6";

export const EditorCanvasDefaultCard: EditorCanvasDefaultCardType = {
  twitch: {
    actions: [
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
        placeholders: [
          "broadcaster_name",
          "broadcaster_login",
          "broadcaster_id",
          "id",
          "image",
          "background_color",
          "is_enabled",
          "cost",
          "title",
          "prompt",
          "is_user_input_required",
          "max_per_stream_setting.is_enabled",
          "max_per_stream_setting.max_per_stream",
          "max_per_user_per_stream_setting.is_enabled",
          "max_per_user_per_stream_setting.max_per_user_per_stream",
          "global_cooldown_setting.is_enabled",
          "global_cooldown_setting.global_cooldown_seconds",
          "is_paused",
          "is_in_stock",
          "default_image.url_1x",
          "default_image.url_2x",
          "default_image.url_4x",
          "should_redemptions_skip_request_queue",
          "redemptions_redeemed_current_stream",
          "cooldown_expires_at",
        ],
      },
      {
        id: "",
        title: "Get Ad Schedule",
        description:
          "This endpoint returns ad schedule related information, including snooze, when the last ad was run, when the next ad is scheduled, and if the channel is currently in pre-roll free time.",
        type: "get_ad_schedule",
        nodeType: "Action",
        icon: RiAdvertisementLine,
        placeholders: ["next_ad_at", "last_ad_at", "duration", "preroll_free_time", "snooze_count", "snooze_refresh_at"],
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
        placeholders: ["message_id", "is_sent", "drop_reason.code", "drop_reason.message"],
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
        icon: FaBullhorn,
      },
    ],

    triggers: [
      {
        id: "",
        title: "Channel Points Custom Reward Redemption Add",
        description: "A viewer has redeemed a custom channel points reward on the specified channel.",
        type: "channel.channel_points_custom_reward_redemption.add",
        nodeType: "Trigger",
        event_id: null,
        icon: MdControlPoint,
        placeholders: [
          "id",
          "broadcaster_user_id",
          "broadcaster_user_login",
          "broadcaster_user_name",
          "user_id",
          "user_login",
          "user_name",
          "user_input",
          "status",
          "reward.id",
          "reward.title",
          "reward.cost",
          "reward.prompt",
          "redeemed_at",
        ],
      },
      {
        id: "",
        title: "Ad break begin",
        description: "Triggerd when a user runs a midroll commercial break, either manually or automatically via ads manager.",
        type: "channel.ad_break.begin",
        nodeType: "Trigger",
        event_id: null,
        icon: RiAdvertisementLine,
        placeholders: [
          "duration_seconds",
          "started_at",
          "is_automatic",
          "broadcaster_user_id",
          "broadcaster_user_login",
          "broadcaster_user_name",
          "requester_user_id",
          "requester_user_login",
          "requester_user_name",
        ],
      },
      {
        id: "",
        title: "Channel Raid Notification",
        description: "Triggered when a broadcaster receives a raid from another broadcaster.",
        type: "channel.raid",
        nodeType: "Trigger",
        event_id: null,
        icon: FaParachuteBox,
        placeholders: [
          "from_broadcaster_user_id",
          "from_broadcaster_user_login",
          "from_broadcaster_user_name",
          "to_broadcaster_user_id",
          "to_broadcaster_user_login",
          "to_broadcaster_user_name",
          "viewers",
        ],
      },
    ],
  },
  discord: {
    actions: [],
    triggers: [],
  },
};

export const NodeSettingsComponent = {
  "channel.channel_points_custom_reward_redemption.add": ChannelpointsCustomRewardRedemptionAddSettings,
  custom_reward_update: CustomRewardUpdate,
  send_chat_message: SendChatMessage,
  send_chat_announcement: SendChatMessage,
  "default-settings": DefaultSettings,
};
