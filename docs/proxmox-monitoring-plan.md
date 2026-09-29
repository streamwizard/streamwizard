# Proxmox VM monitoring

VM state in web-admin next to `/backups`. Influx is the source of truth:
Proxmox's own External Metric Server pushes every guest (stopped ones too)
and every node to the `proxmox` bucket every ~10 s. There is no poller and
no copy in Supabase. The few things Influx can't give are read from the PVE
API when a page renders.

## Where each thing comes from

| What | Source |
|---|---|
| Guest list, status, tags, uptime | Influx `system` (`status` and `tags` are string fields) |
| CPU, RAM, held on host, balloon, PSI, net and disk IO, per drive and NIC | Influx `system`, `ballooninfo`, `blockstat`, `nics` |
| Host CPU, load, RAM, swap, root disk, NICs, storages | Influx `cpustat`, `memory`, `blockstat`, `nics`, `system` (storages) |
| "Stale" / "last report" | the time of the newest push; older than 90 s is marked stale on the page. The VM pages re-render at the header's refresh interval |
| Guest IPs, agent state (ok/off/error) | PVE API on demand (`apps/web-admin/src/lib/pve.ts`) |
| Qemu disk use | guest agent `get-fsinfo`, same on-demand call. PVE's own `disk` is 0 for qemu; LXC uses it |
| Per-VM alert opt-ins | Supabase `proxmox_vm_alert_settings` (the only table) |

### On-demand PVE calls (web-admin)

Only for running guests, with `PVE_HOSTS` set in web-admin's env (same JSON
as rest-api's). Pages render from Influx first; these stream in under
Suspense.

| Call | For |
|---|---|
| `GET /nodes/{n}/qemu/{vmid}/config` | is `agent` enabled |
| `GET /nodes/{n}/qemu/{vmid}/agent/network-get-interfaces` | guest IPv4s |
| `GET /nodes/{n}/qemu/{vmid}/agent/get-fsinfo` | qemu disk use, summed over real filesystems |
| `GET /nodes/{n}/lxc/{vmid}/interfaces` | container IPv4s |

- Each call times out after 2.5 s, at most 8 in parallel, results cached
  30 s per guest. A failure only means "—" in those columns.
- IPs: IPv4 only, no loopback, link-local or container bridges (`docker*`,
  `br-*`, `veth*`, …), deduped and sorted.
- Parsers and the read-only PVE client live in `packages/proxmox`, shared
  with rest-api's backup poller.

### Permissions and env

- PVE token `sw-monitor@pve!rest-api` (PVEAuditor) also needs guest agent
  access on `/vms`: `VM.GuestAgent.Audit` on PVE 9, `VM.Monitor` on PVE 8.
  Without it every VM with an agent shows `error`.
- web-admin needs `PVE_HOSTS` (secret) and network access to the PVE hosts
  over Tailscale, like rest-api.

## InfluxDB schema (verified)

Checked against prod on 2026-09-29: bucket `proxmox`, org
`streamwizard-prod`, PVE with QEMU 10.1/11.0. PVE pushes every 10 s.

PVE node names: `pve`, `pve1` == PVE_HOSTS[].name. vmids collide across hosts (100 on both) → guest key MUST be `${nodename}:${vmid}`.
Only qemu guests exist today (no lxc), but keep lxc support.
String fields exist inside numeric measurements → always filter _field before pivot/math.

### Guests (object=qemu), tags: host (= guest name), nodename, object, vmid
- system: cpu (0-1 fraction of cpus), cpus, mem, maxmem, memhost, balloon, freemem, disk (0 for qemu), maxdisk, diskread, diskwrite, netin, netout (cumulative byte counters), uptime (s), pressurecpusome/full, pressureiosome/full, pressurememorysome/full (PSI %), pid; STRING: status, qmpstatus, name, lock, tags, running-machine, running-qemu
- ballooninfo: actual, max_mem, total_mem, free_mem, mem_swapped_in, mem_swapped_out, major_page_faults, minor_page_faults (counters), last_update
- blockstat (+tag instance = drive e.g. scsi0, sata0, ide2): rd_bytes, wr_bytes, rd_operations, wr_operations, flush_operations, rd_total_time_ns, wr_total_time_ns, flush_total_time_ns, failed_*_operations, invalid_*, unmap_*, idle_time_ns, wr_highest_offset (all counters)
- nics (+tag instance = tapNNNiX): netin, netout (counters)
- proxmox-support: string fields only (ignore)

### Hosts (object=nodes), tags: host (= node name, pve/pve1), object  — NO nodename tag
- system: uptime
- cpustat: cpu (0-1), cpus, avg1, avg5, avg15, wait (0-1 iowait fraction), user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice, total, used (jiffy counters)
- memory: memtotal, memused, memfree, memavailable, memshared, swaptotal, swapused, swapfree, arcsize, arcmin, arcmax
- blockstat (root fs, no instance): blocks (total bytes), used, bavail, bfree, per (% used), files, fused, ...
- nics (+tag instance: enp8s0, fwbr*, fwln*, tap*, vmbr*...): receive, transmit (counters); STRING field type (physical/virtual/...)

### Storages (measurement system, object=storages), tags: host (= storage name), nodename, object, type (dir, lvmthin, pbs, ...)
- total, used, avail (bytes), active, enabled, shared (0/1); STRING content
Storages seen: pve: local, local-lvm, pbs-nas, pbs-streamwizard; pve1: Disk2, local, pbs

