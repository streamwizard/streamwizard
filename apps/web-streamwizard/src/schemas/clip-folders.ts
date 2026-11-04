import { z } from "zod";
import { idSchema, twitchClipIdSchema } from "./ids";

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
  folderId: idSchema,
  // Only the label in the reply; the folder must already exist.
  folderName: z.string().min(1).max(1000),
});

export const removeClipFromFolderSchema = z.object({
  clipId: twitchClipIdSchema,
  folderId: idSchema,
});

export const createClipFolderSchema = folderNameSchema.extend({
  parentFolderId: idSchema.optional(),
});

export const editClipFolderSchema = folderNameSchema.extend({
  folderId: idSchema,
});
