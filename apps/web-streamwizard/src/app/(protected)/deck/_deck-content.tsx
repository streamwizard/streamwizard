"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, cn } from "@repo/ui";
import { AlertTriangle, Loader2, MonitorOff, Radio, Square, Wifi, WifiOff } from "lucide-react";
import { getMyLatestInstanceAction, getInstanceNodeApiUrlAction, getInstanceObsWsPasswordAction } from "@/actions/nodes";
import { setSceneOverride } from "@/actions/supabase/auto-switcher";
import { mintWsUrl } from "@/lib/ws-ticket";
import { toggleInstance } from "@/lib/instance-actions";
import { useObsWebSocket, type Scene } from "@/hooks/use-obs-websocket";
import { ObsBootProgress } from "@/components/irl/obs-boot-progress";
import { ObsOfflineState } from "@/components/irl/obs-offline-state";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import { AutoSwitcherHoldCard } from "./_auto-switcher-hold-card";
import { InstallPrompt } from "./_install-prompt";

interface DeckContentProps {
  canInteract: boolean;
  autoSwitcher: {
    enabled: boolean;
    initialOverride: { sceneName: string | null } | null;
  };
}

// Tall touch targets: an IRL streamer is tapping this one-handed on a phone
// while walking, so every actionable button gets the same oversized shape.
const deckButtonClass = "h-24 rounded-2xl text-base font-semibold";

export function DeckContent({ canInteract, autoSwitcher }: DeckContentProps) {
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
  const [heldScene, setHeldScene] = useState<string | null>(autoSwitcher.initialOverride?.sceneName ?? null);
  const [heldAt, setHeldAt] = useState(0);
  // True from a deck-initiated container start until OBS connects; gates the
  // boot stepper so plain websocket reconnects don't look like OBS restarting.
  const [startRequested, setStartRequested] = useState(false);
  // Only toast "OBS connected" for a connect the user initiated from this page,
  // not the passive connect when the deck loads against an already-running box.
  const awaitingConnectRef = useRef(false);

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
      setInstanceId(instance.id);
      setContainerStatus(instance.status === "running" ? "running" : "stopped");

      const [{ data: nodeData }, { data: passwordData }] = await Promise.all([
        getInstanceNodeApiUrlAction(instance.id),
        getInstanceObsWsPasswordAction(instance.id),
      ]);

      if (!nodeData || !passwordData) {
        setLoadError("Couldn't load your container info. Refresh to try again?");
        return;
      }
      setApiUrl(nodeData.apiUrl);
      setObsWsPassword(passwordData.password);
    }
    init();
  }, []);

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

  const handleStart = async () => {
    if (!apiUrl || !instanceId) return;
    setTogglingContainer(true);
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

    if (!autoSwitcher.enabled) return;
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
  const { reconnect } = obs;
  useEffect(() => {
    const maybeReconnect = () => {
      if (document.visibilityState !== "visible") return;
      if (containerStatus !== "running" || obs.status !== "closed" || !apiUrl || !instanceId) return;
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
  }, [containerStatus, obs.status, apiUrl, instanceId, reconnect]);

  const statusVariant =
    obs.status === "open" ? "default" : hasTimedOut ? "destructive" : inStartFlow || isReconnecting ? "secondary" : "outline";

  return (
    <main className="min-h-dvh bg-background px-4 py-6 select-none [touch-action:manipulation]">
      <div className="mx-auto w-full max-w-md space-y-4">
        {!canInteract && <FeatureDisabledBanner />}

        {/* Title + connection status */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Stream Deck</h1>
          <Badge variant={statusVariant} className="gap-1.5">
            {obs.status === "open" && <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />}
            {(inStartFlow || isReconnecting) && <Loader2 className="h-3 w-3 animate-spin" />}
            {hasTimedOut && <AlertTriangle className="h-3 w-3" />}
            {!inStartFlow && !isReconnecting && !hasTimedOut && obs.status === "closed" && <WifiOff className="h-3 w-3" />}
            {obs.status === "open"
              ? "OBS Connected"
              : hasTimedOut
              ? "Not responding"
              : isStarting
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

        {loadError ? (
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
              enabled={autoSwitcher.enabled}
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
    </main>
  );
}
