"use client";

import { MetadataFieldsProps } from "./types";
import {
  RandomMobSpawnFields,
  LaunchFields,
  CelebrationAlertFields,
} from "./events";

export function EventFields({ eventId, control, triggerEventType }: MetadataFieldsProps) {
  if (eventId === "random_mob_spawn") {
    return <RandomMobSpawnFields eventId={eventId} control={control} triggerEventType={triggerEventType} />;
  }

  if (eventId === "launce") {
    return <LaunchFields eventId={eventId} control={control} triggerEventType={triggerEventType} />;
  }

  if (eventId === "celebration_alert") {
    return <CelebrationAlertFields eventId={eventId} control={control} triggerEventType={triggerEventType} />;
  }

  return null;
}
