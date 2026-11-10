"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { useObsWebSocket } from "@repo/obs-web";

type Obs = ReturnType<typeof useObsWebSocket>;

// Per browser: the tip is shown once, and only the first time matters.
const SEEN_KEY = "sw:tip:browser-source-audio";
// OBS has far fewer new sources than this; the cap only keeps the set bounded.
const MAX_PENDING = 50;

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private window or blocked storage: the tip may show again, nothing worse.
  }
}

// Shows a one-time tip when the user adds a browser source in OBS without
// "Control audio via OBS". Cloud OBS has no desktop audio capture, so that
// source's sound plays into the machine's speaker device and never reaches
// the stream.
//
// A new browser source is watched from creation until its properties dialog
// closes with OK (OBS saves browser source settings only then), and checked
// at that moment. Sources we create ourselves already have the box ticked.
export function useBrowserSourceAudioTip({ obs, enabled }: { obs: Obs; enabled: boolean }) {
  const { status, onInputEvent, setInputSettings } = obs;
  const active = enabled && status === "open";
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const pendingRef = useRef(new Set<string>());

  useEffect(() => {
    if (!active || readSeen()) return;
    const pending = pendingRef.current;
    return onInputEvent((event) => {
      switch (event.type) {
        case "InputCreated":
          if (event.inputKind === "browser_source" && event.inputSettings.reroute_audio !== true) {
            if (pending.size >= MAX_PENDING) pending.delete(pending.values().next().value as string);
            pending.add(event.inputName);
          }
          break;
        case "InputNameChanged":
          if (pending.delete(event.oldInputName)) pending.add(event.inputName);
          break;
        case "InputRemoved":
          pending.delete(event.inputName);
          break;
        case "InputSettingsChanged":
          if (!pending.delete(event.inputName)) break;
          if (event.inputSettings.reroute_audio === true || readSeen()) break;
          markSeen();
          pending.clear();
          setSourceName(event.inputName);
          break;
      }
    });
  }, [active, onInputEvent]);

  const close = useCallback(() => setSourceName(null), []);

  const fix = useCallback(async () => {
    if (!sourceName) return;
    setFixing(true);
    try {
      await setInputSettings(sourceName, { reroute_audio: true });
      toast.success(`"${sourceName}" now plays through OBS.`);
      setSourceName(null);
    } catch {
      // OBS refused or the socket dropped; the user can still tick it by hand.
      toast.error("Couldn't change it. Tick Control audio via OBS in the source's properties.");
    } finally {
      setFixing(false);
    }
  }, [sourceName, setInputSettings]);

  return { sourceName, fixing, fix, close };
}
