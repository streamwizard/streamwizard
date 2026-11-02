import { timingSafeEqual } from "crypto";

/** Constant-time compare of a presented secret against the expected one. */
export function isValidSecret(candidate: string | null | undefined, secret: string): boolean {
  const candidateBuf = Buffer.from(candidate ?? "");
  const secretBuf = Buffer.from(secret);
  return candidateBuf.length === secretBuf.length && timingSafeEqual(candidateBuf, secretBuf);
}
