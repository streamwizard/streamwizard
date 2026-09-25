/**
 * Single registry object for every root widget (library, canvas, inspector, nested
 * `childFields`). Add new roots here; keep heavy logic in `widgets/<name>/`.
 *
 * To add a root widget:
 * 1. Extend `OverlayItemType` / config in `src/types/overlays.ts`
 * 2. Add Zod in `src/schemas/overlay.ts` (and DB enum if applicable)
 * 3. Add a key to `OVERLAY_WIDGET_REGISTRY` and any helpers under `widgets/<name>/`
 */

"use client";

import {
  Bell,
  Clapperboard,
  Clock,
  Code2,
  Compass,
  Crosshair,
  Gauge,
  Goal,
  MapPin,
  Megaphone,
  MessagesSquare,
  Mountain,
  Radio,
  ScrollText,
  Timer,
  Type,
  Vote,
} from "lucide-react";
import type { ChildOverlayItemType, OverlayItemType, RootOverlayItemType } from "@/types/overlays";
import {
  getClipDisplayChildren,
  isRootOverlayItemType,
} from "@/types/overlays";
import {
  CLIPS_WIDGET_DEFAULT_SIZE,
  createClipsWidgetRootItems,
} from "../widgets/clips/clips-widget-definition";
import { ClipDisplayFieldSettings } from "../widgets/clips/clip-display-field-settings";
import { ClipsWidgetCanvas } from "../widgets/clips/clips-widget-canvas";
import { ClipsWidgetSettings } from "../widgets/clips/clips-widget-settings";
import {
  createTextWidgetRootItems,
  TEXT_WIDGET_DEFAULT_SIZE,
} from "../widgets/text/text-widget-definition";
import { TextWidgetSettings } from "../widgets/text/text-widget-settings";
import {
  createTimerWidgetRootItems,
  TIMER_WIDGET_DEFAULT_SIZE,
} from "../widgets/timer/timer-widget-definition";
import { TimerWidgetSettings } from "../widgets/timer/timer-widget-settings";
import {
  CLOCK_WIDGET_DEFAULT_SIZE,
  createClockWidgetRootItems,
} from "../widgets/clock/clock-widget-definition";
import { ClockWidgetSettings } from "../widgets/clock/clock-widget-settings";
import {
  IRL_FIELD_WIDGET_DEFAULT_SIZE,
  createIrlSpeedWidgetRootItems,
  createIrlHeadingWidgetRootItems,
  createIrlAltitudeWidgetRootItems,
  createIrlLatitudeWidgetRootItems,
  createIrlLongitudeWidgetRootItems,
  createIrlAccuracyWidgetRootItems,
} from "../widgets/irl/irl-field-widget-definition";
import { IrlFieldWidgetSettings } from "../widgets/irl/irl-field-widget-settings";
import {
  CUSTOM_WIDGET_DEFAULT_SIZE,
  createCustomWidgetRootItems,
} from "../widgets/custom/custom-widget-definition";
import { CustomWidgetSettings } from "../widgets/custom/custom-widget-settings";
import { CustomWidgetCanvas } from "../widgets/custom/custom-widget-canvas";
import {
  ALERT_WIDGET_DEFAULT_SIZE,
  createAlertWidgetRootItems,
} from "../widgets/alert/alert-widget-definition";
import { AlertWidgetSettings } from "../widgets/alert/alert-widget-settings";
import {
  CHAT_WIDGET_DEFAULT_SIZE,
  createChatWidgetRootItems,
} from "../widgets/chat/chat-widget-definition";
import { ChatWidgetSettings } from "../widgets/chat/chat-widget-settings";
import {
  GOAL_WIDGET_DEFAULT_SIZE,
  createGoalWidgetRootItems,
} from "../widgets/goal/goal-widget-definition";
import { GoalWidgetSettings } from "../widgets/goal/goal-widget-settings";
import {
  POLL_WIDGET_DEFAULT_SIZE,
  createPollWidgetRootItems,
} from "../widgets/poll/poll-widget-definition";
import { PollWidgetSettings } from "../widgets/poll/poll-widget-settings";
import {
  AD_WIDGET_DEFAULT_SIZE,
  createAdWidgetRootItems,
} from "../widgets/ads/ad-widget-definition";
import { AdWidgetSettings } from "../widgets/ads/ad-widget-settings";
import {
  UPTIME_WIDGET_DEFAULT_SIZE,
  createUptimeWidgetRootItems,
} from "../widgets/uptime/uptime-widget-definition";
import { UptimeWidgetSettings } from "../widgets/uptime/uptime-widget-settings";
import {
  CREDITS_WIDGET_DEFAULT_SIZE,
  createCreditsWidgetRootItems,
} from "../widgets/credits/credits-widget-definition";
import { CreditsWidgetSettings } from "../widgets/credits/credits-widget-settings";
import {
  AlertWidgetRenderer,
  ChatWidgetRenderer,
  GoalWidgetRenderer,
  PollWidgetRenderer,
  AdWidgetRenderer,
  UptimeWidgetRenderer,
  CreditsWidgetRenderer,
  TextWidgetRenderer,
  TimerWidgetRenderer,
  ClockWidgetRenderer,
  IrlFieldWidgetRenderer,
} from "@repo/ui/overlay";
import type {
  OverlayCanvasProps,
  OverlayChildResolvedDefinition,
  OverlayRootWidgetDefinition,
  ResolvedOverlayWidgetDefinition,
  WidgetCategory,
} from "./overlay-widget-registry.types";

