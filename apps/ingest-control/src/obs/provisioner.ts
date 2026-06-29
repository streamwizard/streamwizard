import { env } from "../lib/env";

// Minimal Docker Engine API client over the mounted unix socket. Bun's fetch
// supports a `unix` option, so we talk to dockerd directly without a dependency.
// One OBS container is provisioned per active streamer. The container LISTENS
// for SRT on INGEST_OBS_SRT_PORT; the media plane pushes the passthrough feed
// into it as the SRT caller, addressing the container by name on the network.

const DOCKER_API_VERSION = "v1.43";

async function docker(path: string, init?: RequestInit & { unix?: string }): Promise<Response> {
  return fetch(`http://localhost/${DOCKER_API_VERSION}${path}`, {
    ...init,
    unix: env.DOCKER_SOCKET, // Bun-specific fetch option: talk to dockerd over its socket
  });
}

/** Deterministic container name for a streamer's OBS instance. */
export function obsContainerName(userId: string): string {
  return `sw-obs-${userId}`;
}

/** True when we manage a per-streamer OBS container (production model). */
export function isObsPushMode(): boolean {
  return env.INGEST_OUTPUT_MODE === "obs-push";
}

/**
 * Where the media plane should send the passthrough feed.
 *  - obs-push: push to the streamer's OBS container (OBS listens).
 *  - srt-listener: expose an SRT listener the consumer (e.g. local OBS) pulls.
 */
export function tenantOutputTarget(userId: string): string {
  if (env.INGEST_OUTPUT_MODE === "srt-listener") {
    return `srt://${env.INGEST_OUTPUT_HOST}:${env.INGEST_OUTPUT_PORT}?mode=listener`;
  }
  return `srt://${obsContainerName(userId)}:${env.INGEST_OBS_SRT_PORT}?mode=caller`;
}

/** SRT URL the OBS container listens on for its media source. */
function obsListenUrl(): string {
  return `srt://0.0.0.0:${env.INGEST_OBS_SRT_PORT}?mode=listener`;
}

async function removeExisting(name: string): Promise<void> {
  // Force-remove any stale container with this name (e.g. a crashed prior session).
  const res = await docker(`/containers/${name}?force=true`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    console.warn(`[obs] failed to remove stale container ${name}: ${res.status} ${await res.text()}`);
  }
}

/**
 * Start (or restart) the OBS container for a streamer. The container listens for
 * SRT; the media plane pushes the feed to tenantOutputTarget(userId).
 */
export async function provisionObs(userId: string): Promise<{ containerName: string; listenUrl: string }> {
  const name = obsContainerName(userId);
  const listenUrl = obsListenUrl();

  await removeExisting(name);

  const createRes = await docker(`/containers/create?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Image: env.INGEST_OBS_IMAGE,
      Env: [`INPUT_URL=${listenUrl}`, `SW_USER_ID=${userId}`],
      Labels: { "streamwizard.role": "obs", "streamwizard.user_id": userId },
      HostConfig: {
        NetworkMode: env.INGEST_OBS_NETWORK,
        RestartPolicy: { Name: "unless-stopped" },
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error(`docker create failed: ${createRes.status} ${await createRes.text()}`);
  }

  const { Id } = (await createRes.json()) as { Id: string };
  const startRes = await docker(`/containers/${Id}/start`, { method: "POST" });
  if (!startRes.ok && startRes.status !== 304) {
    throw new Error(`docker start failed: ${startRes.status} ${await startRes.text()}`);
  }

  console.log(`[obs] provisioned ${name} listening on ${listenUrl}`);
  return { containerName: name, listenUrl };
}

/** Stop and remove a streamer's OBS container when their session ends. */
export async function deprovisionObs(userId: string): Promise<void> {
  const name = obsContainerName(userId);
  const stopRes = await docker(`/containers/${name}/stop?t=5`, { method: "POST" });
  if (!stopRes.ok && stopRes.status !== 304 && stopRes.status !== 404) {
    console.warn(`[obs] stop ${name} returned ${stopRes.status}`);
  }
  await removeExisting(name);
  console.log(`[obs] deprovisioned ${name}`);
}
