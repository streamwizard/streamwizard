import { z } from "zod";
import { twitchIdSchema } from "./ids";

// Inputs for the server actions that call Helix on the streamer's behalf.

export const twitchSearchSchema = z.object({
  query: z.string().trim().min(1).max(100),
  // Helix caps `first` at 100.
  first: z.number().int().min(1).max(100).default(10),
});

// Twitch rejects a longer title outright; checked here so the deck can say so
// rather than surfacing an opaque 400 on a phone.
const MAX_TITLE_LENGTH = 140;

export const updateChannelInfoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "A stream needs a title")
    .max(MAX_TITLE_LENGTH, `Titles are capped at ${MAX_TITLE_LENGTH} characters`)
    .optional(),
  gameId: twitchIdSchema.optional(),
});

// Helix caps a message at 500 characters and rejects the whole request past
// that, so it's checked here rather than surfacing as an opaque 400 on a phone.
const MAX_MESSAGE_LENGTH = 500;

export const deckChatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Nothing to send")
    .max(MAX_MESSAGE_LENGTH, `Messages are capped at ${MAX_MESSAGE_LENGTH} characters`),
  replyToMessageId: z.uuid().nullish(),
});

/** Helix pagination cursors are opaque base64-ish strings. */
export const twitchCursorSchema = z.string().max(1024);

export const deleteVideosSchema = z
  .array(twitchIdSchema)
  .min(1, "No video IDs provided")
  .max(5, "Maximum 5 videos can be deleted per request");

export const createClipFromVodSchema = z
  .object({
    vodId: twitchIdSchema,
    // Where the clip ends, in seconds into the VOD.
    vod_offset: z.number().min(0).max(48 * 60 * 60),
    duration: z
      .number()
      .min(5, "Duration must be between 5 and 60 seconds")
      .max(60, "Duration must be between 5 and 60 seconds"),
    title: z.string().max(140).optional(),
  })
  .refine((v) => v.vod_offset >= v.duration, {
    message: "The clip can't start before the VOD does",
  });

export const streamMarkerDescriptionSchema = z
  .string()
  .max(140, "Description must be 140 characters or less")
  .optional();
