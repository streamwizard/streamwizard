import { headers } from "next/headers";

/**
 * Renders a JSON-LD block carrying the per-request CSP nonce.
 *
 * Browsers treat `application/ld+json` as an inline script under `script-src`,
 * and our policy (src/lib/csp.ts) allows no 'unsafe-inline' and no hashes, so an
 * un-nonced block is refused outright. Development sends the policy as
 * Report-Only, which means a missing nonce looks fine locally and only breaks
 * once deployed. Always render schema through this component rather than
 * hand-rolling a <script> tag.
 */
export async function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // Escaping "<" keeps a "</script>" substring from closing the tag early. Our
  // schema is static today, but this stays correct if a value ever comes from
  // the database.
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");

  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />;
}
