import { z } from "zod";

/** Name shown for an ingest or OBS output key; blank falls back to a default. */
export const ingestKeyLabelSchema = z.string().trim().max(100, "Keep the name under 100 characters");