/**
 * On the canvas the alert box has no live socket to listen to, so it renders a
 * placeholder instead of subscribing and sitting empty.
 */
function AlertWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <AlertWidgetRenderer item={item} scene={scene} isEditor />;
}

/** The chat box shows a how-to-preview hint on the canvas until chat arrives. */
function ChatWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <ChatWidgetRenderer item={item} scene={scene} isEditor />;
}

/** Goal widgets read the channel's goals through the dashboard session on the canvas. */
function GoalWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <GoalWidgetRenderer item={item} scene={scene} isEditor />;
}

/** The poll widget reads the channel's poll through the dashboard session on the canvas. */
function PollWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <PollWidgetRenderer item={item} scene={scene} isEditor />;
}

/** The ad widget reads the channel's ad schedule through the dashboard session on the canvas. */
function AdWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <AdWidgetRenderer item={item} scene={scene} isEditor />;
}

/** The uptime widget reads the stream through the dashboard session and previews a time while offline. */
function UptimeWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <UptimeWidgetRenderer item={item} scene={scene} isEditor />;
}

/** The credits widget reads the last stream through the dashboard session and rolls only when the settings say so. */
function CreditsWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <CreditsWidgetRenderer item={item} scene={scene} isEditor />;
}

export const OVERLAY_WIDGET_REGISTRY: Record<
  RootOverlayItemType,
  OverlayRootWidgetDefinition
