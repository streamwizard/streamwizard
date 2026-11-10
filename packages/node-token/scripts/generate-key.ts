import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";

// Generates one Ed25519 key pair for node tokens. Run once per environment
// (dev, staging, prod), never once per node:
//
//   bun packages/node-token/scripts/generate-key.ts <out-dir>
//
// Writes two files and prints neither:
//   signing.jwk  -> NODE_TOKEN_SIGNING_JWK  (web-admin, web-streamwizard; secret)
//   public.jwks  -> NODE_TOKEN_PUBLIC_JWKS  (rest-api; not secret)
//
// Upload straight from the file, e.g.
//   doppler secrets set NODE_TOKEN_SIGNING_JWK -p <project> -c <config> < signing.jwk
// then delete the out dir. To rotate, append the new public key to the
// existing NODE_TOKEN_PUBLIC_JWKS "keys" array first, deploy rest-api, then
// switch the signing key, and drop the old public key a minute later.

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: bun scripts/generate-key.ts <out-dir>");
  process.exit(1);
}

const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
const publicJwk = await exportJWK(publicKey);
const kid = await calculateJwkThumbprint(publicJwk);

const signing = { ...(await exportJWK(privateKey)), kid, alg: "EdDSA" };
const jwks = { keys: [{ ...publicJwk, kid, alg: "EdDSA", use: "sig" }] };

mkdirSync(outDir, { recursive: true, mode: 0o700 });
const signingPath = join(outDir, "signing.jwk");
writeFileSync(signingPath, JSON.stringify(signing), { mode: 0o600 });
chmodSync(signingPath, 0o600);
writeFileSync(join(outDir, "public.jwks"), JSON.stringify(jwks));

console.log(`kid ${kid}: wrote signing.jwk and public.jwks to ${outDir}`);
