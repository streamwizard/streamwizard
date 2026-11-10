import { z } from "zod";
import { SERVICE_NAMES } from "./index";

// A service's public key set as the receiving app reads it from env
// (WS_SERVICE_JWKS, REST_API_SERVICE_JWKS, DISCORD_BOT_SERVICE_JWKS):
// Ed25519 public keys only, each with the kid services put in the token
// header and the service (`svc`) it belongs to. A key carrying "d" is private
// material and is refused outright. Other JWK fields (alg, use) are kept.

const serviceJwkSchema = z
  .looseObject({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    x: z.string().min(1).max(128),
    kid: z.string().min(1).max(128),
    svc: z.enum(SERVICE_NAMES),
  })
  .refine((key) => !("d" in key), "a service JWKS must hold public keys only");

export const serviceJwksSchema = z.object({
  keys: z.array(serviceJwkSchema).min(1).max(64),
});

/** The JSON text of a service JWKS env var, parsed and checked. For env schemas. */
export function serviceJwksJson(envName: string) {
  return z
    .string()
    .min(1)
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: `${envName} is not valid JSON` });
        return z.NEVER;
      }
    })
    .pipe(serviceJwksSchema);
}

/** WS_SERVICE_JWKS (ws-server). */
export const serviceJwksJsonSchema = serviceJwksJson("WS_SERVICE_JWKS");
