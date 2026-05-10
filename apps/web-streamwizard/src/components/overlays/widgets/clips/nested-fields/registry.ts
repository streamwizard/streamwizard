import { DISPLAY_FIELD_KEYS, type DisplayFieldKey } from "@/types/overlays";
import { creatorField } from "./fields/creator-field";
import { dateField } from "./fields/date-field";
import { durationField } from "./fields/duration-field";
import { gameField } from "./fields/game-field";
import { titleField } from "./fields/title-field";
import { viewCountField } from "./fields/view-count-field";
import type { ClipNestedDisplayFieldDefinition } from "./types";

export const CLIP_NESTED_DISPLAY_FIELDS = {
  title: titleField,
  creator: creatorField,
  game: gameField,
  date: dateField,
  viewCount: viewCountField,
  duration: durationField,
} as const satisfies Record<DisplayFieldKey, ClipNestedDisplayFieldDefinition>;

export const DISPLAY_FIELD_LABELS: Record<DisplayFieldKey, string> =
  DISPLAY_FIELD_KEYS.reduce(
    (acc, key) => {
      acc[key] = CLIP_NESTED_DISPLAY_FIELDS[key].label;
      return acc;
    },
    {} as Record<DisplayFieldKey, string>
  );

export function getClipNestedFieldLabel(key: DisplayFieldKey): string {
  return CLIP_NESTED_DISPLAY_FIELDS[key].label;
}
