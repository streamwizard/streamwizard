"use client";

import { useEffect } from "react";
import {
  googleFontsBatchStylesheetHref,
  googleFontStylesheetHref,
} from "@/constants/google-fonts";

const SINGLE_PREFIX = "overlay-google-font-";
const BATCH_LINK_ID = "overlay-google-fonts-batch";

function linkIdForFamily(family: string): string {
  return `${SINGLE_PREFIX}${family.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}`;
}

/** Loads one Google Font family (weights 400–700). */
export function useGoogleFont(family: string | undefined) {
  useEffect(() => {
    if (!family?.trim()) return;

    const id = linkIdForFamily(family);
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontStylesheetHref(family);
    document.head.appendChild(link);
  }, [family]);
}

/**
 * Loads many families in one stylesheet request. Updates the `<link>` when the
 * family set changes (e.g. search results change).
 */
export function useGoogleFontsBatch(families: readonly string[] | undefined) {
  const signature = families?.join("\0") ?? "";

  useEffect(() => {
    if (!families?.length) return;

    const href = googleFontsBatchStylesheetHref(families);
    let el = document.getElementById(BATCH_LINK_ID) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement("link");
      el.id = BATCH_LINK_ID;
      el.rel = "stylesheet";
      document.head.appendChild(el);
    }
    if (el.getAttribute("href") !== href) {
      el.href = href;
    }
  }, [signature]);
}