> = {
  clips_widget: {
    type: "clips_widget",
    layerScope: "root",
    icon: Clapperboard,
    showInLibrary: true,
    category: "media",
    library: {
      title: "Clips",
      description: "Rotating Twitch clips with customizable display fields.",
    },
    defaultSize: { ...CLIPS_WIDGET_DEFAULT_SIZE },
    createRootItems: createClipsWidgetRootItems,
    getChildItems: getClipDisplayChildren,
    syncChildGeometryFromParent: true,
    CanvasContent: ClipsWidgetCanvas,
    SettingsPanel: ClipsWidgetSettings,
    childFields: [
      {
        type: "clip_display_field",
        defaultSize: { ...CLIPS_WIDGET_DEFAULT_SIZE },
        SettingsPanel: ClipDisplayFieldSettings,
      },
    ],
  },
  alert_widget: {
    type: "alert_widget",
    layerScope: "root",
    icon: Bell,
    showInLibrary: true,
    category: "alerts",
    library: {
      title: "Alert box",
      description:
        "Follow, sub, cheer, and raid alerts with your own images, videos, and sounds. No code needed.",
    },
    defaultSize: { ...ALERT_WIDGET_DEFAULT_SIZE },
    createRootItems: createAlertWidgetRootItems,
    CanvasContent: AlertWidgetCanvas,
    SettingsPanel: AlertWidgetSettings,
  },
  chat_widget: {
    type: "chat_widget",
    layerScope: "root",
    icon: MessagesSquare,
    showInLibrary: true,
    category: "alerts",
    library: {
      title: "Chat box",
      description:
        "Your Twitch chat on stream, with badges and 7TV, BTTV and FFZ emotes. Deleted messages disappear.",
    },
    defaultSize: { ...CHAT_WIDGET_DEFAULT_SIZE },
    createRootItems: createChatWidgetRootItems,
    CanvasContent: ChatWidgetCanvas,
    SettingsPanel: ChatWidgetSettings,
  },
  follower_goal_widget: {
    type: "follower_goal_widget",
    layerScope: "root",
    icon: Goal,
    showInLibrary: true,
    category: "goals",
    library: {
      title: "Follower goal",
      description:
        "Your Twitch follower goal as a live progress bar. Make the goal on Twitch, watch it fill here.",
    },
    defaultSize: { ...GOAL_WIDGET_DEFAULT_SIZE },
    createRootItems: createGoalWidgetRootItems("follower_goal_widget"),
    CanvasContent: GoalWidgetCanvas,
    SettingsPanel: GoalWidgetSettings,
  },
  sub_goal_widget: {
    type: "sub_goal_widget",
    layerScope: "root",
    icon: Goal,
    showInLibrary: true,
    category: "goals",
    library: {
      title: "Sub goal",
      description:
        "Your Twitch sub goal, whichever kind you run: total or new, subs or sub points.",
    },
    defaultSize: { ...GOAL_WIDGET_DEFAULT_SIZE },
    createRootItems: createGoalWidgetRootItems("sub_goal_widget"),
    CanvasContent: GoalWidgetCanvas,
    SettingsPanel: GoalWidgetSettings,
  },
  bits_goal_widget: {
    type: "bits_goal_widget",
    layerScope: "root",
    icon: Goal,
    showInLibrary: true,
    category: "goals",
    library: {
      title: "Bits goal",
      description:
        "Your Twitch Bits goal, counting Bits or cheerers. Fills with every cheer.",
    },
    defaultSize: { ...GOAL_WIDGET_DEFAULT_SIZE },
    createRootItems: createGoalWidgetRootItems("bits_goal_widget"),
    CanvasContent: GoalWidgetCanvas,
    SettingsPanel: GoalWidgetSettings,
  },
  poll_widget: {
    type: "poll_widget",
    layerScope: "root",
    icon: Vote,
    showInLibrary: true,
    category: "polls",
    library: {
      title: "Poll",
      description:
        "Your Twitch poll with live votes, a countdown and the winner when it closes. Start the poll on Twitch.",
    },
    defaultSize: { ...POLL_WIDGET_DEFAULT_SIZE },
    createRootItems: createPollWidgetRootItems,
    CanvasContent: PollWidgetCanvas,
    SettingsPanel: PollWidgetSettings,
  },
  ad_widget: {
    type: "ad_widget",
    layerScope: "root",
    icon: Megaphone,
    showInLibrary: true,
    category: "ads",
    library: {
      title: "Ads",
      description:
        "A heads-up before your ad break and a countdown while it runs, so viewers know when you're back.",
    },
    defaultSize: { ...AD_WIDGET_DEFAULT_SIZE },
    createRootItems: createAdWidgetRootItems,
    CanvasContent: AdWidgetCanvas,
    SettingsPanel: AdWidgetSettings,
  },
  uptime_widget: {
    type: "uptime_widget",
    layerScope: "root",
    icon: Radio,
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Uptime",
      description: "How long you have been live, straight from Twitch. Hides itself when you are offline.",
    },
    defaultSize: { ...UPTIME_WIDGET_DEFAULT_SIZE },
    createRootItems: createUptimeWidgetRootItems,
    CanvasContent: UptimeWidgetCanvas,
    SettingsPanel: UptimeWidgetSettings,
  },
  credits_widget: {
    type: "credits_widget",
    layerScope: "root",
    icon: ScrollText,
    showInLibrary: true,
    category: "credits",
    library: {
      title: "End credits",
      description:
        "Rolls the names from your stream when your ending scene comes up: followers, subs, gifts, Bits, raids and more.",
    },
    defaultSize: { ...CREDITS_WIDGET_DEFAULT_SIZE },
    createRootItems: createCreditsWidgetRootItems,
    CanvasContent: CreditsWidgetCanvas,
    SettingsPanel: CreditsWidgetSettings,
  },
  text_widget: {
    type: "text_widget",
    layerScope: "root",
    icon: Type,
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Text",
      description: "Static text with font size, color, and alignment.",
    },
    defaultSize: { ...TEXT_WIDGET_DEFAULT_SIZE },
    createRootItems: createTextWidgetRootItems,
    CanvasContent: TextWidgetRenderer,
    SettingsPanel: TextWidgetSettings,
  },
  timer_widget: {
    type: "timer_widget",
    layerScope: "root",
    icon: Timer,
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Countdown",
      description:
        "Count down to a date and time—starting soon, breaks, or anything you schedule.",
    },
    defaultSize: { ...TIMER_WIDGET_DEFAULT_SIZE },
    createRootItems: createTimerWidgetRootItems,
    CanvasContent: TimerWidgetRenderer,
    SettingsPanel: TimerWidgetSettings,
  },
  clock_widget: {
    type: "clock_widget",
    layerScope: "root",
    icon: Clock,
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Time",
      description:
        "Live date and time—local or a fixed time zone, with typography you control.",
    },
    defaultSize: { ...CLOCK_WIDGET_DEFAULT_SIZE },
    createRootItems: createClockWidgetRootItems,
    CanvasContent: ClockWidgetRenderer,
    SettingsPanel: ClockWidgetSettings,
  },
  irl_speed_widget: {
    type: "irl_speed_widget",
    layerScope: "root",
    icon: Gauge,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Speed", description: "Live GPS speed from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlSpeedWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_heading_widget: {
    type: "irl_heading_widget",
    layerScope: "root",
    icon: Compass,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Heading", description: "Live GPS heading direction from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlHeadingWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_altitude_widget: {
    type: "irl_altitude_widget",
    layerScope: "root",
    icon: Mountain,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Altitude", description: "Live GPS altitude from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlAltitudeWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_latitude_widget: {
    type: "irl_latitude_widget",
    layerScope: "root",
    icon: MapPin,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Latitude", description: "Live GPS latitude from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlLatitudeWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_longitude_widget: {
    type: "irl_longitude_widget",
    layerScope: "root",
    icon: MapPin,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Longitude", description: "Live GPS longitude from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlLongitudeWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_accuracy_widget: {
    type: "irl_accuracy_widget",
    layerScope: "root",
    icon: Crosshair,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Accuracy", description: "Live GPS accuracy from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlAccuracyWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  custom_widget: {
    type: "custom_widget",
    layerScope: "root",
    icon: Code2,
    showInLibrary: false,
    category: "other",
    library: {
      title: "Custom Widget",
      description: "Build your own widget with HTML, JavaScript, and Tailwind CSS.",
    },
    defaultSize: { ...CUSTOM_WIDGET_DEFAULT_SIZE },
    createRootItems: createCustomWidgetRootItems,
    CanvasContent: CustomWidgetCanvas,
    SettingsPanel: CustomWidgetSettings,
  },
};

const childDefinitionByType: Map<
  ChildOverlayItemType,
  OverlayChildResolvedDefinition
> = new Map();

for (const root of Object.values(OVERLAY_WIDGET_REGISTRY)) {
  if (!root.childFields) continue;
  for (const field of root.childFields) {
    if (childDefinitionByType.has(field.type)) {
      throw new Error(
        `Duplicate child overlay definition for type: ${field.type}`
      );
    }
    childDefinitionByType.set(field.type, {
      type: field.type,
      layerScope: "child",
      showInLibrary: false,
      defaultSize: field.defaultSize,
      SettingsPanel: field.SettingsPanel,
      CanvasContent: field.CanvasContent,
    });
  }
}

export function getOverlayWidgetDefinition(
  type: OverlayItemType
): ResolvedOverlayWidgetDefinition {
  if (isRootOverlayItemType(type)) {
    return OVERLAY_WIDGET_REGISTRY[type];
  }
  const resolved = childDefinitionByType.get(type as ChildOverlayItemType);
  if (resolved) return resolved;
  throw new Error(`Unknown overlay item type: ${type}`);
}

export function getRootOverlayWidgetDefinition(
  type: RootOverlayItemType
): OverlayRootWidgetDefinition {
  return OVERLAY_WIDGET_REGISTRY[type];
}

export function isRootLayerType(type: OverlayItemType): boolean {
  return isRootOverlayItemType(type);
}

export function getLibraryWidgetDefinitions(): OverlayRootWidgetDefinition[] {
  return Object.values(OVERLAY_WIDGET_REGISTRY).filter((d) => d.showInLibrary);
}

export function groupLibraryWidgetsByCategory(): Record<
  WidgetCategory,
  OverlayRootWidgetDefinition[]
> {
  const grouped: Record<WidgetCategory, OverlayRootWidgetDefinition[]> = {
    media: [],
    alerts: [],
    goals: [],
    polls: [],
    ads: [],
    credits: [],
    layout: [],
    other: [],
  };
  for (const def of getLibraryWidgetDefinitions()) {
    const cat: WidgetCategory = def.category ?? "other";
    grouped[cat].push(def);
  }
  return grouped;
}

export type {
  OverlayCanvasProps,
  OverlayChildFieldDeclaration,
  OverlayChildResolvedDefinition,
  OverlayInspectorAppendProps,
  OverlayRootWidgetDefinition,
  ResolvedOverlayWidgetDefinition,
} from "./overlay-widget-registry.types";
export { isRootOverlayDefinition } from "./overlay-widget-registry.types";
