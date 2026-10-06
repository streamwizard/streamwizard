"use client";

import useSWR from "swr";
import { EMPTY_NAV_COUNTS, type NavCounts } from "@/lib/nav-counts-shared";

const fetcher = async (url: string): Promise<NavCounts> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`nav counts: ${response.status}`);
  return response.json();
};

/** Counters for the sidebar and the phone bottom bar. One request, shared by SWR's cache. */
export function useNavCounts(): NavCounts {
  const { data } = useSWR<NavCounts>("/api/nav-counts", fetcher, {
    refreshInterval: 45_000,
    // A hidden tab has nobody looking at the badges.
    refreshWhenHidden: false,
    keepPreviousData: true,
  });
  return data ?? EMPTY_NAV_COUNTS;
}
