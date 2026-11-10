import "server-only";

import { randomBytes } from "crypto";

/** 32 random bytes as 64 hex characters: stream keys, output keys, overlay subscriber tokens. */
export function randomHexKey(): string {
  return randomBytes(32).toString("hex");
}
