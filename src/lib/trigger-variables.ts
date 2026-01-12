/**
 * Trigger Variables Registry
 * 
 * Defines available template variables for each Twitch event trigger type.
 * These variables can be used in action metadata fields using ${variable_name} syntax.
 */

export interface TriggerVariable {
  name: string;
  description: string;
  example: string;
  type: "string" | "number" | "boolean" | "date";
}

export interface TriggerVariables {
  label: string;
  description: string;
  variables: TriggerVariable[];
}

/**
 * Available variables for each trigger event type
 */
export const TRIGGER_VARIABLES: Record<string, TriggerVariables> = {
  "channel.follow": {
    label: "Channel Follow",
    description: "Variables available when someone follows the channel",
    variables: [
      {
        name: "user_id",
        description: "The user's Twitch ID",
        example: "12345678",
        type: "string",
      },
      {
        name: "user_login",
        description: "The user's login name (lowercase)",
        example: "coolviewer",
        type: "string",
      },
      {
        name: "user_name",
        description: "The user's display name",
        example: "CoolViewer",
        type: "string",
      },
      {
        name: "followed_at",
        description: "Timestamp when the follow occurred",
        example: "2024-01-15T10:30:00Z",
        type: "date",
      },
    ],
  },

  "channel.subscribe": {
    label: "Channel Subscribe",
    description: "Variables available when someone subscribes",
    variables: [
      {
        name: "user_id",
        description: "The subscriber's Twitch ID",
        example: "12345678",
        type: "string",
      },
      {
        name: "user_login",
        description: "The subscriber's login name (lowercase)",
        example: "coolviewer",
        type: "string",
      },
      {
        name: "user_name",
        description: "The subscriber's display name",
        example: "CoolViewer",
        type: "string",
      },
      {
        name: "tier",
        description: "Subscription tier (1000, 2000, 3000, or prime)",
        example: "1000",
        type: "string",
      },
      {
        name: "is_gift",
        description: "Whether the subscription was gifted",
        example: "false",
        type: "boolean",
      },
    ],
  },

  "channel.subscription.gift": {
    label: "Subscription Gift",
    description: "Variables available when someone gifts subscriptions",
    variables: [
      {
        name: "user_id",
        description: "The gifter's Twitch ID",
        example: "12345678",
        type: "string",
      },
      {
        name: "user_login",
        description: "The gifter's login name (lowercase)",
        example: "generousviewer",
        type: "string",
      },
      {
        name: "user_name",
        description: "The gifter's display name",
        example: "GenerousViewer",
        type: "string",
      },
      {
        name: "total",
        description: "Total number of subscriptions gifted",
        example: "5",
        type: "number",
      },
      {
        name: "tier",
        description: "Subscription tier (1000, 2000, or 3000)",
        example: "1000",
        type: "string",
      },
      {
        name: "cumulative_total",
        description: "Total subscriptions gifted in channel (all time)",
        example: "42",
        type: "number",
      },
      {
        name: "is_anonymous",
        description: "Whether the gift was anonymous",
        example: "false",
        type: "boolean",
      },
    ],
  },

  "channel.subscription.message": {
    label: "Subscription Message",
    description: "Variables available when a subscriber sends a resub message",
    variables: [
      {
        name: "user_id",
        description: "The subscriber's Twitch ID",
        example: "12345678",
        type: "string",
      },
      {
        name: "user_login",
        description: "The subscriber's login name (lowercase)",
        example: "loyalviewer",
        type: "string",
      },
      {
        name: "user_name",
        description: "The subscriber's display name",
        example: "LoyalViewer",
        type: "string",
      },
      {
        name: "tier",
        description: "Subscription tier (1000, 2000, 3000, or prime)",
        example: "1000",
        type: "string",
      },
      {
        name: "message_text",
        description: "The resub message text",
        example: "Love the stream!",
        type: "string",
      },
      {
        name: "cumulative_months",
        description: "Total months subscribed",
        example: "12",
        type: "number",
      },
      {
        name: "streak_months",
        description: "Consecutive months subscribed",
        example: "6",
        type: "number",
      },
      {
        name: "duration_months",
        description: "Number of months in current sub",
        example: "1",
        type: "number",
      },
    ],
  },

  "channel.raid": {
    label: "Channel Raid",
    description: "Variables available when someone raids the channel",
    variables: [
      {
        name: "from_broadcaster_user_id",
        description: "The raiding broadcaster's Twitch ID",
        example: "12345678",
        type: "string",
      },
      {
        name: "from_broadcaster_user_login",
        description: "The raiding broadcaster's login name (lowercase)",
        example: "coolstreamer",
        type: "string",
      },
      {
        name: "from_broadcaster_user_name",
        description: "The raiding broadcaster's display name",
        example: "CoolStreamer",
        type: "string",
      },
      {
        name: "viewers",
        description: "Number of viewers in the raid",
        example: "150",
        type: "number",
      },
    ],
  },

  "channel.cheer": {
    label: "Channel Cheer",
    description: "Variables available when someone cheers with bits",
    variables: [
      {
        name: "is_anonymous",
        description: "Whether the cheer was anonymous",
        example: "false",
        type: "boolean",
      },
      {
        name: "user_id",
        description: "The cheerer's Twitch ID (null if anonymous)",
        example: "12345678",
        type: "string",
      },
      {
        name: "user_login",
        description: "The cheerer's login name (null if anonymous)",
        example: "supportiveviewer",
        type: "string",
      },
      {
        name: "user_name",
        description: "The cheerer's display name (null if anonymous)",
        example: "SupportiveViewer",
        type: "string",
      },
      {
        name: "message",
        description: "The cheer message",
        example: "Great stream! Cheer100",
        type: "string",
      },
      {
        name: "bits",
        description: "Number of bits cheered",
        example: "100",
        type: "number",
      },
    ],
  },

  "channel.channel_points_custom_reward_redemption.add": {
    label: "Channel Points Redemption",
    description: "Variables available when channel points are redeemed",
    variables: [
      {
        name: "id",
        description: "The redemption ID",
        example: "abc123-def456",
        type: "string",
      },
      {
        name: "user_id",
        description: "The user's Twitch ID",
        example: "12345678",
        type: "string",
      },
      {
        name: "user_login",
        description: "The user's login name (lowercase)",
        example: "redeemer",
        type: "string",
      },
      {
        name: "user_name",
        description: "The user's display name",
        example: "Redeemer",
        type: "string",
      },
      {
        name: "user_input",
        description: "User input text (if required by reward)",
        example: "Hello streamer!",
        type: "string",
      },
      {
        name: "status",
        description: "Redemption status",
        example: "unfulfilled",
        type: "string",
      },
      {
        name: "reward_id",
        description: "The reward's ID",
        example: "reward-123",
        type: "string",
      },
      {
        name: "reward_title",
        description: "The reward's title",
        example: "VIP for a Day",
        type: "string",
      },
      {
        name: "reward_cost",
        description: "The reward's cost in channel points",
        example: "10000",
        type: "number",
      },
      {
        name: "reward_prompt",
        description: "The reward's description/prompt",
        example: "Get VIP status for 24 hours",
        type: "string",
      },
      {
        name: "redeemed_at",
        description: "Timestamp when redeemed",
        example: "2024-01-15T10:30:00Z",
        type: "date",
      },
    ],
  },
};

/**
 * Get variables for a specific trigger event type
 */
export function getVariablesForTrigger(eventType: string): TriggerVariables | null {
  return TRIGGER_VARIABLES[eventType] || null;
}

/**
 * Get all variable names for a specific trigger (for validation)
 */
export function getVariableNames(eventType: string): string[] {
  const triggerVars = getVariablesForTrigger(eventType);
  return triggerVars ? triggerVars.variables.map((v) => v.name) : [];
}

/**
 * Format a variable for use in templates
 */
export function formatVariable(variableName: string): string {
  return `\${${variableName}}`;
}
