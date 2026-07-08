"use client";

import { createContext, useContext, useState } from "react";

export interface TimeRangeOption {
  label: string;
  fluxRange: string; // passed directly to InfluxDB range(start: -<fluxRange>)
  window: string;    // InfluxDB aggregateWindow bucket size
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  // Short ranges use fine windows matched to the ~10s sampler cadence so a
  // stream stopping shows a real drop within seconds, not a minute-long slope
  // from coarse 1m/2m averaging blurring the transition.
  { label: "Last 5m",  fluxRange: "5m",   window: "10s" },
  { label: "Last 15m", fluxRange: "15m",  window: "30s" },
  { label: "Last 30m", fluxRange: "30m",  window: "30s" },
  { label: "Last 1h",  fluxRange: "1h",   window: "5m"  },
  { label: "Last 3h",  fluxRange: "3h",   window: "15m" },
  { label: "Last 6h",  fluxRange: "6h",   window: "30m" },
  { label: "Last 12h", fluxRange: "12h",  window: "1h"  },
  { label: "Last 24h", fluxRange: "24h",  window: "1h"  },
  { label: "Last 2d",  fluxRange: "48h",  window: "2h"  },
  { label: "Last 7d",  fluxRange: "168h", window: "6h"  },
];

const DEFAULT_RANGE = TIME_RANGE_OPTIONS[7]!; // Last 24h

type TimeRangeContextValue = {
  range: TimeRangeOption;
  setRange: (range: TimeRangeOption) => void;
};

const TimeRangeContext = createContext<TimeRangeContextValue>({
  range: DEFAULT_RANGE,
  setRange: () => {},
});

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = useState<TimeRangeOption>(DEFAULT_RANGE);
  return (
    <TimeRangeContext.Provider value={{ range, setRange }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}
