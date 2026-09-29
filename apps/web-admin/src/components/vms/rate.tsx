"use client";

import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import { formatBandwidth } from "@/lib/utils";

/** A bytes-per-second rate in the unit picked in the header (bits or bytes). */
export function Rate({ bps }: { bps: number | null | undefined }) {
  const { unit } = useBandwidthUnit();
  return <>{bps == null ? "—" : formatBandwidth(bps, unit)}</>;
}
