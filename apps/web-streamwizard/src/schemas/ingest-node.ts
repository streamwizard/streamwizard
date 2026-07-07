import { z } from "zod";

// The node's "name" is used verbatim as its Linux hostname (see rest-api's
// /api/ingest-nodes/claim handler, which passes it through slugifyHostname --
// a no-op for strings that already satisfy this pattern). Same RFC 1123
// label rules as obs-node.ts, for the same reason: no surprise transformation
// between what the admin types and what install.sh sets on the machine.
const hostnamePattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export const ingestNodeCapacitySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(63, "Must be 63 characters or fewer")
    .regex(
      hostnamePattern,
      "Lowercase letters, numbers, and hyphens only -- can't start or end with a hyphen (this becomes the node's hostname)",
    ),
  max_concurrent_sessions: z.number().int().min(1, "Must be at least 1").nullable(),
});

export type IngestNodeCapacityInput = z.infer<typeof ingestNodeCapacitySchema>;
