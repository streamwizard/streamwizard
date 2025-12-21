import { z } from "zod";

/**
 * Action Types Registry
 * Add new action types here to make them available in the system
 */
export const ACTION_TYPES = {
  SEND_MESSAGE: "send_message",
  PLAY_SOUND: "play_sound",
  EXECUTE_COMMAND: "execute_command",
  TRIGGER_WEBHOOK: "trigger_webhook",
  UPDATE_VARIABLE: "update_variable",
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

/**
 * Metadata schemas for each action type
 * Define the structure of metadata for each action
 */

// Send Message Action Metadata
const sendMessageMetadataSchema = z.object({
  message: z.string().min(1, "Message is required").max(500, "Message must be 500 characters or less"),
  channel: z.string().optional(),
  delay: z.number().int().min(0).max(3600).optional(),
});

// Play Sound Action Metadata
const playSoundMetadataSchema = z.object({
  soundUrl: z.string().url("Must be a valid URL"),
  volume: z.number().min(0).max(100).default(50),
  duration: z.number().int().min(0).max(60).optional(),
});

// Execute Command Action Metadata
const executeCommandMetadataSchema = z.object({
  command: z.string().min(1, "Command is required"),
  arguments: z.string().optional(),
  timeout: z.number().int().min(0).max(300).optional(),
});

// Trigger Webhook Action Metadata
const triggerWebhookMetadataSchema = z.object({
  webhookUrl: z.string().url("Must be a valid URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headers: z.string().optional(), // JSON string
  body: z.string().optional(), // JSON string
});

// Update Variable Action Metadata
const updateVariableMetadataSchema = z.object({
  variableName: z.string().min(1, "Variable name is required"),
  value: z.string(),
  operation: z.enum(["set", "increment", "decrement", "append"]).default("set"),
});

/**
 * Metadata schemas map
 * Maps action types to their metadata schemas
 */
export const METADATA_SCHEMAS: Record<ActionType, z.ZodSchema> = {
  [ACTION_TYPES.SEND_MESSAGE]: sendMessageMetadataSchema,
  [ACTION_TYPES.PLAY_SOUND]: playSoundMetadataSchema,
  [ACTION_TYPES.EXECUTE_COMMAND]: executeCommandMetadataSchema,
  [ACTION_TYPES.TRIGGER_WEBHOOK]: triggerWebhookMetadataSchema,
  [ACTION_TYPES.UPDATE_VARIABLE]: updateVariableMetadataSchema,
};

/**
 * TypeScript types for metadata
 */
export type SendMessageMetadata = z.infer<typeof sendMessageMetadataSchema>;
export type PlaySoundMetadata = z.infer<typeof playSoundMetadataSchema>;
export type ExecuteCommandMetadata = z.infer<typeof executeCommandMetadataSchema>;
export type TriggerWebhookMetadata = z.infer<typeof triggerWebhookMetadataSchema>;
export type UpdateVariableMetadata = z.infer<typeof updateVariableMetadataSchema>;

export type ActionMetadata =
  | SendMessageMetadata
  | PlaySoundMetadata
  | ExecuteCommandMetadata
  | TriggerWebhookMetadata
  | UpdateVariableMetadata;

/**
 * Action type display names and descriptions
 */
export const ACTION_TYPE_INFO: Record<
  ActionType,
  {
    label: string;
    description: string;
  }
> = {
  [ACTION_TYPES.SEND_MESSAGE]: {
    label: "Send Message",
    description: "Send a message to chat or a specific channel",
  },
  [ACTION_TYPES.PLAY_SOUND]: {
    label: "Play Sound",
    description: "Play a sound effect or audio file",
  },
  [ACTION_TYPES.EXECUTE_COMMAND]: {
    label: "Execute Command",
    description: "Run a system command or script",
  },
  [ACTION_TYPES.TRIGGER_WEBHOOK]: {
    label: "Trigger Webhook",
    description: "Send an HTTP request to a webhook URL",
  },
  [ACTION_TYPES.UPDATE_VARIABLE]: {
    label: "Update Variable",
    description: "Update a variable or counter",
  },
};

/**
 * Helper function to get metadata schema for an action type
 */
export function getMetadataSchema(actionType: ActionType): z.ZodSchema {
  return METADATA_SCHEMAS[actionType];
}

/**
 * Helper function to validate metadata for an action type
 */
export function validateMetadata(actionType: ActionType, metadata: unknown): boolean {
  const schema = getMetadataSchema(actionType);
  const result = schema.safeParse(metadata);
  return result.success;
}

/**
 * Helper function to get default metadata for an action type
 */
export function getDefaultMetadata(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
    case ACTION_TYPES.SEND_MESSAGE:
      return { message: "", channel: "", delay: 0 };
    case ACTION_TYPES.PLAY_SOUND:
      return { soundUrl: "", volume: 50, duration: 0 };
    case ACTION_TYPES.EXECUTE_COMMAND:
      return { command: "", arguments: "", timeout: 30 };
    case ACTION_TYPES.TRIGGER_WEBHOOK:
      return { webhookUrl: "", method: "POST", headers: "", body: "" };
    case ACTION_TYPES.UPDATE_VARIABLE:
      return { variableName: "", value: "", operation: "set" };
    default:
      return {};
  }
}


