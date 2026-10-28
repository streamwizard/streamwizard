"use client";

import { useLayoutEffect } from "react";
import { uploadedFontFaceCss, UPLOADED_FONT_PREFIX } from "../lib/font-ref";

const loadedFamilies = new Set<string>();

function inject(family: string) {
  if (loadedFamilies.has(family)) return;
  loadedFamilies.add(family);

  // A font from the media library: declare it, there is nothing to ask Google.
  if (family.startsWith(UPLOADED_FONT_PREFIX)) {
    const css = uploadedFontFaceCss(family);
    if (!css) return;
    const style = document.createElement("style");
    style.dataset.uploadedFont = "";
    style.textContent = css;
    document.head.appendChild(style);
    return;
  }

  const param = family.trim().replace(/\s+/g, "+");
  const id = `overlay-widget-font-${param.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${param}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/** Loads a Google font, or declares a font uploaded to the media library. */
export function useGoogleFont(family: string | undefined): void {
  useLayoutEffect(() => {
    const f = family?.trim();
    if (f) inject(f);
  }, [family]);
}

export function useGoogleFonts(families: string[]): void {
  useLayoutEffect(() => {
    for (const f of families) {
      if (f?.trim()) inject(f.trim());
    }
  }, [families]);
}
