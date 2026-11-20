import { wireIdSchema } from "@/modules/live-sessions/schemas";

// A live session's two credentials: the wire id the phone and the ingest node
// put in every packet header, and the secret both derive their keys from
// (HKDF-SHA256 in the Rust protocol crate; nothing is derived here).

const ZERO_WIRE_ID = "0000000000000000";

/** A random 64-bit wire id, 16 lowercase hex characters, never all zero. */
export function newWireId(): string {
  for (;;) {
    const id = Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString("hex");
    if (id !== ZERO_WIRE_ID) return id;
  }
}

/** 32 bytes from the CSPRNG as base64url without padding (43 characters). */
export function newSessionSecret(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

/** A session id from a path. null when it isn't a valid wire id. */
export function parseWireId(value: string | undefined): string | null {
  const parsed = wireIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
