import { z } from "zod";

// The /ws upgrade query. Only the role is checked strictly here; whether the
// token is good is the role's own check in upgrade.ts. Unknown params are
// dropped (older clients send `source`, which the token now carries).

export const CONNECTION_ROLES = ["subscriber", "bot", "monitor", "consumer", "ingest-node"] as const;

const MAX_LIST_ITEMS = 200;

/** A comma-separated list (`channels=a,b`, `types=a,b`) as a set, empty
 *  entries dropped. An empty or missing list means "everything". */
const csvSet = z
  .string()
  .max(32_768)
  .optional()
  .transform((raw) =>
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
  .pipe(z.array(z.string().max(128)).max(MAX_LIST_ITEMS))
  .transform((items) => new Set(items));

export const upgradeQuerySchema = z.object({
  role: z.enum(CONNECTION_ROLES),
  /** Subscriber token (64-hex scene token or a Supabase JWT) or the monitor secret. */
  token: z.string().min(1).max(16_384).optional(),
  /** Subscriber: the event types this socket wants. */
  channels: csvSet,
  /** Consumer: the event types this consumer wants. */
  types: csvSet,
});
export type UpgradeQuery = z.infer<typeof upgradeQuerySchema>;

/** The query of a /ws URL, parsed. On failure, says whether the role itself
 *  was missing or unknown, or another param was malformed. */
export function parseUpgradeQuery(url: URL): { ok: true; query: UpgradeQuery } | { ok: false; reason: "invalid_role" | "invalid_query" } {
  const raw = Object.fromEntries(url.searchParams);
  const parsed = upgradeQuerySchema.safeParse(raw);
  if (parsed.success) return { ok: true, query: parsed.data };
  const roleOk = z.enum(CONNECTION_ROLES).safeParse(raw.role).success;
  return { ok: false, reason: roleOk ? "invalid_query" : "invalid_role" };
}
