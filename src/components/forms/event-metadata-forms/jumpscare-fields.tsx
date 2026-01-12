"use client";

import { MetadataFieldsProps } from "./types";
import {
  NoConfigFields,
  NO_CONFIG_EVENTS,
  FakeDamageFields,
  SpinningPlayerFields,
} from "./jumpscares";

export function JumpscareFields({ eventId, control }: MetadataFieldsProps) {
  if (NO_CONFIG_EVENTS.includes(eventId)) {
    return <NoConfigFields eventId={eventId} control={control} />;
  }

  if (eventId === "fake_damage") {
    return <FakeDamageFields eventId={eventId} control={control} />;
  }

  if (eventId === "SpinningPlayer") {
    return <SpinningPlayerFields eventId={eventId} control={control} />;
  }

  return null;
}
