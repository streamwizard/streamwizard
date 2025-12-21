import { z } from "zod";

/**
 * Action Categories - Top level groupings
 */
export const ACTION_CATEGORIES = {
  JUMPSCARES: "jumpscares",
  SOUNDS: "sounds",
  MESSAGES: "messages",
  WEBHOOKS: "webhooks",
  COMMANDS: "commands",
  VARIABLES: "variables",
} as const;

export type ActionCategory = (typeof ACTION_CATEGORIES)[keyof typeof ACTION_CATEGORIES];

/**
 * Category Information
 */
export const CATEGORY_INFO: Record<
  ActionCategory,
  {
    label: string;
    description: string;
    icon?: string;
  }
> = {
  [ACTION_CATEGORIES.JUMPSCARES]: {
    label: "Jumpscares",
    description: "Trigger jumpscare effects on screen",
    icon: "👻",
  },
  [ACTION_CATEGORIES.SOUNDS]: {
    label: "Sounds",
    description: "Play sound effects or audio files",
    icon: "🔊",
  },
  [ACTION_CATEGORIES.MESSAGES]: {
    label: "Messages",
    description: "Send messages to chat or channels",
    icon: "💬",
  },
  [ACTION_CATEGORIES.WEBHOOKS]: {
    label: "Webhooks",
    description: "Trigger external webhooks",
    icon: "🔗",
  },
  [ACTION_CATEGORIES.COMMANDS]: {
    label: "Commands",
    description: "Execute system commands",
    icon: "⚙️",
  },
  [ACTION_CATEGORIES.VARIABLES]: {
    label: "Variables",
    description: "Update variables and counters",
    icon: "📊",
  },
};

/**
 * Event Definition
 */
export interface ActionEvent {
  id: string;
  label: string;
  description: string;
  metadataSchema: z.ZodSchema;
  defaultMetadata: Record<string, unknown>;
}

/**
 * Jumpscare Events
 */
const JUMPSCARE_EVENTS: Record<string, ActionEvent> = {
  WELCOME_HOME: {
    id: "welcome_home",
    label: "Welcome Home",
    description: "Welcome home jumpscare effect",
    metadataSchema: z.object({
      duration: z.number().int().min(100).max(10000).default(3000),
      intensity: z.enum(["low", "medium", "high"]).default("medium"),
      soundEnabled: z.boolean().default(true),
      imageUrl: z.string().optional().default(""),
    }),
    defaultMetadata: {
      duration: 3000,
      intensity: "medium",
      soundEnabled: true,
      imageUrl: "",
    },
  },
  FREDDY_FAZBEAR: {
    id: "freddy_fazbear",
    label: "Freddy Fazbear",
    description: "Five Nights at Freddy's jumpscare",
    metadataSchema: z.object({
      duration: z.number().int().min(100).max(10000).default(2000),
      soundEnabled: z.boolean().default(true),
      screenShake: z.boolean().default(true),
    }),
    defaultMetadata: {
      duration: 2000,
      soundEnabled: true,
      screenShake: true,
    },
  },
  CUSTOM: {
    id: "custom_jumpscare",
    label: "Custom Jumpscare",
    description: "Create a custom jumpscare",
    metadataSchema: z.object({
      imageUrl: z.string().min(1, "Image URL is required").url("Must be a valid URL"),
      soundUrl: z.string().url("Must be a valid URL").optional().default(""),
      duration: z.number().int().min(100).max(10000).default(3000),
      intensity: z.enum(["low", "medium", "high"]).default("medium"),
      screenShake: z.boolean().default(false),
    }),
    defaultMetadata: {
      imageUrl: "",
      soundUrl: "",
      duration: 3000,
      intensity: "medium",
      screenShake: false,
    },
  },
};

/**
 * Sound Events
 */
const SOUND_EVENTS: Record<string, ActionEvent> = {
  PLAY_AUDIO: {
    id: "play_audio",
    label: "Play Audio File",
    description: "Play a sound effect or audio file",
    metadataSchema: z.object({
      audioUrl: z.string().min(1, "Audio URL is required").url("Must be a valid URL"),
      volume: z.number().min(0).max(100).default(50),
      loop: z.boolean().default(false),
      fadeIn: z.number().int().min(0).max(5000).default(0),
      fadeOut: z.number().int().min(0).max(5000).default(0),
    }),
    defaultMetadata: {
      audioUrl: "",
      volume: 50,
      loop: false,
      fadeIn: 0,
      fadeOut: 0,
    },
  },
  TEXT_TO_SPEECH: {
    id: "text_to_speech",
    label: "Text to Speech",
    description: "Convert text to speech and play it",
    metadataSchema: z.object({
      text: z.string().min(1, "Text is required").max(500),
      voice: z.enum(["male", "female", "robot"]).default("female"),
      speed: z.number().min(0.5).max(2).default(1),
      volume: z.number().min(0).max(100).default(50),
    }),
    defaultMetadata: {
      text: "",
      voice: "female",
      speed: 1,
      volume: 50,
    },
  },
};

/**
 * Message Events
 */
