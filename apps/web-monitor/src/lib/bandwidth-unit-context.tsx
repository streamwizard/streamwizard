"use client";

import { createContext, useContext, useState } from "react";
import type { BandwidthUnit } from "./utils";

// Global toggle for how every bandwidth readout renders — bits/s (Mbit/s, the
// stream-operator default) or bytes/s (KB/MB/s). Mirrors time-range-context:
// one provider at the monitor layout, consumed by the bandwidth charts and the
// OBS node/instance tables. Like the sibling controls it lives in memory only,
// resetting to the default on a full reload.

const DEFAULT_UNIT: BandwidthUnit = "bits";

type BandwidthUnitContextValue = {
  unit: BandwidthUnit;
  setUnit: (unit: BandwidthUnit) => void;
  toggle: () => void;
};

const BandwidthUnitContext = createContext<BandwidthUnitContextValue>({
  unit: DEFAULT_UNIT,
  setUnit: () => {},
  toggle: () => {},
});

export function BandwidthUnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnit] = useState<BandwidthUnit>(DEFAULT_UNIT);
  const toggle = () => setUnit((prev) => (prev === "bits" ? "bytes" : "bits"));

  return (
    <BandwidthUnitContext.Provider value={{ unit, setUnit, toggle }}>
      {children}
    </BandwidthUnitContext.Provider>
  );
}

export function useBandwidthUnit() {
  return useContext(BandwidthUnitContext);
}
