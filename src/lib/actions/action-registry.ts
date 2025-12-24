import { z } from "zod";

/**
 * Action Categories - Top level groupings
 */
export const ACTION_CATEGORIES = {
  JUMPSCARES: "jumpscares",
  DISASTERS: "disasters",
  EVENTS: "events",
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
    description: "Terrifying jumpscare effects that trigger on player actions",
    icon: "👻",
  },
  [ACTION_CATEGORIES.DISASTERS]: {
    label: "Disasters",
    description: "Catastrophic events that affect the world around the player",
    icon: "💥",
  },
  [ACTION_CATEGORIES.EVENTS]: {
    label: "Events",
    description: "Special events and celebrations",
    icon: "🎉",
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
  DOOR_SCARE: {
    id: "door_scare",
    label: "Door Scare",
    description: "A haunting presence awaits behind doors, causing terrifying manifestations upon interaction",
    metadataSchema: z.object({
      // No configurable metadata - uses default behavior
    }),
    defaultMetadata: {},
  },
  WELCOME_HOME: {
    id: "welcome_home",
    label: "Welcome Home",
    description: "Curses a player - the next door they open will reveal a terrifying Herobrine-like surprise",
    metadataSchema: z.object({
      // No configurable metadata - uses default behavior
    }),
    defaultMetadata: {},
  },
  ENDERMAN_JUMPSCARE: {
    id: "EndermanJumpscare",
    label: "Enderman Jumpscare",
    description: "Unleashes an absolutely terrifying Enderman experience with multiple endermen",
    metadataSchema: z.object({
      // No configurable metadata - uses default behavior
    }),
    defaultMetadata: {},
  },
  FIREWORKS: {
    id: "fireworks",
    label: "Fireworks Jumpscare",
    description: "A terrifying barrage of explosive fireworks around the player",
    metadataSchema: z.object({
      // No configurable metadata - uses default behavior
    }),
    defaultMetadata: {},
  },
  FAKE_DAMAGE: {
    id: "fake_damage",
    label: "Fake Damage",
    description: "Temporarily reduces the player's health to scare them (without dying)",
    metadataSchema: z.object({
      damageAmount: z.number().min(1).max(20).default(5),
      duration: z.number().int().min(10).max(200).default(100), // in ticks
    }),
    defaultMetadata: {
      damageAmount: 5,
      duration: 100,
    },
  },
  SPINNING_PLAYER: {
    id: "SpinningPlayer",
    label: "Spinning Player",
    description: "Spins the player around rapidly, disorienting them",
    metadataSchema: z.object({
      rotations: z.number().int().min(1).max(10).default(4),
      speed: z.number().int().min(1).max(10).default(2), // ticks between rotations
    }),
    defaultMetadata: {
      rotations: 4,
      speed: 2,
    },
  },
};

/**
 * Disaster Events
 */
const DISASTER_EVENTS: Record<string, ActionEvent> = {
  SUPERNOVA: {
    id: "supernova",
    label: "Supernova",
    description: "Creates a massive exploding star that destroys everything in its path",
    metadataSchema: z.object({
      level: z.number().int().min(1).max(10).default(1),
      sizeMultiplier: z.number().min(0.1).max(5.0).default(1.0),
      particleMultiplier: z.number().min(0.1).max(5.0).default(1.0),
      fallSpeedMultiplier: z.number().min(0.1).max(5.0).default(1.0),
      volume: z.number().min(0.0).max(2.0).default(1.0),
      farParticles: z.boolean().default(true),
    }),
    defaultMetadata: {
      level: 1,
      sizeMultiplier: 1.0,
      particleMultiplier: 1.0,
      fallSpeedMultiplier: 1.0,
      volume: 1.0,
      farParticles: true,
    },
  },
  WINDSTORM: {
    id: "windstorm",
    label: "Wind Storm",
    description: "Creates a customizable wind storm that follows the player and pushes nearby entities horizontally",
    metadataSchema: z.object({
      level: z.number().int().min(1).max(10).default(5),
      force: z.number().min(0.1).max(2.0).optional(),
      intensity: z.number().min(0.1).max(2.0).optional(),
      duration: z.number().int().min(1).max(60).default(15), // in seconds
      ticks: z.number().int().min(20).max(1200).optional(), // alternative to duration
      radius: z.number().min(5.0).max(50.0).default(20.0),
      range: z.number().min(5.0).max(50.0).optional(), // alternative to radius
      direction: z.enum(["north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest", "random"]).optional(),
      angle: z.number().min(0).max(360).optional(), // alternative to direction
      volume: z.number().min(0.0).max(2.0).default(1.0),
      particles: z.number().min(0.1).max(3.0).optional(),
      effects: z.enum(["minimal", "normal", "maximum"]).optional(),
      targets: z.string().optional(), // "players", "mobs", "all"
      excludeFlying: z.boolean().default(false),
      maxVelocity: z.number().min(0.5).max(5.0).default(2.0),
      distanceFalloff: z.boolean().default(true),
    }),
    defaultMetadata: {
      level: 5,
      duration: 15,
      radius: 20.0,
      volume: 1.0,
      excludeFlying: false,
      maxVelocity: 2.0,
      distanceFalloff: true,
    },
  },
};

