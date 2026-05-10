"use client";

import { useLayoutEffect } from "react";

const loadedFamilies = new Set<string>();

function familyToGoogleParam(name: string): string {
  return name.trim().replace(/\s+/g, "+");
}

function injectStylesheet(href: string, idSuffix: string) {
  const id = `google-font-${idSuffix}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Loads Google Fonts CSS2 (400–700, display=swap) once per family name.
 */
export function useGoogleFonts(families: string[]) {
  useLayoutEffect(() => {
    const uniq = [...new Set(families.map((f) => f.trim()).filter(Boolean))];
    for (const family of uniq) {
      if (loadedFamilies.has(family)) continue;
      loadedFamilies.add(family);
      const param = familyToGoogleParam(family);
      const href = `https://fonts.googleapis.com/css2?family=${param}:wght@400;500;600;700&display=swap`;
      const idSuffix = param.replace(/[^a-zA-Z0-9_-]/g, "_");
      injectStylesheet(href, idSuffix);
    }
  }, [families]);
}
