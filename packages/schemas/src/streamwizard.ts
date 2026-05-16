import { z } from "zod";

export const OverlayGeoPayloadSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  accuracy: z.number(),
  timestamp: z.number(),
});

export const OverlayGeoEventSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("connected"), payload: OverlayGeoPayloadSchema }),
  z.object({ status: z.literal("offline"), payload: z.undefined() }),
]);

export const OverlayStatusPayloadSchema = z.object({
  status: z.literal("offline"),
});

export type OverlayGeoPayload = z.infer<typeof OverlayGeoPayloadSchema>;
export type OverlayGeoEvent = z.infer<typeof OverlayGeoEventSchema>;
export type OverlayStatusPayload = z.infer<typeof OverlayStatusPayloadSchema>;
