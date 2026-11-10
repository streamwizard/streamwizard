import { z } from "zod";

/** Largest single file the media library accepts. */
export const MAX_ASSET_FILE_BYTES = 10 * 1024 * 1024;

export const createAssetUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z
    .number()
    .int("Can't read that file's size.")
    .positive("Can't read that file's size.")
    .max(MAX_ASSET_FILE_BYTES, "Files can be up to 10MB."),
});
