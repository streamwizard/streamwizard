"use client";

import type { OverlayItem } from "@/types/overlays";
import { DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG, IRL_FIELD_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";
import type { IrlFieldWidgetType } from "@/types/overlays";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { IRL_FIELD_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

const FIELD_LABELS: Record<IrlFieldWidgetType, string> = {
  irl_speed_widget: "Speed",
  irl_heading_widget: "Heading",
  irl_altitude_widget: "Altitude",
  irl_latitude_widget: "Latitude",
  irl_longitude_widget: "Longitude",
  irl_accuracy_widget: "Accuracy",
};

function createIrlFieldWidgetItem(
  type: IrlFieldWidgetType,
  ctx: CreateRootItemContext
): OverlayItem {
  const fieldLabel = FIELD_LABELS[type];
  return createCenteredRootItem(ctx, {
    type,
    size: IRL_FIELD_WIDGET_DEFAULT_SIZE,
    label: (n) => (n === 1 ? `IRL ${fieldLabel}` : `IRL ${fieldLabel} ${n}`),
    config: { ...DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG },
  });
}

export function createIrlSpeedWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_speed_widget", ctx)];
}

export function createIrlHeadingWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_heading_widget", ctx)];
}

export function createIrlAltitudeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_altitude_widget", ctx)];
}

export function createIrlLatitudeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_latitude_widget", ctx)];
}

export function createIrlLongitudeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_longitude_widget", ctx)];
}

export function createIrlAccuracyWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_accuracy_widget", ctx)];
}