/**
 * Event Events
 */
const EVENT_EVENTS: Record<string, ActionEvent> = {
  SPAWN_MOBS: {
    id: "random_mob_spawn",
    label: "Spawn Mobs",
    description: "Spawns random passive mobs with custom names around the player, which despawn after 5 minutes",
    metadataSchema: z.object({
      amount: z.number().int().min(1).max(1000).default(100),
      mobList: z.array(z.string()).min(1, "At least one mob type is required"),
      viewerList: z.array(z.string()).optional().default([]),
    }),
    defaultMetadata: {
      amount: 100,
      mobList: ["ZOMBIE"],
      viewerList: [],
    },
  },
  LAUNCH_PLAYER: {
    id: "launce",
    label: "Long Distance Launch",
    description: "Teleports the player 500 blocks with a launch effect (no fall damage)",
    metadataSchema: z.object({
      horizontalSpeed: z.number().min(1.0).max(20.0).default(10.2),
      verticalSpeed: z.number().min(0.5).max(10.0).default(2.5),
      distance: z.number().int().min(50).max(2000).default(500),
    }),
    defaultMetadata: {
      horizontalSpeed: 10.2,
      verticalSpeed: 2.5,
      distance: 500,
    },
  },
  TWITCH_SUBSCRIPTION: {
    id: "twitch_subscription",
    label: "Twitch Subscription Alert",
    description: "Celebration effect for Twitch subscriptions with fireworks, particles, and sounds",
    metadataSchema: z.object({
      subscriberName: z.string().min(1).max(100).default("Someone"),
      tier: z.enum(["1", "2", "3", "prime"]).default("1"),
      customTitle: z.string().max(100).optional(),
      customSubtitle: z.string().max(100).optional(),
      duration: z.number().int().min(1).max(10).default(5), // in seconds
      fireworks: z.number().int().min(1).max(15).default(3),
      intensity: z.enum(["low", "normal", "high", "extreme"]).default("normal"),
      customMessage: z.string().max(500).optional(),
      showChat: z.boolean().default(true),
      showTitle: z.boolean().default(true),
      broadcast: z.boolean().default(false),
      volume: z.number().min(0.0).max(2.0).default(1.0),
    }),
    defaultMetadata: {
      subscriberName: "Someone",
      tier: "1",
      duration: 5,
      fireworks: 3,
      intensity: "normal",
      showChat: true,
      showTitle: true,
      broadcast: false,
      volume: 1.0,
    },
  },
};

/**
 * Events Registry - Maps categories to their events
 */
export const EVENTS_REGISTRY: Record<ActionCategory, Record<string, ActionEvent>> = {
  [ACTION_CATEGORIES.JUMPSCARES]: JUMPSCARE_EVENTS,
  [ACTION_CATEGORIES.DISASTERS]: DISASTER_EVENTS,
  [ACTION_CATEGORIES.EVENTS]: EVENT_EVENTS,
};

/**
 * Helper Functions
 */

export function getEventsForCategory(category: ActionCategory): ActionEvent[] {
  return Object.values(EVENTS_REGISTRY[category] || {});
}

export function getEvent(category: ActionCategory, eventId: string): ActionEvent | undefined {
  const events = EVENTS_REGISTRY[category];
  if (!events) return undefined;
  
  // First try direct key lookup (uppercase with underscores)
  const key = eventId.toUpperCase().replace(/-/g, "_");
  if (events[key]) return events[key];
  
  // If not found, search by event id field (handles camelCase and other formats)
  return Object.values(events).find((event) => event.id === eventId);
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

