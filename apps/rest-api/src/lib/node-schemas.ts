import { z } from "zod";

// Field formats both node kinds (OBS and ingest) send to rest-api.

/** The one-time claim token from the panel's install command. */
export const claimToken = z.string().min(1).max(256);

/** A size in MB (RAM, disk), up to 1 EB. */
export const mbCount = z.number().int().min(0).max(1_000_000_000_000);

export const ipv4 = z.ipv4();

/** Any IP address. */
export const ipAddress = z.union([z.ipv4(), z.ipv6()]);

/**
 * An address the install script looked up itself (public IP from an echo
 * service, LAN IP from netplan). A lookup that returned junk is stored as
 * null instead of failing the whole claim.
 */
export const selfReportedIp = ipAddress.nullable().optional().catch(null);

/** A path or query id that must be a UUID. null when it isn't one. */
export function parseUuid(value: string | undefined): string | null {
  const parsed = z.uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}
