import { z } from "zod";

// NODE_TOKEN_PUBLIC_JWKS, checked before it can reach a node: Ed25519 public
// keys only, each with the kid the web apps put in the token header. A key
// carrying "d" is private material and is refused outright.
const schema = z.object({
  keys: z
    .array(
      z
        .object({ kty: z.literal("OKP"), crv: z.literal("Ed25519"), x: z.string().min(1), kid: z.string().min(1) })
        .passthrough()
        .refine((key) => !("d" in key), "private key material"),
    )
    .min(1),
});

export type NodeTokenJwks = z.infer<typeof schema>;

export function parseNodeTokenJwks(raw: string): NodeTokenJwks | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
