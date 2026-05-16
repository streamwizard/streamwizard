"use client";

import type { CSSProperties } from "react";
import type { IrlFieldWidgetItemConfig, IrlFieldWidgetType, OverlayItem, OverlayScene } from "../../types";
import { DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG, IRL_FIELD_WIDGET_TYPES } from "../../types";
import { useIrlGeoData } from "./use-irl-geo-data";

export interface IrlFieldWidgetRendererProps {
  item: OverlayItem;
  scene?: OverlayScene;
  zoom?: number;
}

type IrlFieldKey = "speed" | "heading" | "altitude" | "latitude" | "longitude" | "accuracy";

const FIELD_FROM_TYPE: Record<IrlFieldWidgetType, IrlFieldKey> = {
  irl_speed_widget: "speed",
  irl_heading_widget: "heading",
  irl_altitude_widget: "altitude",
  irl_latitude_widget: "latitude",
  irl_longitude_widget: "longitude",
  irl_accuracy_widget: "accuracy",
};

function resolveConfig(raw: unknown): IrlFieldWidgetItemConfig {
  const r = raw as Partial<IrlFieldWidgetItemConfig>;
  const base = DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG;
  return {
    unit: r.unit === "mph" ? "mph" : "kmh",
    mockData: typeof r.mockData === "boolean" ? r.mockData : base.mockData,
    fontSize: typeof r.fontSize === "number" && r.fontSize >= 8 ? r.fontSize : base.fontSize,
    color: typeof r.color === "string" ? r.color : base.color,
    align: r.align === "left" || r.align === "center" || r.align === "right" ? r.align : base.align,
    fontWeight:
      r.fontWeight === 400 || r.fontWeight === 500 || r.fontWeight === 600 || r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
    fontFamily: typeof r.fontFamily === "string" && r.fontFamily.trim() ? r.fontFamily.trim() : base.fontFamily,
  };
}

function mpsToKmh(mps: number) { return mps * 3.6; }
function mpsToMph(mps: number) { return mps * 2.23694; }

function formatHeading(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return `${Math.round(deg)}° ${dirs[idx] ?? ""}`;
}

function formatValue(
  field: IrlFieldKey,
  geo: NonNullable<ReturnType<typeof useIrlGeoData>["geo"]>,
  cfg: IrlFieldWidgetItemConfig
): string | null {
  switch (field) {
    case "speed": {
      if (geo.speed === null) return null;
      const v = cfg.unit === "mph" ? mpsToMph(geo.speed) : mpsToKmh(geo.speed);
      return `${v.toFixed(1)} ${cfg.unit === "mph" ? "mph" : "km/h"}`;
    }
    case "heading":
      return geo.heading !== null ? formatHeading(geo.heading) : null;
    case "altitude":
      return geo.altitude !== null ? `${Math.round(geo.altitude)} m` : null;
    case "latitude":
      return geo.latitude.toFixed(5);
    case "longitude":
      return geo.longitude.toFixed(5);
    case "accuracy":
      return `±${Math.round(geo.accuracy)} m`;
  }
}

export function IrlFieldWidgetRenderer({ item, scene, zoom = 1 }: IrlFieldWidgetRendererProps) {
  const cfg = resolveConfig(item.config);
  const subscriberToken = scene?.subscriber_token ?? "";
  const field = FIELD_FROM_TYPE[item.type as IrlFieldWidgetType] ?? "speed";
  const { geo, status } = useIrlGeoData(subscriberToken, cfg.mockData);

  const textAlign = cfg.align as CSSProperties["textAlign"];
  const fontSize = cfg.fontSize * zoom;

  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent:
      cfg.align === "center" ? "center" : cfg.align === "right" ? "flex-end" : "flex-start",
    padding: `0 ${8 * zoom}px`,
    boxSizing: "border-box",
    color: cfg.color,
    fontFamily: cfg.fontFamily === "monospace" ? "monospace" : `"${cfg.fontFamily}", sans-serif`,
    fontSize,
    fontWeight: cfg.fontWeight,
    textAlign,
  };

  if (!cfg.mockData && status === "offline") {
    return (
      <div style={{ ...containerStyle, opacity: 0.5, fontSize: fontSize * 0.6 }}>
        OFFLINE
      </div>
    );
  }

  if (!geo) {
    return (
      <div style={{ ...containerStyle, opacity: 0.5, fontSize: fontSize * 0.6 }}>
        {status === "connecting" ? "Connecting…" : "Waiting for GPS…"}
      </div>
    );
  }

  const value = formatValue(field, geo, cfg);

  if (value === null) {
    return (
      <div style={{ ...containerStyle, opacity: 0.4, fontSize: fontSize * 0.6 }}>
        No data
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {cfg.mockData && (
        <span style={{ fontSize: fontSize * 0.5, opacity: 0.4, marginRight: `${4 * zoom}px` }}>
          MOCK·
        </span>
      )}
      {value}
    </div>
  );
}

// Re-export for convenience
export { IRL_FIELD_WIDGET_TYPES };
