"use client";

import { useSidebar } from "@repo/ui";
import { useCallback } from "react";

/**
 * Closes the mobile sidebar sheet after a navigation. A no-op on desktop,
 * where the sidebar is always visible.
 */
export function useCloseMobileSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();

  return useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
}
