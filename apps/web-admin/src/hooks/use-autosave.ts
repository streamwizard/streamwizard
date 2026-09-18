"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Saves `value` a moment after it stops changing. Saves never overlap: a
 * change made while one is in flight is saved right after it, so the last
 * write is always the newest value. `save` resolves to whether it worked.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<boolean>, delayMs = 800) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const latest = useRef(value);
  const saved = useRef(JSON.stringify(value));
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    saveRef.current = save;
    latest.current = value;
  });

  /** Saves now if anything is unsaved. Resolves to false when the save failed. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (running.current) await running.current;

    // Loops when something changed while a save was on its way.
    while (JSON.stringify(latest.current) !== saved.current) {
      const snapshot = latest.current;
      setStatus("saving");
      running.current = saveRef.current(snapshot).catch(() => false);
      const ok = await running.current;
      running.current = null;
      if (!ok) {
        setStatus("error");
        return false;
      }
      saved.current = JSON.stringify(snapshot);
    }
    setStatus((current) => (current === "idle" ? "idle" : "saved"));
    return true;
  }, []);

  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (serialized === saved.current) return;
    // "Saving…" shows while the debounce runs, not only once the request starts.
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delayMs);
  }, [serialized, delayMs, flush]);

  // Closing the tab mid-edit would lose the last few keystrokes.
  useEffect(() => {
    if (status !== "saving" && status !== "error") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  // Leaving the page inside the debounce still saves what was typed.
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      void saveRef.current(latest.current).catch(() => false);
    },
    [],
  );

  return { status, flush };
}
