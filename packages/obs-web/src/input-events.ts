import { z } from "zod";

// OBS input events the app listens to, parsed from obs-websocket's
// eventData. Settings hold only the values someone set; a default (like
// a browser source's reroute_audio = false) is simply missing.
const settings = z.record(z.string(), z.unknown());

const inputEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("InputCreated"), inputName: z.string(), inputKind: z.string(), inputSettings: settings }),
  z.object({ type: z.literal("InputSettingsChanged"), inputName: z.string(), inputSettings: settings }),
  z.object({ type: z.literal("InputNameChanged"), oldInputName: z.string(), inputName: z.string() }),
  z.object({ type: z.literal("InputRemoved"), inputName: z.string() }),
]);

/** A source created, changed, renamed or deleted, by anyone connected to this OBS. */
export type InputEvent = z.infer<typeof inputEventSchema>;

/** The event, or null when OBS sent a shape we don't know. */
export function parseInputEvent(eventType: string, eventData: unknown): InputEvent | null {
  const parsed = inputEventSchema.safeParse({ ...(eventData as object), type: eventType });
  return parsed.success ? parsed.data : null;
}
