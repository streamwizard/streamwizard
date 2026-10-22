"use client";

import { useEffect } from "react";

// The admin's side-by-side preview reloads this page after every save. Keep
// the reader where they were: remember the scroll position when the page
// goes away and put it back when it loads. Per tab and per preview link.

export function PreviewScrollKeeper({ token }: { token: string }) {
  useEffect(() => {
    const key = `cms-preview-scroll:${token}`;
    try {
      const saved = Number(sessionStorage.getItem(key));
      if (saved > 0) window.scrollTo(0, saved);
    } catch {
      // Storage blocked (private mode, partitioned frame): start at the top.
    }
    const remember = () => {
      try {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)));
      } catch {
        // Nothing to keep it in.
      }
    };
    window.addEventListener("pagehide", remember);
    return () => window.removeEventListener("pagehide", remember);
  }, [token]);

  return null;
}
