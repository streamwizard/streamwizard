"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetcher, formatBytesPerSec } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import type { ObsInstanceSnapshot } from "@repo/metrics";

interface Props {
  initialData: ObsInstanceSnapshot[];
}

// One row per currently-running OBS instance — which node it's on, whose it
// is, and what it's using.
export function ObsInstanceTable({ initialData }: Props) {
  const { interval } = useRefreshInterval();
  const { data: raw } = useSWR<{ instanceSnapshot: ObsInstanceSnapshot[] }>("/api/metrics/obs", fetcher, {
    fallbackData: { instanceSnapshot: initialData },
    refreshInterval: interval,
  });

  const rows = raw?.instanceSnapshot ?? initialData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Running Instances</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instance</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Node</TableHead>
              <TableHead className="text-right">CPU</TableHead>
              <TableHead className="text-right">RAM</TableHead>
              <TableHead className="text-right">VRAM</TableHead>
              <TableHead className="text-right">Bandwidth (in/out)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No instances running
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.instanceId}>
                  <TableCell className="font-mono text-xs">{row.instanceId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.userId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.nodeId}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.cpuPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.ramUsedMb.toFixed(0)} / {row.ramLimitMb.toFixed(0)} MB
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.vramUsedMb.toFixed(0)} MB</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                    {formatBytesPerSec(row.rxBytesPerSec)} / {formatBytesPerSec(row.txBytesPerSec)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
