"use client";

import { createContext, useContext, useState } from "react";

export const REFRESH_OPTIONS = [
  { label: "5s", value: 5_000 },
  { label: "10s", value: 10_000 },
  { label: "30s", value: 30_000 },
  { label: "1m", value: 60_000 },
  { label: "2m", value: 120_000 },
  { label: "5m", value: 300_000 },
] as const;

type RefreshIntervalContextValue = {
  interval: number;
  setInterval: (ms: number) => void;
};

const RefreshIntervalContext = createContext<RefreshIntervalContextValue>({
  interval: 5_000,
  setInterval: () => {},
});

export function RefreshIntervalProvider({ children }: { children: React.ReactNode }) {
  const [interval, setInterval] = useState(5_000);
  return (
    <RefreshIntervalContext.Provider value={{ interval, setInterval }}>
      {children}
    </RefreshIntervalContext.Provider>
  );
}

export function useRefreshInterval() {
  return useContext(RefreshIntervalContext);
}
