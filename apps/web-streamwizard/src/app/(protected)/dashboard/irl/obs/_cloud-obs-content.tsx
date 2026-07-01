"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/ui";
import { Play, Square, Wifi, WifiOff, Loader2, Radio, Rocket, AlertTriangle, Gauge, Layers, FolderUp } from "lucide-react";
import { getMyLatestInstanceAction, getInstanceNodeApiUrlAction, getInstanceObsWsPasswordAction, launchMyInstanceAction } from "@/actions/nodes";
import { mintWsUrl } from "@/lib/ws-ticket";
import { toggleInstance } from "@/lib/instance-actions";
import { useObsWebSocket } from "@/hooks/use-obs-websocket";
import { ObsVncPreview } from "@/components/irl/obs-vnc-preview";
import { ObsBootProgress } from "@/components/irl/obs-boot-progress";
import { ObsOfflineState } from "@/components/irl/obs-offline-state";
import { ObsSetupStepper } from "@/components/irl/obs-setup-stepper";
import { useSessionStore } from "@/stores/session-store";
import { ObsSourceProfiler } from "@/components/irl/obs-source-profiler";
import { ObsResourceGraphs } from "@/components/irl/obs-resource-graphs";
import { ObsFileUploader } from "@/components/irl/obs-file-uploader";
import { ObsIngestSources } from "@/components/irl/obs-ingest-sources";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import { cn } from "@repo/ui";
import type { ProductAccess } from "@/lib/require-product-access";
import type { IngestStreamKey } from "@/actions/ingest-keys";
import { listOutputKeys } from "@/actions/ingest-output-keys";
import { ALERTS_SCENE_NAME, IRL_SCENE_NAME, IRL_SOURCE_NAME, obsPullUrl } from "@/lib/obs-irl";

interface CloudObsContentProps {
  canInteract: boolean;
  plan: ProductAccess["plan"];
  initialIngestKeys: IngestStreamKey[];
  ingestHost: string;
}