const MESSAGE_EVENTS: Record<string, ActionEvent> = {
  SEND_CHAT_MESSAGE: {
    id: "send_chat_message",
    label: "Send Chat Message",
    description: "Send a message to Twitch chat",
    metadataSchema: z.object({
      message: z.string().min(1, "Message is required").max(500),
      delay: z.number().int().min(0).max(3600).default(0),
      replyToRedemption: z.boolean().default(false),
    }),
    defaultMetadata: {
      message: "",
      delay: 0,
      replyToRedemption: false,
    },
  },
  ANNOUNCEMENT: {
    id: "announcement",
    label: "Send Announcement",
    description: "Send a highlighted announcement",
    metadataSchema: z.object({
      message: z.string().min(1, "Message is required").max(500),
      color: z.enum(["blue", "green", "orange", "purple"]).default("purple"),
    }),
    defaultMetadata: {
      message: "",
      color: "purple",
    },
  },
};

/**
 * Webhook Events
 */
const WEBHOOK_EVENTS: Record<string, ActionEvent> = {
  TRIGGER_WEBHOOK: {
    id: "trigger_webhook",
    label: "Trigger Webhook",
    description: "Send an HTTP request to a webhook",
    metadataSchema: z.object({
      webhookUrl: z.string().min(1, "Webhook URL is required").url("Must be a valid URL"),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
      headers: z.string().optional().default(""),
      body: z.string().optional().default(""),
    }),
    defaultMetadata: {
      webhookUrl: "",
      method: "POST",
      headers: "",
      body: "",
    },
  },
};

/**
 * Command Events
 */
const COMMAND_EVENTS: Record<string, ActionEvent> = {
  EXECUTE_COMMAND: {
    id: "execute_command",
    label: "Execute Command",
    description: "Run a system command or script",
    metadataSchema: z.object({
      command: z.string().min(1, "Command is required"),
      arguments: z.string().optional().default(""),
      timeout: z.number().int().min(0).max(300).default(30),
      runAsAdmin: z.boolean().default(false),
    }),
    defaultMetadata: {
      command: "",
      arguments: "",
      timeout: 30,
      runAsAdmin: false,
    },
  },
};

/**
 * Variable Events
 */
const VARIABLE_EVENTS: Record<string, ActionEvent> = {
  UPDATE_VARIABLE: {
    id: "update_variable",
    label: "Update Variable",
    description: "Update a variable or counter",
    metadataSchema: z.object({
      variableName: z.string().min(1, "Variable name is required"),
      value: z.string(),
      operation: z.enum(["set", "increment", "decrement", "append"]).default("set"),
    }),
    defaultMetadata: {
      variableName: "",
      value: "",
      operation: "set",
    },
  },
};

/**
 * Events Registry - Maps categories to their events
 */
export const EVENTS_REGISTRY: Record<ActionCategory, Record<string, ActionEvent>> = {
  [ACTION_CATEGORIES.JUMPSCARES]: JUMPSCARE_EVENTS,
  [ACTION_CATEGORIES.SOUNDS]: SOUND_EVENTS,
  [ACTION_CATEGORIES.MESSAGES]: MESSAGE_EVENTS,
  [ACTION_CATEGORIES.WEBHOOKS]: WEBHOOK_EVENTS,
  [ACTION_CATEGORIES.COMMANDS]: COMMAND_EVENTS,
  [ACTION_CATEGORIES.VARIABLES]: VARIABLE_EVENTS,
};

/**
 * Helper Functions
 */

export function getEventsForCategory(category: ActionCategory): ActionEvent[] {
  return Object.values(EVENTS_REGISTRY[category] || {});
}

export function getEvent(category: ActionCategory, eventId: string): ActionEvent | undefined {
  return EVENTS_REGISTRY[category]?.[eventId.toUpperCase().replace(/-/g, "_")];
}

export function getEventById(eventId: string): ActionEvent | undefined {
  for (const events of Object.values(EVENTS_REGISTRY)) {
    const event = Object.values(events).find((e) => e.id === eventId);
    if (event) return event;
  }
  return undefined;
}

export function getMetadataSchema(category: ActionCategory, eventId: string): z.ZodSchema {
  const event = getEvent(category, eventId);
  return event?.metadataSchema || z.object({});
}

export function getDefaultMetadata(category: ActionCategory, eventId: string): Record<string, unknown> {
  const event = getEvent(category, eventId);
  return event?.defaultMetadata || {};
}

export function validateMetadata(category: ActionCategory, eventId: string, metadata: unknown): boolean {
  const schema = getMetadataSchema(category, eventId);
  const result = schema.safeParse(metadata);
  return result.success;
}

/**
 * Format action string for storage: "category:event"
 */
export function formatActionString(category: ActionCategory, eventId: string): string {
  return `${category}:${eventId}`;
}

/**
 * Parse action string from storage: "category:event"
 */
export function parseActionString(actionString: string): { category: ActionCategory; eventId: string } | null {
  const parts = actionString.split(":");
  if (parts.length !== 2) return null;
  return {
    category: parts[0] as ActionCategory,
    eventId: parts[1],
  };
}

