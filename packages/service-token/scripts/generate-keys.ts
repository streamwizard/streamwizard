import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { SERVICE_NAMES } from "../src/index";

// Generates one Ed25519 key pair per service that calls ws-server, for ONE
// environment:
//
//   bun packages/service-token/scripts/generate-keys.ts <out-dir>
//
// Writes, and prints none of:
//   <service>.signing.jwk -> WS_SERVICE_SIGNING_JWK in that service's config (secret)
//   public.jwks           -> WS_SERVICE_JWKS in ws-server's config (not secret)
//
// Upload straight from the files, e.g.
//   doppler secrets set WS_SERVICE_SIGNING_JWK -p <project> -c <config> < rest-api.signing.jwk
// then delete the out dir. To rotate one service, generate a new pair for it,
// add its public key to WS_SERVICE_JWKS next to the old one, deploy
// ws-server, switch the service's signing key, then drop the old public key.

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: bun scripts/generate-keys.ts <out-dir>");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true, mode: 0o700 });
const publicKeys = [];

for (const svc of SERVICE_NAMES) {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);

  const signingPath = join(outDir, `${svc}.signing.jwk`);
  writeFileSync(signingPath, JSON.stringify({ ...(await exportJWK(privateKey)), kid, alg: "EdDSA", svc }), {
    mode: 0o600,
  });
  chmodSync(signingPath, 0o600);
  publicKeys.push({ ...publicJwk, kid, alg: "EdDSA", use: "sig", svc });
  console.log(`${svc}: kid ${kid}`);
}

writeFileSync(join(outDir, "public.jwks"), JSON.stringify({ keys: publicKeys }));
console.log(`wrote ${SERVICE_NAMES.length} signing keys and public.jwks to ${outDir}`);