### Things that bit us

- `mem` for a qemu guest is balloon `total_mem − free_mem`, so it counts
  the guest's page cache as used (a VM showing 9.4 GiB can be ~3 GiB in
  htop). The UI calls it "RAM (incl. cache)". `memhost` is what the QEMU
  process holds on the host, often the full `maxmem`.
- VMs without balloon stats have no `ballooninfo` rows at all.
- A node's `memused` is `memtotal − memavailable`, so page cache doesn't
  count there. `total` in `cpustat` = user + nice + system + idle + iowait
  + irq + softirq + steal + guest + guest_nice (guest time is not inside
  user); `used` = total − idle − iowait.
- Storages carry a string field `type` next to the `type` tag, and a string
  `content`. Never pivot storages without filtering `_field` first.
- `lock` and `tags` only exist while set, so the header reads them from
  the newest push only.
- PBS storages show up once per node (`pbs`, `pbs-nas`,
  `pbs-streamwizard` are the same datastore).

## Queries

All in `packages/metrics/src/queries/proxmox-queries.ts` (alert reads in
`alert-queries.ts`). Host, storage and drive names are checked against
`/^[A-Za-z0-9._-]+$/` and vmids are positive integers before they go into
Flux.

| Function | What | Cost |
|---|---|---|
| `queryProxmoxGuestSnapshot(host?)` | latest per guest: CPU, vCPUs, RAM, memhost, balloon, PSI some, net/disk rates | one query, `last()` + 3 min mean rate, no pivot |
| `queryProxmoxGuestSparklines(range, window, host?)` | CPU % and net in+out per guest, for the tables | one query, all guests |
| `queryProxmoxGuestInfo(host, vmid)` | status, qmpstatus, QEMU version, machine, lock, tags, vCPUs, pid | `last()` over string fields, cast to string |
| `queryProxmoxGuestHistory(host, vmid, range, window)` | every guest chart: CPU, RAM, PSI, net, disk, swap, page faults, per-drive bytes/IOPS/latency, per-NIC | one query: gauges `aggregateWindow(mean)`, counters `derivative(nonNegative, 1s)` then mean |
| `queryProxmoxNodeSnapshot(host?)` | latest per node: CPU, load, RAM, swap, ARC, root fs, uptime | one query, `last()` |
| `queryProxmoxNodeHistory(host, range, window)` | every host chart: CPU, CPU by kind, load, RAM, swap, root fs %, per-NIC, storage % | one query: gauges, NIC rates, and `difference()` + window sum for the CPU split |
| `queryProxmoxStorages(host?)` | latest per storage: total/used/avail, active, enabled, shared, content | one query, `last()` |
| `queryLatestProxmoxGuests(range)` / `queryLatestProxmoxNodes(range)` | the guest and host lists with status, tags and last push, for the pages and the alerts | `last()` per field over the range (1 h for alerts, 24 h for the pages) |

Drive latency = rate of `*_total_time_ns` / rate of `*_operations` in the
same window (ms per op), only where ops > 0. Drives with no ops in the
range are left out.

## web-admin

- `/vms`: host cards (CPU, RAM, load, storages, last report) linking to the
  host page, then "StreamWizard VMs" (tagged `streamwizard`) and a folded
  "Other VMs". The guest tables sort on the numbers, filter by host and
  status, and show 1 h CPU and network sparklines. Guests Proxmox stopped
  reporting stay listed for 24 h, dimmed with "last seen".
- `/vms/hosts/[host]`: uptime, CPU and IO wait, load 1/5/15, RAM, RAM held
  by VMs (sum of running guests' `memhost`), swap, root disk, ZFS ARC,
  storages table, the host's guests, and charts.
- `/vms/[host]/[vmid]`: header facts (PVE and QEMU status, QEMU version,
  machine, lock, tags), last report, IPs and agent state, CPU, RAM (incl.
  cache), held on host, disk, IO pressure, charts, and the alert switches
  (tagged VMs only).
- Chart refresh: `GET /api/metrics/vms?host=…[&vmid=…]&range=…&window=…`,
  admin session required.

## Alerts

All from Influx, prod only. A guest or node silent for 90 s counts as
gone; its guests' and storages' other alerts are skipped while its host
alert fires. `vm.down` and `vm.host_unreachable` fire on the first tick,
so with the worker's 60 s tick an alert goes out within about a minute of
Proxmox's next push. pve1's pushes go through pfSense, so a pfSense restart
silences all of pve1 for as long as it takes.

Per-VM, opt-in on the VM page, only for guests tagged `streamwizard`:
`vm.down` (status not running, or no report for 90 s), `vm.cpu_high`,
`vm.mem_high` (on `mem`, so it includes cache), `vm.io_pressure_high` (PSI
io some, 20/40 %).

Always on: `vm.host_unreachable` (a node that pushed in the last hour but
not in the last 90 s), `vm.host_cpu_high` (85/95 %), `vm.host_mem_high`
(90/97 %, used = total − available), `vm.storage_high` (85/95 %, per
`<host>:<storage>`; skips PBS storages since `backup.datastore_usage`
covers them, inactive/disabled storages, and repeats of a shared storage).

Not alerted: IP changes and VM disk use (the alert worker has no PVE API
access).
