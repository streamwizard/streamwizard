import { expect, test } from "bun:test";
import { parseNodeTokenJwks } from "./node-token-jwks";

const publicKey = { kty: "OKP", crv: "Ed25519", x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo", kid: "k1", alg: "EdDSA" };

test("accepts Ed25519 public keys", () => {
  expect(parseNodeTokenJwks(JSON.stringify({ keys: [publicKey, { ...publicKey, kid: "k2" }] }))?.keys).toHaveLength(2);
});

test("refuses a private key", () => {
  expect(parseNodeTokenJwks(JSON.stringify({ keys: [{ ...publicKey, d: "secret" }] }))).toBeNull();
});

test("refuses keys without a kid, other key types and junk", () => {
  expect(parseNodeTokenJwks(JSON.stringify({ keys: [{ ...publicKey, kid: undefined }] }))).toBeNull();
  expect(parseNodeTokenJwks(JSON.stringify({ keys: [{ ...publicKey, kty: "oct", k: "abc" }] }))).toBeNull();
  expect(parseNodeTokenJwks(JSON.stringify({ keys: [] }))).toBeNull();
  expect(parseNodeTokenJwks("not json")).toBeNull();
});
