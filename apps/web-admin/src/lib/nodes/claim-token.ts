import { createHash, randomBytes } from "crypto";

// Shared by the OBS-node and ingest-node create actions: a one-time claim
// token (only its hash is stored) and the install command that hands it to
// the box.

export interface ClaimToken {
  rawToken: string;
  tokenHash: string;
  /** ISO time the claim stops working. */
  expiresAt: string;
}

export function generateClaimToken(ttlMs: number): ClaimToken {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash, expiresAt: new Date(Date.now() + ttlMs).toISOString() };
}

/** `curl … install.sh | sudo bash` for one of our node repos on GitHub. */
export function nodeInstallCommand(repo: "obs-instance-manager" | "ingest-server", restApiUrl: string, rawToken: string): string {
  return (
    `curl -fsSL https://raw.githubusercontent.com/streamwizard/${repo}/main/scripts/install.sh \\\n` +
    `  | sudo bash -s -- --rest-api-url=${restApiUrl} --token=${rawToken} --start`
  );
}
