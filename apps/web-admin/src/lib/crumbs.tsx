"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Crumb } from "@/lib/nav-config";

// Detail pages know things the nav config can't: a user's name, a ticket
// number. They render <PageCrumb> and the header appends it to the trail.

interface PageCrumbEntry {
  label: string;
  href: string;
}

interface CrumbsContextValue {
  crumbs: PageCrumbEntry[];
  register: (crumb: PageCrumbEntry) => void;
  unregister: (href: string) => void;
}

const CrumbsContext = createContext<CrumbsContextValue | null>(null);

export function CrumbsProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, setCrumbs] = useState<PageCrumbEntry[]>([]);

  const register = useCallback((crumb: PageCrumbEntry) => {
    setCrumbs((current) => {
      const existing = current.find((entry) => entry.href === crumb.href);
      if (existing?.label === crumb.label) return current;
      // Nested layouts register in child-first order, so sort by depth instead.
      return [...current.filter((entry) => entry.href !== crumb.href), crumb].sort((a, b) => a.href.length - b.href.length);
    });
  }, []);

  const unregister = useCallback((href: string) => {
    setCrumbs((current) => current.filter((entry) => entry.href !== href));
  }, []);

  const value = useMemo(() => ({ crumbs, register, unregister }), [crumbs, register, unregister]);
  return <CrumbsContext.Provider value={value}>{children}</CrumbsContext.Provider>;
}

export function usePageCrumbs(): Crumb[] {
  return useContext(CrumbsContext)?.crumbs ?? [];
}

/** Adds one level to the header breadcrumb for as long as it is mounted. Renders nothing. */
export function PageCrumb({ label, href }: PageCrumbEntry) {
  const context = useContext(CrumbsContext);
  const register = context?.register;
  const unregister = context?.unregister;

  useEffect(() => {
    register?.({ label, href });
    return () => unregister?.(href);
  }, [label, href, register, unregister]);

  return null;
}
