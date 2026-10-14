import { createHash, randomBytes } from "node:crypto";

// Server-only (node:crypto): its own export path, so @repo/cms stays safe to
// import in the browser. Preview links carry a random token; only its
// sha256 is stored, so a database leak can't be turned into working links.

export * from "./preview";

export function createPreviewToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPreviewToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** A bytea value as PostgREST expects it in JSON and filters: \x followed by hex. */
export function toPgBytea(bytes: Buffer): string {
  return `\\x${bytes.toString("hex")}`;
}
