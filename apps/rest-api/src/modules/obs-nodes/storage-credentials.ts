import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { TtlCache } from "@repo/ttl-cache";
import { env } from "@/env";
import { isGuid } from "@repo/schemas/ids";

// Temporary MinIO credentials for OBS nodes. rest-api holds the long-lived OBS
// storage key; a node only ever gets short-lived keys from MinIO's STS
// AssumeRole, cut down by a session policy to one instance's folders (or to
// read-only shared files). MinIO grants the intersection of the session policy
// and the calling user's own policy, so a session can never do more than the
// rest-api key itself.

export const STORAGE_CREDENTIAL_SECONDS = 60 * 60;

export interface StorageCredentials {
  access_key_id: string;
  secret_access_key: string;
  session_token: string;
  /** ISO time the credentials stop working. */
  expires_at: string;
}

type Statement = {
  Effect: "Allow";
  Action: string[];
  Resource: string[];
  Condition?: Record<string, Record<string, string[]>>;
};

export interface StoragePolicy {
  Version: "2012-10-17";
  Statement: Statement[];
}


/** The folders one instance owns. Must match obs-instance-manager's s3Prefix /
 *  s3MediaPrefix (services/storage/obs-config/paths.ts). */
export function instancePrefixes(userId: string, instanceId: string): string[] {
  // Both ids land inside a policy; a "*" or "/" would widen it.
  if (!isGuid(userId) || !isGuid(instanceId)) throw new Error("user and instance ids must be UUIDs");
  return [`obs-configs/${userId}/${instanceId}/`, `obs-media/${userId}/${instanceId}/`];
}

/** Shared, read-only folders every node needs: OBS templates and plugins. */
export const SHARED_PREFIXES = ["obs-templates/", "plugins/"] as const;

function listStatement(bucket: string, prefixes: readonly string[]): Statement {
  return {
    Effect: "Allow",
    Action: ["s3:ListBucket"],
    Resource: [`arn:aws:s3:::${bucket}`],
    Condition: { StringLike: { "s3:prefix": prefixes.map((p) => `${p}*`) } },
  };
}

/** Read, write and delete inside one instance's config and media folders. */
export function instanceStoragePolicy(bucket: string, userId: string, instanceId: string): StoragePolicy {
  const prefixes = instancePrefixes(userId, instanceId);
  return {
    Version: "2012-10-17",
    Statement: [
      listStatement(bucket, prefixes),
      {
        Effect: "Allow",
        Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"],
        Resource: prefixes.map((p) => `arn:aws:s3:::${bucket}/${p}*`),
      },
    ],
  };
}

/** Read-only access to templates and plugins. */
export function sharedStoragePolicy(bucket: string): StoragePolicy {
  return {
    Version: "2012-10-17",
    Statement: [
      listStatement(bucket, SHARED_PREFIXES),
      {
        Effect: "Allow",
        Action: ["s3:GetObject"],
        Resource: SHARED_PREFIXES.map((p) => `arn:aws:s3:::${bucket}/${p}*`),
      },
    ],
  };
}

// The same credentials are handed out again while they have at least this long
// left, so a node asking in a loop costs one STS call per hour, not one per
// request.
const REUSE_MIN_LEFT_MS = 30 * 60 * 1000;
const issued = new TtlCache<StorageCredentials>({ ttlMs: REUSE_MIN_LEFT_MS, maxEntries: 5_000 });
const inflight = new Map<string, Promise<StorageCredentials>>();

/**
 * Credentials for `cacheKey` (node + instance, or node + "shared"), from the
 * cache or a fresh AssumeRole. Concurrent callers share one STS call.
 */
export function getStorageCredentials(
  cacheKey: string,
  policy: () => StoragePolicy,
  assume: (policy: StoragePolicy) => Promise<StorageCredentials> = assumeStorageRole,
): Promise<StorageCredentials> {
  const cached = issued.get(cacheKey);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const load = (async () => {
    try {
      const creds = await assume(policy());
      const reuseUntil = Date.parse(creds.expires_at) - REUSE_MIN_LEFT_MS;
      if (reuseUntil > Date.now()) issued.set(cacheKey, creds, { expiresAt: reuseUntil });
      return creds;
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, load);
  return load;
}

/** Test-only. */
export function resetStorageCredentialCache(): void {
  issued.clear();
  inflight.clear();
}

let sts: STSClient | null = null;

function stsClient(): STSClient {
  sts ??= new STSClient({
    endpoint: env.OBS_S3_ENDPOINT,
    region: env.OBS_S3_REGION,
    credentials: { accessKeyId: env.OBS_S3_ACCESS_KEY, secretAccessKey: env.OBS_S3_SECRET_KEY },
  });
  return sts;
}

/** Asks MinIO for temporary credentials limited to `policy`. Throws on failure. */
export async function assumeStorageRole(policy: StoragePolicy): Promise<StorageCredentials> {
  const res = await stsClient().send(
    new AssumeRoleCommand({
      // MinIO ignores the role; AWS's API requires the fields.
      RoleArn: "arn:xxx:xxx:xxx:xxxx",
      RoleSessionName: "obs-node",
      DurationSeconds: STORAGE_CREDENTIAL_SECONDS,
      Policy: JSON.stringify(policy),
    }),
  );
  const creds = res.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken || !creds.Expiration) {
    throw new Error("STS returned no credentials");
  }
  return {
    access_key_id: creds.AccessKeyId,
    secret_access_key: creds.SecretAccessKey,
    session_token: creds.SessionToken,
    expires_at: creds.Expiration.toISOString(),
  };
}