export function CloudObsContent({ canInteract, plan: _plan, initialIngestKeys, ingestHost }: CloudObsContentProps) {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [obsWsPassword, setObsWsPassword] = useState<string | null>(null);
  const [containerStatus, setContainerStatus] = useState<"running" | "stopped" | "unknown">("unknown");
  const [togglingContainer, setTogglingContainer] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [bootElapsed, setBootElapsed] = useState(0);
  const [ingestKeys, setIngestKeys] = useState<IngestStreamKey[]>(initialIngestKeys);
  // Set once the user opens OBS from the stepper (step 4) — unlocks step 5
  // (alerts, optional) but doesn't end the guided flow by itself.
  const [hasOpenedViewer, setHasOpenedViewer] = useState(false);
  // Set once the user finishes or skips step 5 — this is what actually ends
  // the guided flow and reveals the normal dashboard.
  const [setupComplete, setSetupComplete] = useState(false);
  // Decided once, the moment we know whether this looks like an incomplete
  // setup (no key and/or no container yet). Stays true through the whole
  // launch/boot/connect sequence — even once the key and container both
  // exist — so the guided flow doesn't disappear mid-walkthrough just
  // because a step completed. Only clears once the user finishes step 5.
  // `null` means "not decided yet" (waiting on the initial instance lookup).
  const [onboardingFlow, setOnboardingFlow] = useState<boolean | null>(null);
  // Tracks the containerStatus value onboardingFlow was last derived from, so
  // the "adjust state during render" below only fires the one time
  // containerStatus resolves out of "unknown" — not on every render.
  const [resolvedFor, setResolvedFor] = useState<typeof containerStatus | null>(null);
  const memesEnabled = useSessionStore((s) => s.preferences.memes_enabled);
  // True while we're expecting OBS to come online from a user-initiated launch
  // or start, so the "OBS connected" toast only fires for those flows and not
  // on a passive reconnect when the page first loads an already-running box.
  const awaitingConnectRef = useRef(false);
  // Set when a key is created this session and not yet wired into OBS — lets
  // the auto-wire effect add it silently instead of just notifying. Lost on
  // reload (accepted tradeoff, avoids a persisted "pending wire" flag).
  const justCreatedKeyIdRef = useRef<string | null>(null);
  // Notify about a missing ingest source at most once per OBS connection,
  // not once per scene refetch while connected.
  const notifiedMissingThisConnectionRef = useRef(false);

  const handleKeyCreated = (key: IngestStreamKey) => {
    setIngestKeys((prev) => [key, ...prev]);
    justCreatedKeyIdRef.current = key.id;
  };

  useEffect(() => {
    async function init() {
      // Look up the user's most recent instance regardless of status -- a
      // stopped instance still needs to be picked up here so the "Start
      // container" flow is used instead of provisioning a brand new one.
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

      if (!nodeData || !passwordData) return;
      setApiUrl(nodeData.apiUrl);
      setObsWsPassword(passwordData.password);
    }
    init();
  }, []);

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const { data, error } = await launchMyInstanceAction();
      if (error || !data) {
        const message = error ?? "Couldn't launch. Try again?";
        setLaunchError(message);
        toast.error("Couldn't launch Cloud OBS", { description: message });
        return;
      }
      awaitingConnectRef.current = true;
      setInstanceId(data.instance.id);
      setApiUrl(data.apiUrl);
      setObsWsPassword(data.password);
      setContainerStatus("running");
      toast.success("Cloud OBS launched", {
        description: "Your container is booting. Give it a few seconds.",
      });
    } catch {
      const message = "Something broke while launching. Try again?";
      setLaunchError(message);
      toast.error("Couldn't launch Cloud OBS", { description: message });
    } finally {
      setLaunching(false);
    }
  };

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

  const openViewer = () => {
    if (!instanceId) return;
    setHasOpenedViewer(true);
    const params = new URLSearchParams({ instanceId, name: "Cloud OBS" });
    window.open(`/obs-viewer?${params.toString()}`, "obs-viewer", "width=1280,height=800");
  };

  const handleToggleContainer = async () => {
    if (!apiUrl || !instanceId) return;
    const action = containerStatus === "running" ? "stop" : "start";
    setTogglingContainer(true);
    try {
      await toggleInstance(apiUrl, instanceId, action);
      setContainerStatus(action === "start" ? "running" : "stopped");
      if (action === "start") {
        awaitingConnectRef.current = true;
        // reconnect (not connect) resets the retry budget, so a restart after a
        // previous boot timeout will actually retry instead of giving up at once.
        obs.reconnect();
        toast.success("Starting your container", { description: "OBS is booting up." });
      } else {
        awaitingConnectRef.current = false;
        toast.success("Container stopped");
      }
    } catch (err) {
      toast.error(action === "start" ? "Couldn't start the container" : "Couldn't stop the container", {
        description: err instanceof Error ? err.message : "Try again?",
      });
    } finally {
      setTogglingContainer(false);
    }
  };

  // Launch flow phases — provisioning (server action in flight for a *start*),
  // booting (container up, OBS WS connecting/retrying), connected, or timed out.
  const isProvisioning = launching || (togglingContainer && containerStatus !== "running");
  const isBooting =
    !isProvisioning &&
    containerStatus === "running" &&
    obs.status !== "open" &&
    !obs.hasTimedOut &&
    (obs.status === "connecting" || obs.isAutoRetrying);
  const inLaunchFlow = isProvisioning || isBooting;
  const hasTimedOut = containerStatus === "running" && obs.hasTimedOut && obs.status !== "open";

  // Lock in whether this is a guided setup once we actually know the user's
  // instance state (containerStatus starts "unknown" until the initial fetch
  // resolves) — a returning user with both a key and a running container
  // never sees the stepper; anyone missing either does, all the way through
  // to opening OBS. Adjusting state during render (rather than in an effect)
  // is the React-blessed way to derive state from a prop/value change once.
  if (containerStatus !== "unknown" && resolvedFor !== containerStatus) {
    setResolvedFor(containerStatus);
    if (onboardingFlow === null) {
      setOnboardingFlow(!instanceId || ingestKeys.length === 0);
    }
  }
  const showSetupStepper = (onboardingFlow ?? false) && !setupComplete;

  // Single elapsed timer that spans the whole launch flow. Keying the effect on
  // the boolean keeps it running continuously across provisioning → booting and
  // only resets once the flow ends.
  useEffect(() => {
    if (!inLaunchFlow) {
      setBootElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setBootElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [inLaunchFlow]);

  // Closure toast once OBS actually connects after a user-initiated launch/start.
  useEffect(() => {
    if (obs.status === "open" && awaitingConnectRef.current) {
      awaitingConnectRef.current = false;
      toast.success("OBS connected", { description: "You're ready to go live." });
    }
  }, [obs.status]);

  // Reset the "already notified" guard whenever we leave a connected session,
  // so a fresh connection gets its own chance to notify about a missing source.
  useEffect(() => {
    if (obs.status !== "open") {
      notifiedMissingThisConnectionRef.current = false;
    }
  }, [obs.status]);

  // Auto-wire the primary ingest key into the fixed "IRL" scene once OBS is
  // connected and scenes have actually loaded (status flips to "open" slightly
  // before fetchScenes() resolves, so wait for scenes rather than acting on
  // stale/empty data). Only a key created THIS session gets wired silently —
  // everything else is notify-only, so we never fight a user who deliberately
  // removed the source. Only the primary (most recent) key is ever auto-wired;
  // creating a second key never rewires "StreamWizard Ingest" onto it, since
  // the fixed source name means detection is keyed by name, not by key. That's
  // intentional — additional keys stay manual-only via the list below.
  useEffect(() => {
    if (obs.status !== "open" || obs.scenes.length === 0) return;
    const primaryKey = ingestKeys[0];
    if (!primaryKey) return;
    if (obs.sceneHasSource(IRL_SCENE_NAME, IRL_SOURCE_NAME)) return;

    let cancelled = false;
    (async () => {
      const { data: outputKeys } = await listOutputKeys(primaryKey.id);
      const outputKey = outputKeys?.[0];
      if (!outputKey || cancelled) return;

      await obs.ensureSceneExists(IRL_SCENE_NAME);
      if (cancelled || obs.sceneHasSource(IRL_SCENE_NAME, IRL_SOURCE_NAME)) return;

      const justCreated = justCreatedKeyIdRef.current === primaryKey.id;
      if (justCreated) {
        try {
          await obs.addMediaSourceToScene(IRL_SCENE_NAME, IRL_SOURCE_NAME, obsPullUrl(outputKey.output_key));
          justCreatedKeyIdRef.current = null;
          toast.success("Ingest source added to OBS", {
            description: `Your feed is now wired into the "${IRL_SCENE_NAME}" scene.`,
          });
        } catch (err) {
          toast.error("Couldn't auto-add your ingest source", {
            description: err instanceof Error ? err.message : "Add it manually from the Ingest tab.",
          });
        }
      } else if (!notifiedMissingThisConnectionRef.current) {
        notifiedMissingThisConnectionRef.current = true;
        toast.error("Your ingest source is missing from OBS", {
          description: `The "${IRL_SOURCE_NAME}" source isn't in your ${IRL_SCENE_NAME} scene.`,
          action: {
            label: "Add it",
            onClick: () => {
              obs
                .addMediaSourceToScene(IRL_SCENE_NAME, IRL_SOURCE_NAME, obsPullUrl(outputKey.output_key))
                .then(() =>
                  toast.success("Added to OBS", { description: `Wired into the "${IRL_SCENE_NAME}" scene.` }),
                )
                .catch((err) =>
                  toast.error("Couldn't add it", {
                    description: err instanceof Error ? err.message : "Try again?",
                  }),
                );
            },
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [obs.status, obs.scenes.length, obs.sceneItems, ingestKeys]);

  // The container is up but OBS never became reachable within the retry budget.
  useEffect(() => {
    if (obs.hasTimedOut) {
      awaitingConnectRef.current = false;
      toast.error("OBS isn't responding", {
        description: "Your container's running, but OBS never came online.",
        action: { label: "Retry", onClick: () => obs.reconnect() },
      });
    }
  }, [obs.hasTimedOut, obs.reconnect]);

  const statusVariant =
    obs.status === "open" ? "default" : hasTimedOut ? "destructive" : inLaunchFlow ? "secondary" : "outline";

  if (showSetupStepper) {
    return (
      <div className="w-full space-y-6">
        {!canInteract && <FeatureDisabledBanner />}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ObsVncPreview
            instanceId={instanceId}
            status={obs.status === "open" ? "connected" : inLaunchFlow ? "booting" : "offline"}
            onOpen={openViewer}
          />
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold">Cloud OBS</h2>
              <Badge variant={statusVariant} className="gap-1.5">
                {obs.status === "open" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                )}
                {inLaunchFlow && <Loader2 className="h-3 w-3 animate-spin" />}
                {hasTimedOut && <AlertTriangle className="h-3 w-3" />}
                {obs.status === "open"
                  ? "OBS Connected"
                  : hasTimedOut
                  ? "Not responding"
                  : isProvisioning
                  ? "Starting up…"
                  : isBooting
                  ? "OBS booting…"
                  : "Offline"}
              </Badge>
            </div>
            <ObsSetupStepper
              canInteract={canInteract}
              hasKey={ingestKeys.length > 0}
              onKeyCreated={handleKeyCreated}
              instanceId={instanceId}
              containerStatus={containerStatus}
              launching={launching}
              togglingContainer={togglingContainer}
              launchError={launchError}
              onLaunch={handleLaunch}
              onStartContainer={handleToggleContainer}
              obsStatus={obs.status}
              isBooting={isBooting}
              hasTimedOut={hasTimedOut}
              onReconnect={obs.reconnect}
              hasOpenedViewer={hasOpenedViewer}
              onOpenViewer={openViewer}
              scenes={obs.filteredScenes}
              alertSceneItems={obs.sceneItems[ALERTS_SCENE_NAME] ?? []}
              onAddAlertSource={obs.addBrowserSourceToScene}
              onAddAlertSourceClone={obs.addSourceCloneToScene}
              onFinishSetup={() => setSetupComplete(true)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {!canInteract && <FeatureDisabledBanner />}

      {/* Top section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* VNC preview */}
        <ObsVncPreview
          instanceId={instanceId}
          status={obs.status === "open" ? "connected" : inLaunchFlow ? "booting" : "offline"}
          onOpen={openViewer}
        />

        {/* Right panel */}
        <div className="flex-1 space-y-4">
          {/* Title + WS status */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Cloud OBS</h2>
            <Badge variant={statusVariant} className="gap-1.5">
              {obs.status === "open" && <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />}
              {inLaunchFlow && <Loader2 className="h-3 w-3 animate-spin" />}
              {hasTimedOut && <AlertTriangle className="h-3 w-3" />}
              {!inLaunchFlow && !hasTimedOut && obs.status === "closed" && <WifiOff className="h-3 w-3" />}
              {obs.status === "open"
                ? "OBS Connected"
                : hasTimedOut
                ? "Not responding"
                : isProvisioning
                ? "Starting up…"
                : isBooting
                ? "OBS booting…"
                : containerStatus === "running"
                ? "Disconnected"
                : "Offline"}
            </Badge>
            {containerStatus === "running" && obs.status === "closed" && !inLaunchFlow && !hasTimedOut && apiUrl && instanceId && (
              <Button size="sm" variant="outline" onClick={obs.reconnect}>
                <Wifi className="h-3.5 w-3.5 mr-1.5" />
                Reconnect
              </Button>
            )}
          </div>

          {/* Launch / boot progress */}
          {inLaunchFlow && (
            <ObsBootProgress phase={isProvisioning ? "provisioning" : "booting"} elapsedSeconds={bootElapsed} />
          )}

          {/* Timed out — container is up but OBS never connected */}
          {hasTimedOut && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1 space-y-2">
                <p className="text-sm">
                  OBS never came online. Your container is running, but we can&apos;t reach OBS inside it.
                </p>
                <Button size="sm" variant="outline" onClick={obs.reconnect}>
                  <Wifi className="h-3.5 w-3.5 mr-1.5" />
                  Retry connection
                </Button>
              </div>
            </div>
          )}

          {/* Stream status */}
          {obs.status === "open" && (
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn("gap-1.5", obs.isStreaming ? "border-red-500/50 text-red-400" : "text-muted-foreground")}
              >
                <Radio className={cn("h-3 w-3", obs.isStreaming && "animate-pulse")} />
                {obs.isStreaming ? "Streaming" : "Not streaming"}
              </Badge>
              <Button
                size="sm"
                variant={obs.isStreaming ? "destructive" : "default"}
                disabled={!canInteract || obs.togglingStream}
                onClick={obs.toggleStream}
              >
                {obs.togglingStream ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : obs.isStreaming ? (
                  <Square className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Radio className="h-3.5 w-3.5 mr-1.5" />
                )}
                {obs.togglingStream ? "Working…" : obs.isStreaming ? "Stop stream" : "Go live"}
              </Button>
            </div>
          )}

          {/* Container control */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <div>
              <p className="text-sm font-medium">Container</p>
              <p className="text-xs text-muted-foreground">
                {isProvisioning
                  ? "Provisioning your container…"
                  : isBooting
                  ? "Container's up. Waiting for OBS."
                  : obs.status === "open"
                  ? "Your OBS container is running"
                  : hasTimedOut
                  ? "Container's running, but we can't reach OBS"
                  : containerStatus === "running"
                  ? "Your OBS container is running"
                  : containerStatus === "stopped" && !instanceId
                  ? "No container running. Launch one to get started."
                  : containerStatus === "stopped"
                  ? "Container is stopped"
                  : "Checking status…"}
              </p>
              {launchError && (
                <p className="text-xs text-destructive mt-1">{launchError}</p>
              )}
            </div>
            {containerStatus === "stopped" && !instanceId ? (
              <Button
                size="sm"
                disabled={!canInteract || launching}
                onClick={handleLaunch}
                className="ml-auto"
              >
                {launching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Rocket className="h-3.5 w-3.5 mr-1.5" />
                )}
                {launching ? "Launching…" : "Launch Cloud OBS"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant={containerStatus === "running" ? "destructive" : "default"}
                disabled={!canInteract || togglingContainer || !instanceId || !apiUrl}
                onClick={handleToggleContainer}
                className="ml-auto"
              >
                {togglingContainer ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : containerStatus === "running" ? (
                  <Square className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                {togglingContainer
                  ? containerStatus === "running"
                    ? "Stopping…"
                    : "Starting…"
                  : containerStatus === "running"
                  ? "Stop container"
                  : "Start container"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Controls — only meaningful once OBS is actually connected. When it
          isn't, the strip would just be empty shells, so swap the whole thing
          for a single offline/booting state instead. */}
      {obs.status !== "open" ? (
        <ObsOfflineState status={inLaunchFlow ? "booting" : "offline"} memesEnabled={memesEnabled} />
      ) : (
        <div className="space-y-6">
          {/* Scenes — the primary in-stream control, front and center */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Scenes</CardTitle>
            </CardHeader>
            <CardContent>
              {obs.filteredScenes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No scenes found</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {obs.filteredScenes.map((scene) => {
                    const isActive = scene.sceneName === obs.currentScene;
                    const isSwitching = obs.switchingTo === scene.sceneName;
                    return (
                      <Button
                        key={scene.sceneName}
                        variant={isActive ? "default" : "outline"}
                        disabled={isSwitching || obs.switchingTo !== null}
                        onClick={() => obs.switchScene(scene.sceneName)}
                        className="relative"
                      >
                        {isActive && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 border border-background" />
                        )}
                        {isSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        {isSwitching ? "Switching…" : scene.sceneName}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sources / Performance / Files — tabbed so only one dense panel
              is on screen at a time instead of everything stacked and
              fully expanded, which is what made the live view feel noisy. */}
          <Tabs defaultValue="sources">
            <TabsList>
              <TabsTrigger value="sources">
                <Layers className="h-3.5 w-3.5" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="performance">
                <Gauge className="h-3.5 w-3.5" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="files">
                <FolderUp className="h-3.5 w-3.5" />
                Files
              </TabsTrigger>
              <TabsTrigger value="ingest">
                <Radio className="h-3.5 w-3.5" />
                Ingest
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sources">
              <Card>
                <CardContent className="px-2 pt-4">
                  <ObsSourceProfiler
                    sourceStats={obs.sourceStats}
                    onSetSceneItemEnabled={obs.setSceneItemEnabled}
                    onSetSourceFilterEnabled={obs.setSourceFilterEnabled}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardContent className="pt-4">
                  <ObsResourceGraphs obsStats={obs.obsStats} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files">
              <Card>
                <CardContent className="pt-4">
                  <ObsFileUploader />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ingest">
              <Card>
                <CardContent className="pt-4">
                  <ObsIngestSources
                    scenes={obs.scenes}
                    currentScene={obs.currentScene}
                    canInteract={canInteract}
                    onAddToScene={obs.addMediaSourceToScene}
                    initialIngestKeys={ingestKeys}
                    ingestHost={ingestHost}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
