"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
} from "@repo/ui";
import { AlertTriangle, Loader2, MonitorOff, Radio, Square, Wifi, WifiOff } from "lucide-react";
import { getMyLatestInstanceAction, getInstanceNodeApiUrlAction, getInstanceObsWsPasswordAction } from "@/actions/nodes";
import { setSceneOverride, type AutoSwitcherConfigRow } from "@/actions/supabase/auto-switcher";
import { mintWsUrl } from "@/lib/ws-ticket";
import { toggleInstance } from "@/lib/instance-actions";
import { useObsWebSocket, type Scene } from "@/hooks/use-obs-websocket";
import { useObsLifecycleNotifications } from "@/components/irl/use-obs-lifecycle-notifications";
import type { ObsInstanceLifecyclePayload } from "@repo/types";
import { ObsBootProgress } from "@/components/irl/obs-boot-progress";
import { ObsOfflineState } from "@/components/irl/obs-offline-state";
import { ObsLifecycleBanner } from "@/components/irl/obs-lifecycle-banner";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import { AutoSwitcherHoldCard } from "./_auto-switcher-hold-card";
import { InstallPrompt } from "./_install-prompt";
import { DeckFooter, deckMainPadding, type DeckTab } from "./_deck-tab-bar";
import { SwitcherSettingsPanel, type SaveBarActions, type SaveBarState } from "./_switcher-settings-panel";

interface DeckContentProps {
  canInteract: boolean;
  /** Full config row, so the switcher tab can edit it and the deck can gate scene holds on it. */
  autoSwitcherConfig: AutoSwitcherConfigRow | null;
  initialOverride: { sceneName: string | null } | null;
}

// Tall touch targets: an IRL streamer is tapping this one-handed on a phone
// while walking, so every actionable button gets the same oversized shape.
const deckButtonClass = "h-24 rounded-2xl text-base font-semibold";

