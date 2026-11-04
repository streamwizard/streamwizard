import { guidSchema, twitchClipIdSchema } from "@repo/schemas/ids";
import { z } from "zod";

/** Shared by the folder dialog (client) and the folder actions (server). */
export const folderNameSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Folder name must be at least 1 character." })
    .max(255, { message: "Folder name must not exceed 255 characters." })
    .regex(/^[a-zA-Z0-9-_\s]+$/, {
      message: "Folder name can only contain letters, numbers, spaces, hyphens, and underscores.",
    }),
});

export const addClipToFolderSchema = z.object({
  clipId: twitchClipIdSchema,
  folderId: guidSchema,
  // Only the label in the reply; the folder must already exist.
  folderName: z.string().min(1).max(1000),
});

export const removeClipFromFolderSchema = z.object({
  clipId: twitchClipIdSchema,
  folderId: guidSchema,
});

export const createClipFolderSchema = folderNameSchema.extend({
  parentFolderId: guidSchema.optional(),
});

export const editClipFolderSchema = folderNameSchema.extend({
  folderId: guidSchema,
});
