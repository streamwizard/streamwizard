"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { Badge } from "@repo/ui";
import { Progress } from "@repo/ui";
import { motion } from "framer-motion";

interface AdSchedule {
  snooze_count: number;
  snooze_refresh_at: string;
  next_ad_at: string;
  duration: number;
  last_ad_at: string;
  preroll_free_time: number;
}

/**
 * Twitch returns these timestamps as Unix epoch *seconds* (integer strings or numbers).
 * Multiply by 1000 to get milliseconds for the Date constructor.
 */
function parseTimestamp(value?: string | number): Date | null {
  if (!value) return null;
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num) || num === 0) return null;
  // If the number looks like seconds (< year 3000 in ms), multiply by 1000
  return new Date(num < 1e12 ? num * 1000 : num);
}

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 60) return diffSec >= 0 ? `in ${absSec}s` : `${absSec}s ago`;
  if (absSec < 3600) {
    const m = Math.round(absSec / 60);
    return diffSec >= 0 ? `in ${m}m` : `${m}m ago`;
  }
  const h = Math.round(absSec / 3600);
  return diffSec >= 0 ? `in ${h}h` : `${h}h ago`;
}

function formatAbsolute(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

interface TimestampCellProps {
  label: string;
  value?: string | number;
  past?: boolean;
}

function TimestampCell({ label, value, past = false }: TimestampCellProps) {
  const [, setTick] = useState(0);

  // Re-render every 30s so relative times stay current
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const date = parseTimestamp(value);
  const relative = formatRelative(date);
  const absolute = formatAbsolute(date);

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {date ? (
        <>
          <p className="font-medium">{past ? absolute : relative}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{past ? relative : absolute}</p>
        </>
      ) : (
        <p className="font-medium text-muted-foreground">Not scheduled</p>
      )}
    </div>
  );
}

export default function TwitchAdScheduleDashboard({ adSchedule }: { adSchedule: AdSchedule }) {
  const [data] = useState<AdSchedule | null>(adSchedule);

  const prerollPercentage = data ? Math.min((data.preroll_free_time / 1800) * 100, 100) : 0;

  const prerollFormatted = data?.preroll_free_time ? formatDuration(data.preroll_free_time) : "0s";

  return (
    <div className="p-6 flex justify-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-3xl">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Ad Schedule Overview</CardTitle>
            <Badge variant={data?.preroll_free_time ? "default" : "secondary"}>{data?.preroll_free_time ? "Pre-roll Ad-Free" : "Pre-roll Ads Enabled"}</Badge>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Pre-roll Section */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Remaining Pre-roll Free Time</p>
              <p className="text-3xl font-semibold">{prerollFormatted}</p>
              <Progress value={prerollPercentage} />
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Grid Info */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <TimestampCell label="Next Ad" value={data?.next_ad_at} />
                <div>
                  <p className="text-sm text-muted-foreground">Ad Duration</p>
                  <p className="font-medium">{formatDuration(data?.duration ?? 0)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <TimestampCell label="Last Ad" value={data?.last_ad_at} past />
                <div>
                  <p className="text-sm text-muted-foreground">Snoozes Available</p>
                  <p className="font-medium">{data?.snooze_count ?? 0}</p>
                </div>
                <TimestampCell label="Next Snooze Refresh" value={data?.snooze_refresh_at} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
