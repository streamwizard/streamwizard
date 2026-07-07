"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetcher } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import type { ActiveIngestSignal } from "@repo/metrics";

interface Props {
  initialData: ActiveIngestSignal[];
}

// One row per currently-active incoming signal — a user with two cameras
// (two stream keys) shows up as two rows here, grouped visually by user_id.
export function ActiveSignalsTable({ initialData }: Props) {
  const { interval } = useRefreshInterval();
  const { data: raw } = useSWR<{ activeSignals: ActiveIngestSignal[] }>("/api/metrics/ingest", fetcher, {
    fallbackData: { activeSignals: initialData },
    refreshInterval: interval,
  });

  const rows = raw?.activeSignals ?? initialData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Active Incoming Signals</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead className="text-right">Bitrate</TableHead>
              <TableHead className="text-right">Last Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No active signals
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.streamKeyId}>
                  <TableCell className="font-mono text-xs">{row.userId}</TableCell>
                  <TableCell className="text-xs">{row.label}</TableCell>
                  <TableCell className="text-xs uppercase">{row.protocol}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.kbps.toFixed(0)} kbps</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                    {new Date(row.lastSeen).toLocaleTimeString()}
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
