export interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

export type PublisherMessage =
  | { type: "geo"; payload: GeoPayload }
