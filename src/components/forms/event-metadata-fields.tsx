"use client";

import { Control } from "react-hook-form";
import { ActionCategory, ACTION_CATEGORIES, getEvent } from "@/lib/actions/action-registry";
import {
  JumpscareFields,
  DisasterFields,
  EventFields,
} from "./event-metadata-forms";

interface EventMetadataFieldsProps {
  category: ActionCategory;
  eventId: string;
  control: Control<any>;
  triggerEventType?: string; // Trigger event type for template variables
}

/**
 * Dynamic metadata fields component based on category and event
 */
export function EventMetadataFields({ category, eventId, control, triggerEventType }: EventMetadataFieldsProps) {
  if (!category || !eventId) {
    return null;
  }

  const event = getEvent(category, eventId);
  if (!event) {
    return null;
  }

  // Render fields based on category
  switch (category) {
    case ACTION_CATEGORIES.JUMPSCARES:
      return <JumpscareFields eventId={eventId} control={control} triggerEventType={triggerEventType} />;
    case ACTION_CATEGORIES.DISASTERS:
      return <DisasterFields eventId={eventId} control={control} triggerEventType={triggerEventType} />;
    case ACTION_CATEGORIES.EVENTS:
      return <EventFields eventId={eventId} control={control} triggerEventType={triggerEventType} />;
    default:
      return null;
  }
}