export function DeckContent({ canInteract, autoSwitcherConfig, initialOverride }: DeckContentProps) {
  const [tab, setTab] = useState<DeckTab>("deck");
  // Config lives in state, not as a frozen prop: saving on the switcher tab must
  // immediately change whether a scene tap holds the scene, without a reload.
  const [switcherConfig, setSwitcherConfig] = useState(autoSwitcherConfig);
  const [saveBar, setSaveBar] = useState<SaveBarState | null>(null);
  const saveBarActionsRef = useRef<SaveBarActions | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DeckTab | null>(null);
  const switcherEnabled = switcherConfig?.enabled ?? false;
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [obsWsPassword, setObsWsPassword] = useState<string | null>(null);
  const [containerStatus, setContainerStatus] = useState<"running" | "stopped" | "unknown">("unknown");
  const [togglingContainer, setTogglingContainer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bootElapsed, setBootElapsed] = useState(0);
  // Last override state the deck knows about (scene name held, or null), plus
  // when the deck last changed it. The hold card prefers the engine's live
  // status frames; these cover the gap right after a tap and ws-down fallback.
  const [heldScene, setHeldScene] = useState<string | null>(initialOverride?.sceneName ?? null);
  const [heldAt, setHeldAt] = useState(0);
  // True from a deck-initiated container start until OBS connects; gates the
  // boot stepper so plain websocket reconnects don't look like OBS restarting.
  const [startRequested, setStartRequested] = useState(false);
  // Only toast "OBS connected" for a connect the user initiated from this page,
  // not the passive connect when the deck loads against an already-running box.
  const awaitingConnectRef = useRef(false);
  // True from a local start/restart until the next lifecycle event, so the
  // event that our own action produces doesn't fire a second (external) toast.
  const selfInitiatedRef = useRef(false);

  // Loads a specific instance's node API URL + OBS WS password into state
  // (also setting instanceId). Shared by the initial load and the lifecycle
  // handler below, which uses it to adopt an instance started on another
  // device while this one was tracking none.
  const hydrateInstance = useCallback(async (id: string) => {
    setInstanceId(id);
    const [{ data: nodeData }, { data: passwordData }] = await Promise.all([
      getInstanceNodeApiUrlAction(id),
      getInstanceObsWsPasswordAction(id),
    ]);
    if (!nodeData || !passwordData) {
      setLoadError("Couldn't load your container info. Refresh to try again?");
      return;
    }
    setApiUrl(nodeData.apiUrl);
    setObsWsPassword(passwordData.password);
  }, []);

  useEffect(() => {
    async function init() {
      // Look up the most recent instance regardless of status -- a stopped
      // instance still needs to be picked up so the deck offers Start instead
      // of a dead end.
      const { data: instance } = await getMyLatestInstanceAction();
      if (!instance) {
        setContainerStatus("stopped");
        return;
      }
      setContainerStatus(instance.status === "running" ? "running" : "stopped");
      await hydrateInstance(instance.id);
    }
    init();
  }, [hydrateInstance]);

  const getWsUrl = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintWsUrl(apiUrl, {
      ticketPath: `/instances/${instanceId}/ws-ticket`,
      wsPath: `/instances/${instanceId}/obsws`,
      scope: "obsws",
    });
  }, [apiUrl, instanceId]);

  const obs = useObsWebSocket({
    getWsUrl: apiUrl && instanceId ? getWsUrl : null,
    password: obsWsPassword,
  });

  // Live container lifecycle from the manager (start/stop/delete/crash), so the
  // deck reflects state changes from other devices or admins without a refresh
  // -- and, critically, learns about a "started" the OBS socket can't carry
  // (there's no socket while the box is off).
  const handleLifecycle = useCallback(
    (payload: ObsInstanceLifecyclePayload) => {
      // Ignore events for an instance we're not tracking -- unless we're
      // tracking none yet, in which case a "started" adopts the new one below.
      if (instanceId && payload.instanceId !== instanceId) return;

      switch (payload.action) {
        case "starting":
          // Transitional: box is coming up elsewhere. The hook's `transition`
          // drives the "Starting…" UI; the terminal "started" hydrates/connects.
          break;
        case "stopping":
          // Transitional: a deliberate stop is underway. Stop the OBS socket from
          // fighting the imminent drop so we show "Stopping…", not "Reconnecting".
          obs.disconnect();
          break;
        case "stopped":
        case "error":
          setContainerStatus("stopped");
          // Kill any in-flight boot state so a crash mid-launch can't keep the
          // stepper spinning "spinning up your container" forever.
          setStartRequested(false);
          obs.disconnect();
          break;
        case "deleted":
          setInstanceId(null);
          setApiUrl(null);
          setObsWsPassword(null);
          setContainerStatus("stopped");
          setStartRequested(false);
          obs.disconnect();
          break;
        case "started":
          setContainerStatus("running");
          if (payload.instanceId !== instanceId || !apiUrl || !obsWsPassword) {
            // New instance, or one we never fully loaded: fetch its node URL +
            // password; the OBS hook auto-connects once all three are set.
            void hydrateInstance(payload.instanceId);
          } else {
            obs.reconnect();
          }
          break;
      }
    },
    [instanceId, apiUrl, obsWsPassword, obs, hydrateInstance],
  );

  const { stopReason, clearStopReason, setStopReason, transition } = useObsLifecycleNotifications({
    instanceId,
    selfInitiatedRef,
    onEvent: handleLifecycle,
  });

  const handleStart = async () => {
    if (!apiUrl || !instanceId) return;
    setTogglingContainer(true);
    // Our own start: suppress the external toast for the "started" it produces,
    // and clear any crash banner we're recovering from.
    selfInitiatedRef.current = true;
    clearStopReason();
    try {
      await toggleInstance(apiUrl, instanceId, "start");
      setContainerStatus("running");
      setStartRequested(true);
      awaitingConnectRef.current = true;
      // reconnect (not connect) resets the retry budget, so a restart after a
      // previous boot timeout will actually retry instead of giving up at once.
      obs.reconnect();
      toast.success("Starting your container", { description: "OBS is booting up." });
    } catch (err) {
      toast.error("Couldn't start the container", {
        description: err instanceof Error ? err.message : "Try again?",
      });
    } finally {
      setTogglingContainer(false);
    }
  };

  const handleSceneSwitch = (scene: Scene) => {
    // Switch immediately; don't wait on the override round-trip.
    obs.switchScene(scene.sceneName).catch((err) => {
      toast.error("Couldn't switch the scene", { description: err instanceof Error ? err.message : "Try again?" });
    });

    if (!switcherEnabled) return;
    // Hold the scene so the auto switcher doesn't take it back (or force the
    // connection-lost scene when the feed drops). If the engine flips the
    // scene inside the ~1s push window, it re-switches to the held scene the
    // moment the override lands.
    setSceneOverride(scene.sceneUuid, scene.sceneName, null)
      .then((result) => {
        if (result.ok) {
          setHeldScene(scene.sceneName);
          setHeldAt(Date.now());
        } else {
          toast.warning("Scene switched, but the hold didn't stick", {
            description: result.error ?? "The auto switcher may switch back. Tap the scene again.",
          });
        }
      })
      .catch((err) => {
        toast.warning("Scene switched, but the hold didn't stick", {
          description: err instanceof Error ? err.message : "The auto switcher may switch back. Tap the scene again.",
        });
      });
  };

  const handleHoldReleased = () => {
    setHeldScene(null);
    setHeldAt(Date.now());
  };

  // Opening the switcher tab pushes a history entry so the system back gesture
  // (Android predictive back, iOS swipe) closes it instead of leaving the deck.
  // The panel unmounts with the tab, so its save-bar state leaves with it.
  const leaveSwitcher = useCallback(() => {
    setSaveBar(null);
    saveBarActionsRef.current = null;
  }, []);

  const goToTab = useCallback(
    (next: DeckTab) => {
      if (tab === next) return;
      if (next === "switcher") {
        window.history.pushState({ deckTab: "switcher" }, "");
      } else {
        leaveSwitcher();
        if (window.history.state?.deckTab === "switcher") window.history.back();
      }
      setTab(next);
    },
    [tab, leaveSwitcher],
  );

  const handleTabChange = (next: DeckTab) => {
    // Leaving the switcher tab mid-edit would silently drop the changes.
    if (tab === "switcher" && next !== "switcher" && saveBar?.dirty) {
      setDiscardPrompt(next);
      return;
    }
    goToTab(next);
  };

  const switcherDirty = saveBar?.dirty ?? false;
  useEffect(() => {
    const onPopState = () => {
      if (switcherDirty) {
        // popstate can't be cancelled, so re-arm the entry we just consumed and
        // ask before throwing the edits away.
        window.history.pushState({ deckTab: "switcher" }, "");
        setDiscardPrompt("deck");
        return;
      }
      leaveSwitcher();
      setTab("deck");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [switcherDirty, leaveSwitcher]);

  // The boot stepper is only honest after the user actually started the
  // container from this page. Every other connect (page load onto a running
  // box, waking the phone, network change) is just the websocket coming back,
  // so it gets a plain "Connecting" state instead of "Booting OBS".
  if (obs.status === "open" && startRequested) {
    setStartRequested(false);
  }

  // Start flow phases -- starting (start request in flight), booting (container
  // up after a deck start, OBS WS connecting/retrying), connected, or timed out.
  const isStarting = togglingContainer && containerStatus !== "running";
  const connectingLike = obs.status === "connecting" || obs.isAutoRetrying;
  const isBooting =
    !isStarting && startRequested && containerStatus === "running" && obs.status !== "open" && !obs.hasTimedOut && connectingLike;
  const isReconnecting =
    !isStarting && !startRequested && containerStatus === "running" && obs.status !== "open" && !obs.hasTimedOut && connectingLike;
  const inStartFlow = isStarting || isBooting;
  const hasTimedOut = containerStatus === "running" && obs.hasTimedOut && obs.status !== "open";
  const hasNoInstance = containerStatus === "stopped" && !instanceId;
  const crashed = containerStatus === "stopped" && stopReason === "crashed";
  // Transitional states pushed from other devices/admin. The local actor sees
  // its own flow (inStartFlow); these cover the "someone else did it" case so a
  // deliberate stop reads "Stopping…", not a misleading reconnect spinner.
  const isStopping = transition === "stopping" && obs.status !== "open";
  const externalStarting = transition === "starting" && !inStartFlow && obs.status !== "open";

  // Reset the elapsed counter on the flow edges during render (the React-blessed
  // adjust-state-on-change pattern); the interval below only ever counts up.
  const [flowActive, setFlowActive] = useState(false);
  if (inStartFlow !== flowActive) {
    setFlowActive(inStartFlow);
    setBootElapsed(0);
  }

  // Single elapsed timer spanning the whole start flow. Keyed on the boolean so
  // it runs continuously across starting -> booting.
  useEffect(() => {
    if (!inStartFlow) return;
    const start = Date.now();
    const id = setInterval(() => setBootElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [inStartFlow]);

  useEffect(() => {
    if (obs.status === "open" && awaitingConnectRef.current) {
      awaitingConnectRef.current = false;
      toast.success("OBS connected", { description: "You're ready to go live." });
    }
  }, [obs.status]);

  // Phones kill the socket when the screen locks or the network changes, and
  // the hook deliberately doesn't retry after a successful connect. Reconnect
  // on wake/focus/network-restore instead of making the streamer find a button.
  const { reconnect, disconnect } = obs;
  useEffect(() => {
    const maybeReconnect = async () => {
      if (document.visibilityState !== "visible") return;
      if (containerStatus !== "running" || obs.status !== "closed" || !apiUrl || !instanceId) return;
      // A stop/crash push is best-effort and can be missed. Before reconnecting,
      // confirm the box is really still up -- reconnecting to an off container is
      // pointless and would spin ~90s before giving up. If it's off, say so
      // ("turned off"/"crashed") instead of retrying into the void.
      const { data: instance } = await getMyLatestInstanceAction();
      if (!instance || instance.id !== instanceId || instance.status !== "running") {
        setStopReason(instance?.status === "error" ? "crashed" : "clean");
        setContainerStatus("stopped");
        disconnect();
        return;
      }
      reconnect();
    };
    document.addEventListener("visibilitychange", maybeReconnect);
    window.addEventListener("focus", maybeReconnect);
    window.addEventListener("online", maybeReconnect);
    window.addEventListener("pageshow", maybeReconnect);
    return () => {
      document.removeEventListener("visibilitychange", maybeReconnect);
      window.removeEventListener("focus", maybeReconnect);
      window.removeEventListener("online", maybeReconnect);
      window.removeEventListener("pageshow", maybeReconnect);
    };
  }, [containerStatus, obs.status, apiUrl, instanceId, reconnect, disconnect, setStopReason]);

  // Fallback for a missed stop/crash push while the deck stays open and focused:
  // a connected socket that drops but leaves containerStatus stuck "running"
  // would sit on "Lost connection" forever. Give the push a moment to land, then
  // verify against the source of truth -- if the box is really off, flip to
  // "turned off"/"crashed" so we're not implying a reconnect that can't happen.
  useEffect(() => {
    if (containerStatus !== "running" || obs.status !== "closed" || !instanceId) return;
    const id = setTimeout(async () => {
      const { data: instance } = await getMyLatestInstanceAction();
      if (!instance || instance.id !== instanceId || instance.status !== "running") {
        setStopReason(instance?.status === "error" ? "crashed" : "clean");
        setContainerStatus("stopped");
        disconnect();
      }
    }, 5_000);
    return () => clearTimeout(id);
  }, [containerStatus, obs.status, instanceId, disconnect, setStopReason]);

  const statusVariant =
    obs.status === "open"
      ? "default"
      : hasTimedOut || crashed
      ? "destructive"
      : inStartFlow || isReconnecting || isStopping || externalStarting
      ? "secondary"
      : "outline";

  const showSaveBar = tab === "switcher" && saveBar != null && (saveBar.dirty || saveBar.submitting);

  return (
    <main
      className={cn(
        "min-h-dvh bg-background px-4 pt-6 select-none [touch-action:manipulation]",
        deckMainPadding(showSaveBar),
      )}
    >
      <div className="mx-auto w-full max-w-md space-y-4">
        {!canInteract && <FeatureDisabledBanner />}

        {/* High-signal banner for events the streamer can't afford to miss: a
            crash (stream just dropped) or a delete. */}
        <ObsLifecycleBanner
          reason={stopReason}
          onRestart={canInteract && instanceId && apiUrl ? handleStart : undefined}
          restarting={togglingContainer}
          onDismiss={clearStopReason}
        />

        {/* Title + connection status. The OBS badge stays on both tabs: the
            scene pickers in the switcher settings need a live scene list. */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{tab === "switcher" ? "Auto switcher" : "Stream Deck"}</h1>
          <Badge variant={statusVariant} className="gap-1.5">
            {obs.status === "open" && <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />}
            {(inStartFlow || isReconnecting || isStopping || externalStarting) && <Loader2 className="h-3 w-3 animate-spin" />}
            {(hasTimedOut || crashed) && <AlertTriangle className="h-3 w-3" />}
            {!inStartFlow && !isReconnecting && !isStopping && !externalStarting && !hasTimedOut && !crashed && obs.status === "closed" && (
              <WifiOff className="h-3 w-3" />
            )}
            {obs.status === "open"
              ? "OBS Connected"
              : crashed
              ? "Crashed"
              : hasTimedOut
              ? "Not responding"
              : isStopping
              ? "Stopping…"
              : isStarting || externalStarting
              ? "Starting up…"
              : isBooting
              ? "OBS booting…"
              : isReconnecting
              ? "Connecting…"
              : containerStatus === "running"
              ? "Disconnected"
              : "Offline"}
          </Badge>
        </div>

        {tab === "switcher" ? (
          <SwitcherSettingsPanel
            config={switcherConfig}
            scenes={obs.filteredScenes}
            sceneItems={obs.sceneItems}
            obsConnected={obs.status === "open"}
            canInteract={canInteract}
            onSaved={setSwitcherConfig}
            onSaveBarChange={setSaveBar}
            actionsRef={saveBarActionsRef}
          />
        ) : loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm">{loadError}</p>
            </CardContent>
          </Card>
        ) : containerStatus === "unknown" ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : isStopping ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Stopping your container…</p>
            </CardContent>
          </Card>
        ) : externalStarting ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Starting your container…</p>
            </CardContent>
          </Card>
        ) : hasNoInstance ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MonitorOff className="h-6 w-6 text-muted-foreground" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">No Cloud OBS yet</p>
                <p className="text-sm text-muted-foreground">Set it up from the dashboard first. The deck takes over from there.</p>
              </div>
              <Button size="sm" asChild>
                <Link href="/dashboard/irl/obs">Go to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : inStartFlow ? (
          <ObsBootProgress phase={isStarting ? "provisioning" : "booting"} elapsedSeconds={bootElapsed} />
        ) : isReconnecting ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Connecting to OBS…</p>
            </CardContent>
          </Card>
        ) : hasTimedOut ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm">OBS never came online. Your container is running, but we can&apos;t reach OBS inside it.</p>
              <Button variant="outline" className={cn(deckButtonClass, "w-full")} onClick={obs.reconnect}>
                <Wifi className="h-4 w-4 mr-2" />
                Retry connection
              </Button>
            </CardContent>
          </Card>
        ) : containerStatus === "stopped" ? (
          <ObsOfflineState
            status="offline"
            reason={stopReason ?? "clean"}
            starting={togglingContainer}
            onStart={canInteract && instanceId && apiUrl ? handleStart : undefined}
          />
        ) : obs.status !== "open" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <WifiOff className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm">Lost the connection to OBS.</p>
              <Button variant="outline" className={cn(deckButtonClass, "w-full")} onClick={obs.reconnect} disabled={!apiUrl || !instanceId}>
                <Wifi className="h-4 w-4 mr-2" />
                Reconnect
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stream toggle */}
            <Button
              variant={obs.isStreaming ? "destructive" : "default"}
              disabled={!canInteract || obs.togglingStream}
              onClick={obs.toggleStream}
              className={cn(deckButtonClass, "w-full")}
            >
              {obs.togglingStream ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : obs.isStreaming ? (
                <Square className="h-4 w-4 mr-2" />
              ) : (
                <Radio className="h-4 w-4 mr-2" />
              )}
              {obs.togglingStream ? "Working…" : obs.isStreaming ? "End stream" : "Go live"}
            </Button>

            {/* Current scene */}
            <Card>
              <CardContent className="space-y-1 py-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current scene</p>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500 animate-pulse" />
                  <p className="truncate text-lg font-semibold text-primary">{obs.currentScene ?? "—"}</p>
                </div>
                {obs.sceneChangedAt && (
                  <p className="text-xs tabular-nums text-muted-foreground">Updated {obs.sceneChangedAt.toLocaleTimeString()}</p>
                )}
              </CardContent>
            </Card>

            {/* Auto switcher hold state */}
            <AutoSwitcherHoldCard
              enabled={switcherEnabled}
              canInteract={canInteract}
              heldScene={heldScene}
              heldAt={heldAt}
              onReleased={handleHoldReleased}
            />

            {/* Scenes */}
            {obs.filteredScenes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No scenes found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {obs.filteredScenes.map((scene) => {
                  const isActive = scene.sceneName === obs.currentScene;
                  const isSwitching = obs.switchingTo === scene.sceneName;
                  return (
                    <Button
                      key={scene.sceneUuid}
                      variant={isActive ? "default" : "outline"}
                      disabled={obs.switchingTo !== null}
                      onClick={() => handleSceneSwitch(scene)}
                      className={cn(deckButtonClass, "relative")}
                    >
                      {isActive && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 border border-background" />}
                      {isSwitching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      <span className="truncate">{isSwitching ? "Switching…" : scene.sceneName}</span>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Stream status footer */}
            <Card>
              <CardContent className="flex items-center justify-between py-3">
                <p className="text-sm text-muted-foreground">Stream</p>
                <div className={cn("flex items-center gap-1.5 text-sm font-medium", obs.isStreaming ? "text-red-400" : "text-muted-foreground")}>
                  <Radio className={cn("h-3.5 w-3.5", obs.isStreaming && "animate-pulse")} />
                  {obs.isStreaming ? "Live" : "Offline"}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <InstallPrompt />
      </div>

      <DeckFooter
        tab={tab}
        onTabChange={handleTabChange}
        saveBar={tab === "switcher" ? saveBar : null}
        onSave={() => saveBarActionsRef.current?.save()}
        onDiscard={() => saveBarActionsRef.current?.discard()}
      />

      <AlertDialog open={discardPrompt !== null} onOpenChange={(open) => !open && setDiscardPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed some switcher settings but never saved them. Leaving now throws them away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const next = discardPrompt;
                saveBarActionsRef.current?.discard();
                setDiscardPrompt(null);
                if (next) goToTab(next);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
