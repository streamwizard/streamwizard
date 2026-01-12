"use client";

import { FieldGroup } from "@/components/ui/field";
import { MetadataFieldsProps } from "../types";

// Events with no configurable options: door_scare, welcome_home, EndermanJumpscare, fireworks
export const NO_CONFIG_EVENTS = ["door_scare", "welcome_home", "EndermanJumpscare", "fireworks"];

export function NoConfigFields({ eventId, control }: MetadataFieldsProps) {
  return (
    <FieldGroup>
      <p className="text-sm text-muted-foreground">This event has no configurable options.</p>
    </FieldGroup>
  );
}


