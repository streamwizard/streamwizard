import { z } from "zod";
import { SERVICE_NAMES } from "./index";

// WS_SERVICE_JWKS as ws-server reads it: Ed25519 public keys only, each with
// the kid services put in the token header and the service (`svc`) it belongs
// to. A key carrying "d" is private material and is refused outright. Other
// JWK fields (alg, use) are kept.

const serviceJwkSchema = z
  .looseObject({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    x: z.string().min(1).max(128),
    kid: z.string().min(1).max(128),
    svc: z.enum(SERVICE_NAMES),
  })
  .refine((key) => !("d" in key), "WS_SERVICE_JWKS must hold public keys only");

export const serviceJwksSchema = z.object({
  keys: z.array(serviceJwkSchema).min(1).max(64),
});

/** The JSON text of WS_SERVICE_JWKS, parsed and checked. For env schemas. */
export const serviceJwksJsonSchema = z
  .string()
  .min(1)
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "WS_SERVICE_JWKS is not valid JSON" });
      return z.NEVER;
    }
  })
  .pipe(serviceJwksSchema);
