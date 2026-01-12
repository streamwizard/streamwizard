"use client";

import { MetadataFieldsProps } from "./types";
import { SupernovaFields, WindstormFields } from "./disasters";

export function DisasterFields({ eventId, control }: MetadataFieldsProps) {
  if (eventId === "supernova") {
    return <SupernovaFields eventId={eventId} control={control} />;
  }

  if (eventId === "windstorm") {
    return <WindstormFields eventId={eventId} control={control} />;
  }

  return null;
}
