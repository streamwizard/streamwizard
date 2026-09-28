# Backup sizes on /backups (PBS + PVE)

Status: **built 2026-09-29** on `feat/backup-metrics` (PR #270). Unit-tested and run once read-only against the real PBS; not yet deployed or checked in a browser. Builds on `docs/backup-monitoring-plan.md`.

## Problem
The old "Size" column showed `SnapshotListItem.size`: the sum of the snapshot's files, i.e. the disk size (250 GiB for dokploy and obs-node-1). PBS deduplicates and compresses chunks, so that isn't what the backups use.

## Decisions (2026-09-29)
- Token gets **`DatastoreReader` on `/datastore/nas-backups/streamwizard`** (namespace path only). Store-level `DatastoreAudit` stays. Set by the user on PBS, verified live.
- Store-wide GC numbers (chunk store size, dedup factor) include homelab, so they aren't shown. The same numbers are worked out for our namespace only.
- Per-snapshot history goes to InfluxDB (all buckets have infinite retention).

## Research (proxmox-backup 4.2.7, qemu-server, pve-manager, pve-container, live PBS)
- PBS 4.2 has **no** per-group or per-snapshot unique size endpoint. Bug 5799 (sizes per group, worked out during GC) is RFC patches only.
- `download` / `download-decoded` need `Datastore.Read` (or `Datastore.Backup` + owner). With Audit only, live PBS answers `403 missing Datastore.Read|Datastore.Backup on /datastore/nas-backups/streamwizard`. The check is on the namespace path, so a namespace-scoped grant works and homelab stays closed.
- `DatastoreReader` = Audit + Read + **Verify**. PBS roles are fixed; there is no Read-only role.
- Manifest `index.json.blob` → `unprotected.chunk_upload_stats {count, size, compressed_size, duplicates}`, written by PBS at backup finish. `size` = uncompressed bytes uploaded, `compressed_size` = bytes sent after compression (duplicates included).
- Index files (4096-byte little-endian header):
  - `.fidx` (VM disks): magic `[47,127,65,237,145,253,15,205]`, `size u64` at offset 64, `chunk_size u64` at 72, then N × 32-byte SHA-256 digests. 250 GiB disk = 64,000 chunks = 2,052,096 bytes.
  - `.didx` (CT archives): magic `[28,145,78,165,25,186,179,205]`, then entries of `end u64 + digest[32]`.
- The digest is SHA-256 of the uncompressed chunk (unencrypted backups), so equal data has equal digests across snapshots and VMs.
- No API returns the compressed size of a single chunk, so on-disk bytes per VM are an **estimate**.
- A running backup is already in the snapshot list, but without `index.json.blob` (seen live on vm/102 and vm/104).
- PVE: VM config `size=` per disk (`K/M/G/T`, base 1024), `backup=0` excluded, cdrom skipped, `efidisk0` only with OVMF, `tpmstate0` included. LXC: rootfs always, `mpN` only with `backup=1`, bind mounts never. Needs `VM.Audit` (PVEAuditor has it).
- The vzdump task log lines (`reused X (Y%)`, `transferred …`) aren't used: the manifest stats are better.

### Rejected: "added vs the previous kept snapshot"
First built, then dropped after the live run. Snapshots are kept daily, then weekly and monthly, so the previous *kept* snapshot is often weeks older than the previous *run*. For dokploy's monthly snapshots it showed 129 GiB "added" while the run uploaded 0.18 GiB. Replaced by Uploaded (what the run sent) and Only in this snapshot (what pruning it frees).

## The numbers

| UI name | Meaning | Source | Stored |
|---|---|---|---|
| Disk | Configured size of the disks that get backed up | PVE config | `backup_poll_state` (guest `disks`) + Influx `backup_vm.disk_bytes` |
| Last upload / Uploaded | What a backup run sent to PBS, after compression | Manifest `chunk_upload_stats.compressed_size` | `backup_poll_state` (snapshot `usage`) + Influx `backup_snapshot` |
| Only in this snapshot | Data no other kept snapshot (of any of our VMs) uses, before compression; roughly what pruning it frees | Chunk digests of all kept snapshots | `backup_poll_state` (snapshot `usage`) |
| On disk ≈ (per VM) | (Unique − Shared) × the VM's compression ratio | Unique = every chunk its kept snapshots reference, once; Shared = chunks another of our VMs also uses; ratio = Σ compressed / Σ raw of the upload stats | `backup_poll_state` (`pbs.usage.groups`) + Influx `backup_vm` |
| Our backups on disk ≈ / dedup | Same for the whole namespace; dedup = Σ snapshot sizes / unique | Union across VMs | `backup_poll_state` (`pbs.usage.namespace`) + Influx `backup_datastore.ns_*` |
| NAS disk used | Filesystem total/used/free of the datastore (the whole NAS, not only PBS) | `/status` | unchanged |

Estimate caveat, in the UI tooltip: the ratio comes from the chunks each backup uploaded, not from every chunk it references.

## How it works

### Usage pass (rest-api, part of the PBS fetch)
1. The snapshot list comes in as before. Snapshots without a manifest (still running) are left out.
2. Fingerprint = hash of the sorted `type/id/time` list. Same as last poll and every snapshot has usage → reuse, **no downloads**.
3. Changed (a new backup or a prune, about once or twice a day) → for every kept snapshot, one at a time:
   - `download` (raw) of each `.fidx` / `.didx` → digest list, fed into the accumulator, then dropped.
   - `download-decoded` of `index.json.blob` → upload stats, only when the previous poll has none for that snapshot (they never change).
4. Totals per VM, per snapshot and for the namespace.
5. 60 s timeout per download, 64 MB per index, 256 MB per pass. Any failure is a warning on the PBS source (`usage: vm/102/…: …`) and keeps the previous values; snapshot health doesn't depend on it.

Cost, measured live 2026-09-29 (5 VMs, 38 snapshots): one changed pass ≈ 40 MB of index files in 17–37 s. An unchanged poll adds nothing. PBS only reads index files, never chunks.

### PVE config
Each poll, per host: `GET /nodes/{node}/{qemu|lxc}/{vmid}/config` for guests in our jobs only. Only the parsed disks are kept, never the raw config.

### Safety
- `proxmox-client.ts` `getRaw()`: still GET only, streams with a byte cap.
- `downloadSnapshotFile()` is the only caller of the download endpoints. Allowlist: `index.json.blob` via `download-decoded`; `*.fidx` / `*.didx` via `download`. Everything else is refused. Tests pin this: `download-decoded` of an index would stream the whole disk image.
- `ns` always comes from config, never from a request.

## Load on Supabase
`backup_poll_state` grows by about 5 KB (3 numbers × ~38 snapshots, per-VM and namespace usage, disks). No new tables. alert-worker reads the row every 3 min (≈ 70 MB/month extra); rest-api serves it from its 30 s cache.

## Live check (2026-09-29, read-only)
- Permissions: `/datastore/nas-backups` → Audit; `/datastore/nas-backups/streamwizard` → Audit + Read + Verify.
- Namespace: 4,794 GiB of snapshots, 935 GiB unique, ≈ 286 GiB on disk, 5.1× dedup. For comparison, the whole store (incl. homelab) is 462 GiB on disk at the last GC.
- Per VM on disk ≈: dokploy 271 GiB, pfsense 17 GiB, obs-node-1 7 GiB, vm/102 4 GiB.
- Digest diff of the newest two snapshots matched the upload stats (pfsense 1243 vs 1244 chunks, dokploy 2219 vs 2208).
- Side finding: pfsense uploads ~0.9 GiB (≈ 5 GiB before compression) every day, almost a full copy of its data. Worth a look.
