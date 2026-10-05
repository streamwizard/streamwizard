// InfluxDB layout: one org per environment (INFLUXDB_ORG = streamwizard-dev /
// streamwizard-staging / streamwizard-prod) and one bucket per writing service.
// Bucket names are the same in every org, so they live here instead of in env.
// A few buckets only exist in the prod org: see PROD_ONLY_BUCKETS.
export const BUCKETS = {
  restApi: "rest-api",
  wsServer: "ws-server",
  bot: "bot",
  autoSwitcher: "auto-switcher",
  ingestNodes: "ingest-nodes",
  obsNodes: "obs-nodes",
  supabasePlatform: "supabase-platform",
  vmBackups: "vm-backups",
  // Written by Proxmox VE itself (Datacenter → Metric Server), not by our code.
  proxmox: "proxmox",
  // Written by the Telegraf on the Dokploy server (telegraf repo, host/): the
  // host itself, every container on it and Traefik's request counters.
  webserver: "webserver",
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

export const ALL_BUCKETS: Bucket[] = Object.values(BUCKETS);

const PROD_ORG = "streamwizard-prod";

/**
 * Buckets only the prod org has. One Dokploy server runs prod and staging
 * side by side, and its Telegraf writes both into the prod org, so staging
 * and dev never get these. A query that names a bucket its org lacks fails
 * as a whole, hence bucketsInOrg() and orgHasBucket().
 */
export const PROD_ONLY_BUCKETS: readonly Bucket[] = [BUCKETS.webserver];

/** The buckets that exist in an org (default: the one this process reads). */
export function bucketsInOrg(org: string | undefined = process.env.INFLUXDB_ORG): Bucket[] {
  return org === PROD_ORG ? ALL_BUCKETS : ALL_BUCKETS.filter((b) => !PROD_ONLY_BUCKETS.includes(b));
}

export function orgHasBucket(bucket: Bucket, org: string | undefined = process.env.INFLUXDB_ORG): boolean {
  return bucketsInOrg(org).includes(bucket);
}

// Services that share a package writer (twitch-api, supabase) all write the
// same measurement into their own bucket, so readers union these.
const APP_BUCKETS: Bucket[] = [BUCKETS.restApi, BUCKETS.wsServer, BUCKETS.bot, BUCKETS.autoSwitcher];

/** Which buckets hold each measurement. Readers build their Flux source from this. */
export const MEASUREMENT_BUCKETS = {
  http_request: [BUCKETS.restApi, BUCKETS.ingestNodes],
  twitch_api_request: [...APP_BUCKETS, BUCKETS.ingestNodes],
  supabase_query: [...APP_BUCKETS, BUCKETS.ingestNodes],
  eventsub_event: [BUCKETS.restApi, BUCKETS.bot],
  eventsub_revocation: [BUCKETS.restApi, BUCKETS.bot],
  eventsub_connection: [BUCKETS.bot],
  eventsub_shard: [BUCKETS.bot],
  ws_connection: [BUCKETS.wsServer],
  ws_message: [BUCKETS.wsServer],
  ws_auth_failure: [BUCKETS.wsServer],
  ws_message_drop: [BUCKETS.wsServer],
  ws_room: [BUCKETS.wsServer],
  auto_switcher: [BUCKETS.autoSwitcher],
  host_system: [BUCKETS.ingestNodes],
  ingest_stream: [BUCKETS.ingestNodes],
  obs_node: [BUCKETS.obsNodes],
  obs_instance: [BUCKETS.obsNodes],
  obs_instance_event: [BUCKETS.obsNodes],
  prometheus: [BUCKETS.supabasePlatform],
  backup_datastore: [BUCKETS.vmBackups],
  backup_vm: [BUCKETS.vmBackups],
  backup_snapshot: [BUCKETS.vmBackups],
  // Proxmox VE's own InfluxDB plugin (docs/proxmox-monitoring-plan.md,
  // "InfluxDB schema (verified)"). "system" holds guests, nodes and storages,
  // told apart by the object tag (qemu|lxc|nodes|storages).
  system: [BUCKETS.proxmox],
  cpustat: [BUCKETS.proxmox],
  memory: [BUCKETS.proxmox],
  nics: [BUCKETS.proxmox],
  blockstat: [BUCKETS.proxmox],
  ballooninfo: [BUCKETS.proxmox],
  // Telegraf on the Dokploy server. The host inputs are renamed to server_*
  // because "system" is Proxmox and "host_system" the ingest nodes. Container
  // and Traefik series carry the tags service, app and env.
  server_cpu: [BUCKETS.webserver],
  server_mem: [BUCKETS.webserver],
  server_swap: [BUCKETS.webserver],
  server_system: [BUCKETS.webserver],
  server_disk: [BUCKETS.webserver],
  server_diskio: [BUCKETS.webserver],
  server_net: [BUCKETS.webserver],
  server_vmstat: [BUCKETS.webserver],
  docker_container_cpu: [BUCKETS.webserver],
  docker_container_mem: [BUCKETS.webserver],
  docker_container_net: [BUCKETS.webserver],
  docker_container_blkio: [BUCKETS.webserver],
  docker_container_status: [BUCKETS.webserver],
  docker_container_health: [BUCKETS.webserver],
  docker_swarm: [BUCKETS.webserver],
  docker: [BUCKETS.webserver],
  traefik: [BUCKETS.webserver],
} as const satisfies Record<string, readonly Bucket[]>;

export type Measurement = keyof typeof MEASUREMENT_BUCKETS;

// Flux refuses an unbounded from() inside union(), so the range goes on every
// branch rather than once after the union.
function fromBuckets(buckets: readonly string[], start: string): string {
  const sources = buckets.map((b) => `from(bucket: "${b}") |> range(start: ${start})`);
  return sources.length === 1 ? sources[0]! : `union(tables: [${sources.join(", ")}])`;
}

/**
 * Flux source for a measurement, already bounded by `range(start: <start>)`:
 * one from() when it lives in one bucket, a union of every bucket otherwise.
 * Callers still add their own _measurement filter after it.
 */
export function fluxFrom(measurement: Measurement, start: string): string {
  return fromBuckets(MEASUREMENT_BUCKETS[measurement], start);
}

/** Flux source over every bucket this org has, bounded like fluxFrom(). */
export function fluxFromAll(start: string): string {
  return fromBuckets(bucketsInOrg(), start);
}
