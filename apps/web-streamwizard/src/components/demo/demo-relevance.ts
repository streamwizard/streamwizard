import { WIDGET_SIMULATORS } from "@repo/ui/overlay";

export type DemoSectionId = "alerts" | "poll" | "ads" | "credits" | "simulate" | "custom";

export const DEMO_SECTIONS: { id: DemoSectionId; label: string }[] = [
  { id: "alerts", label: "Alerts" },
  { id: "poll", label: "Poll" },
  { id: "ads", label: "Ads" },
  { id: "credits", label: "Credits" },
  { id: "simulate", label: "Simulate" },
  { id: "custom", label: "Custom event" },
];

/**
 * What the built-in widgets listen to, as far as a simulator is concerned.
 * Custom widgets are covered by scanning their source instead.
 */
const NATIVE_WIDGET_LISTENERS: Record<string, readonly string[]> = {
  chat_widget: ["channel.chat.message"],
  combo_widget: ["channel.chat.message"],
  emote_widget: ["channel.chat.message"],
  poll_widget: ["channel.poll.begin", "channel.poll.progress", "channel.poll.end"],
  prediction_widget: [
    "channel.prediction.begin",
    "channel.prediction.progress",
    "channel.prediction.lock",
    "channel.prediction.end",
  ],
  irl_accuracy_widget: ["streamwizard.geo"],
  irl_altitude_widget: ["streamwizard.geo"],
  irl_heading_widget: ["streamwizard.geo"],
  irl_latitude_widget: ["streamwizard.geo"],
  irl_longitude_widget: ["streamwizard.geo"],
  irl_speed_widget: ["streamwizard.geo"],
};

export interface DemoRelevance {
  sections: DemoSectionId[];
  simulatorIds: string[];
  /** Nothing on the canvas has a quick test, so only the picker is left. */
  nothingToTest: boolean;
}

/**
 * Which parts of the deck the canvas can actually show. A Poll row on a scene
 * with no poll fires into nothing, and six rows of that is how the old bar got
 * out of hand. Hidden sections stay one click away ("Show all"), since a scan
 * can miss a computed listener string.
 */
export function demoRelevance(
  widgetTypes: readonly string[],
  customListeners: readonly string[]
): DemoRelevance {
  const types = new Set(widgetTypes);
  const listeners = new Set<string>(customListeners);
  for (const type of types) {
    for (const listener of NATIVE_WIDGET_LISTENERS[type] ?? []) listeners.add(listener);
  }
  const listensTo = (prefix: string) => [...listeners].some((l) => l.startsWith(prefix));

  const simulatorIds = Object.values(WIDGET_SIMULATORS)
    .filter((def) => def.listeners.some((l) => listeners.has(l)))
    .map((def) => def.id);

  const sections: DemoSectionId[] = [];
  if (types.has("alert_widget")) sections.push("alerts");
  if (types.has("poll_widget") || listensTo("channel.poll.")) sections.push("poll");
  if (types.has("ad_widget") || listensTo("channel.ad_break.")) sections.push("ads");
  if (types.has("credits_widget")) sections.push("credits");
  if (simulatorIds.length > 0) sections.push("simulate");
  const nothingToTest = sections.length === 0;
  sections.push("custom");

  return { sections, simulatorIds, nothingToTest };
}

export const ALL_SIMULATOR_IDS = Object.keys(WIDGET_SIMULATORS);
export const ALL_SECTION_IDS = DEMO_SECTIONS.map((s) => s.id);
