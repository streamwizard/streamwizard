"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@repo/ui";
import { Play, Square, Wifi, WifiOff, Loader2, Radio } from "lucide-react";
import { getMyRunningInstanceAction, getInstanceNodeApiUrlAction, getInstanceObsWsPasswordAction } from "@/actions/nodes";
import { mintWsUrl } from "@/lib/ws-ticket";
import { toggleInstance } from "@/lib/instance-actions";
import { useObsWebSocket } from "@/hooks/use-obs-websocket";
import { ObsVncPreview } from "@/components/irl/obs-vnc-preview";
import { ObsSourceProfiler } from "@/components/irl/obs-source-profiler";
import { ObsResourceGraphs } from "@/components/irl/obs-resource-graphs";
import { ObsFileUploader } from "@/components/irl/obs-file-uploader";
import { ObsMessageLog } from "@/components/irl/obs-message-log";
import { cn } from "@repo/ui";

export default function IrlObsPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [obsWsPassword, setObsWsPassword] = useState<string | null>(null);
  const [containerStatus, setContainerStatus] = useState<"running" | "stopped" | "unknown">("unknown");
  const [togglingContainer, setTogglingContainer] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: instance } = await getMyRunningInstanceAction();
      if (!instance) {
        setContainerStatus("stopped");
        return;
      }
      setInstanceId(instance.id);
      setContainerStatus("running");

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
    const params = new URLSearchParams({ instanceId, name: "Cloud OBS" });
    window.open(`/obs-viewer?${params.toString()}`, "obs-viewer", "width=1280,height=800");
  };

  const handleToggleContainer = async () => {
    if (!apiUrl || !instanceId) return;
    setTogglingContainer(true);
    try {
      const action = containerStatus === "running" ? "stop" : "start";
      await toggleInstance(apiUrl, instanceId, action);
      setContainerStatus(action === "start" ? "running" : "stopped");
    } catch {
      // TODO: surface error toast
    } finally {
      setTogglingContainer(false);
    }
  };

  const statusVariant =
    obs.status === "open" ? "default" : obs.status === "connecting" ? "secondary" : "outline";

  return (
    <div className="w-full space-y-6">
      {/* Top section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* VNC preview */}
        <ObsVncPreview
          instanceId={instanceId}
          isConnected={obs.status === "open"}
          onOpen={openViewer}
        />

        {/* Right panel */}
        <div className="flex-1 space-y-4">
          {/* Title + WS status */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Cloud OBS</h2>
            <Badge variant={statusVariant} className="gap-1.5">
              {obs.status === "open" && <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />}
              {obs.status === "connecting" && <Loader2 className="h-3 w-3 animate-spin" />}
              {obs.status === "closed" && <WifiOff className="h-3 w-3" />}
              {obs.status === "open" ? "OBS Connected" : obs.status === "connecting" ? "Connecting…" : "Disconnected"}
            </Badge>
            {obs.status === "closed" && apiUrl && instanceId && (
              <Button size="sm" variant="outline" onClick={obs.connect}>
                <Wifi className="h-3.5 w-3.5 mr-1.5" />
                Reconnect
              </Button>
            )}
          </div>

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
                disabled={obs.togglingStream}
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
                {containerStatus === "running"
                  ? "Your OBS container is running"
                  : containerStatus === "stopped"
                  ? "Container is stopped"
                  : "Checking status…"}
              </p>
            </div>
            <Button
              size="sm"
              variant={containerStatus === "running" ? "destructive" : "default"}
              disabled={togglingContainer || !instanceId || !apiUrl}
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
                ? "Working…"
                : containerStatus === "running"
                ? "Stop container"
                : "Start container"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scenes">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="scenes">Scenes</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Scenes tab */}
        <TabsContent value="scenes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Scene Switcher</CardTitle>
            </CardHeader>
            <CardContent>
              {obs.status !== "open" ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {obs.status === "connecting" ? "Connecting to OBS…" : "Not connected to OBS"}
                </p>
              ) : obs.filteredScenes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No scenes found</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {obs.filteredScenes.map((scene) => {
                    const isActive = scene.sceneName === obs.currentScene;
                    const isSwitching = obs.switchingTo === scene.sceneName;
                    return (
                      <Button
                        key={scene.sceneName}
                        size="sm"
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
        </TabsContent>

        {/* Sources tab */}
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Source Profiler</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              <ObsSourceProfiler
                sourceStats={obs.sourceStats}
                onSetSceneItemEnabled={obs.setSceneItemEnabled}
                onSetSourceFilterEnabled={obs.setSourceFilterEnabled}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources tab */}
        <TabsContent value="resources" className="mt-4">
          <ObsResourceGraphs obsStats={obs.obsStats} />
        </TabsContent>

        {/* Files tab */}
        <TabsContent value="files" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">File Uploader</CardTitle>
            </CardHeader>
            <CardContent>
              <ObsFileUploader />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs tab */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">WebSocket Messages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ObsMessageLog entries={obs.logEntries} onClear={obs.clearLog} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
