"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { useObsWebSocket } from "@repo/obs-web";
import { listOutputKeys } from "@/actions/irl/ingest-output-keys";
import { ingestPullStreamId } from "@/lib/obs/obs-irl";
import type { IngestSourceAlertState, IngestSourceProblem } from "@/types/obs";

type Obs = ReturnType<typeof useObsWebSocket>;

type UseIngestSourceGuardOptions = {
  obs: Obs;
  /** The ingest node's host; a source pulling from it is an ingest source. */
  obsPullHost: string;
  /** Off during the guided setup, which puts a missing source back by itself. */
  enabled: boolean;
};

// OBS has far fewer sources than this; the cap only keeps the map bounded.
const MAX_KNOWN_SOURCES = 200;

// Warns when an ingest source stops feeding OBS, and offers to undo it:
//  - removed: taken out of a scene → put the same source back in that scene
//  - broken: its URL no longer pulls one of the user's feeds → put the last
//    working URL back
// Ingest sources are recognised by the feed they pull, not their name: the
// Ingest tab lets people name them and put them in any scene. Only sources
// seen working are watched, so a source that never had a valid URL is left
// alone.
//
// Runs in every window that holds an OBS connection (the dashboard and the
// OBS viewer window), each showing its own warning. Putting the source back
// in one closes the other's, since it sees the source return.
export function useIngestSourceGuard({ obs, obsPullHost, enabled }: UseIngestSourceGuardOptions) {
  const {
    status,
    sceneItems,
    onSceneItemRemoved,
    getInputSettings,
    setInputSettings,
    addMediaSourceToScene,
    addExistingSourceToScene,
    sceneHasSource,
  } = obs;
  const active = enabled && status === "open";

  const [state, setStateValue] = useState<IngestSourceAlertState>("hidden");
  const [problem, setProblemValue] = useState<IngestSourceProblem | null>(null);
  const stateRef = useRef<IngestSourceAlertState>("hidden");
  // The problem being shown plus the working URL to restore.
  const problemRef = useRef<{ problem: IngestSourceProblem; url: string } | null>(null);
  // Read by the URL check, which finishes after awaits; keeps that effect
  // from re-running (and re-reading OBS) whenever the guard turns on or off.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  // Ingest source name → the last URL it pulled a real feed from. Kept after
  // a source disappears, so a removal (which only names the source) can
  // still be recognised and put back with the same feed.
  const knownIngestRef = useRef(new Map<string, string>());
  const outputKeysRef = useRef<Set<string> | null>(null);

  const setState = useCallback((next: IngestSourceAlertState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const show = useCallback(
    (next: IngestSourceProblem, url: string) => {
      problemRef.current = { problem: next, url };
      setProblemValue(next);
      setState("open");
    },
    [setState],
  );

  const close = useCallback(() => {
    problemRef.current = null;
    setProblemValue(null);
    setState("hidden");
  }, [setState]);

  // The user's output keys, the only stream ids that carry a feed. Loaded
  // again when a URL names one we haven't seen (a key made since).
  const loadOutputKeys = useCallback(async (force: boolean) => {
    if (outputKeysRef.current && !force) return outputKeysRef.current;
    const { data } = await listOutputKeys();
    if (data) outputKeysRef.current = new Set(data.map((key) => key.output_key));
    return outputKeysRef.current ?? new Set<string>();
  }, []);

  // Re-read every media source's URL whenever the scene list changes (OBS
  // refreshes it on adds, removals, renames and settings changes).
  useEffect(() => {
    if (status !== "open") return;
    const mediaSources = new Set<string>();
    for (const items of Object.values(sceneItems)) {
      for (const item of items) if (item.inputKind === "ffmpeg_source") mediaSources.add(item.sourceName);
    }
    let cancelled = false;
    (async () => {
      const settings = await getInputSettings([...mediaSources]);
      let keys = await loadOutputKeys(false);
      let reloaded = false;
      if (cancelled) return;
      const known = knownIngestRef.current;

      for (const name of mediaSources) {
        if (!settings[name]) continue;
        const input = settings[name].input;
        const url = typeof input === "string" ? input : "";
        const streamId = ingestPullStreamId(url, obsPullHost);
        if (streamId && !keys.has(streamId) && !reloaded) {
          keys = await loadOutputKeys(true);
          reloaded = true;
          if (cancelled) return;
        }

        if (streamId && keys.has(streamId)) {
          known.delete(name);
          known.set(name, url);
          const shown = problemRef.current;
          if (shown?.problem.kind === "broken" && shown.problem.sourceName === name && stateRef.current !== "restoring") {
            close();
          }
          continue;
        }

        const lastWorking = known.get(name);
        if (!lastWorking || url === lastWorking) continue;
        // Reported at once: OBS's properties dialog only saves a media
        // source's URL on OK, never per keystroke.
        const shown = problemRef.current?.problem;
        const alreadyShown = shown?.kind === "broken" && shown.sourceName === name;
        if (activeRef.current && !alreadyShown) show({ kind: "broken", sourceName: name }, lastWorking);
      }
      while (known.size > MAX_KNOWN_SOURCES) known.delete(known.keys().next().value as string);
    })().catch(() => {
      // OBS busy or the socket dropped; the next scene refresh tries again.
    });
    return () => {
      cancelled = true;
    };
  }, [status, sceneItems, getInputSettings, loadOutputKeys, obsPullHost, close, show]);

  const putBack = useCallback(async () => {
    const shown = problemRef.current;
    if (!shown || stateRef.current === "restoring") return;
    setState("restoring");
    try {
      const { problem: target, url } = shown;
      if (target.kind === "broken") {
        await setInputSettings(target.sourceName, { input: url });
      } else {
        try {
          await addMediaSourceToScene(target.sceneName, target.sourceName, url);
        } catch {
          // The source still exists in another scene (OBS names are unique),
          // so put that one back in this scene instead.
          await addExistingSourceToScene(target.sceneName, target.sourceName);
        }
      }
      close();
      toast.success("Your feed is back in OBS.");
    } catch {
      // Shown in the dialog; OBS refusing or the socket dropping is
      // something the user fixes, not something we report.
      setState("failed");
    }
  }, [setInputSettings, addMediaSourceToScene, addExistingSourceToScene, setState, close]);

  const leave = useCallback(() => {
    // Leaving a broken link alone means it's not ours to watch any more.
    const shown = problemRef.current;
    if (shown?.problem.kind === "broken") knownIngestRef.current.delete(shown.problem.sourceName);
    close();
  }, [close]);

  useEffect(() => {
    if (!active) return;
    return onSceneItemRemoved(({ sceneName, sourceName }) => {
      const url = knownIngestRef.current.get(sourceName);
      if (url) show({ kind: "removed", sceneName, sourceName }, url);
    });
  }, [active, onSceneItemRemoved, show]);

  // Close a "removed" warning when the source comes back some other way
  // (Ctrl+Z in OBS, added by hand), and any warning once OBS is gone.
  const removed = problem?.kind === "removed" ? problem : null;
  const removedKey = removed ? `${removed.sceneName}\n${removed.sourceName}` : null;
  const hasSource = removed ? sceneHasSource(removed.sceneName, removed.sourceName) : false;
  const seenRef = useRef<{ key: string | null; has: boolean }>({ key: null, has: false });
  useEffect(() => {
    // A new removal starts as "was there": the scene list refreshes a moment
    // after the event, so it still shows the source at first.
    const had = seenRef.current.key === removedKey ? seenRef.current.has : true;
    seenRef.current = { key: removedKey, has: hasSource };
    if (stateRef.current === "hidden" || stateRef.current === "restoring") return;
    if (hasSource && !had) close();
    else if (!active) close();
  }, [removedKey, hasSource, active, close]);

  return { state, problem, putBack, leave };
}
