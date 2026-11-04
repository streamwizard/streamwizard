"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/stores/session-store";
import type { Session } from "@/lib/session";

export function PreferencesInitializer({ preferences }: { preferences: Session["preferences"] }) {
  const setPreferences = useSessionStore((s) => s.setPreferences);

  useEffect(() => {
    setPreferences(preferences);
  }, [preferences, setPreferences]);

  return null;
}
