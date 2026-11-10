"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CloudOBSViewer,
  CloudOBSViewerPlaceholder,
  mintSelkiesViewerUrl,
  mintWsUrl,
  selkiesViewerRoot,
  useObsWebSocket,
} from "@repo/obs-web";
import { getInstanceNodeApiUrlAction, getInstanceObsWsPasswordAction } from "@/actions/obs/nodes";
import { IngestSourceProblemDialog } from "@/components/irl/ingest-source-problem-dialog";
import { BrowserSourceAudioTipDialog } from "@/components/irl/viewer/browser-source-audio-tip-dialog";
import { ViewerAddBrowserSource } from "@/components/irl/viewer/viewer-add-browser-source";
import { ViewerAddIngestSource } from "@/components/irl/viewer/viewer-add-ingest-source";
import { StreamWizardLogo } from "@/components/shared/streamwizard-logo";
import { useBrowserSourceAudioTip } from "@/hooks/obs/use-browser-source-audio-tip";
import { useIngestSourceGuard } from "@/hooks/obs/use-ingest-source-guard";
import { nodeToken } from "@/lib/obs/node-token";

type ObsViewerContentProps = {
  canInteract: boolean;
  /** The ingest node's host, for the URL of a feed added from the header. */
  obsPullHost: string;
};

export function ObsViewerContent({ canInteract, obsPullHost }: ObsViewerContentProps) {
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instanceId");
  const name = searchParams.get("name") ?? "Cloud OBS";

  // apiUrl comes from a trusted server-side lookup, never the query string:
  // it decides which node origin CloudOBSViewer frames and trusts.
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [obsWsPassword, setObsWsPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId) {
      setError("Missing instanceId in the URL.");
      return;
    }

    getInstanceNodeApiUrlAction(instanceId).then(({ data: nodeData, error: nodeError }) => {
      if (nodeError || !nodeData) {
        setError(nodeError ?? "Couldn't resolve this instance's node API URL.");
        return;
      }
      setApiUrl(nodeData.apiUrl);
    });
    // Only the add buttons and the ingest source warning need OBS itself; without
    // the password the desktop still opens and those stay off.
    getInstanceObsWsPasswordAction(instanceId).then(({ data }) => {
      if (data) setObsWsPassword(data.password);
    });
  }, [instanceId]);

  const getViewerUrl = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintSelkiesViewerUrl(apiUrl, {
      ticketPath: `/instances/${instanceId}/ws-ticket`,
      viewerPath: `/instances/${instanceId}/selkies/`,
      getToken: () => nodeToken(instanceId, "ws-ticket"),
    });
  }, [apiUrl, instanceId]);

  // This window's own OBS connection, so the add buttons and the ingest source
  // warning work with the dashboard tab closed.
  const getWsUrl = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintWsUrl(apiUrl, {
      ticketPath: `/instances/${instanceId}/ws-ticket`,
      wsPath: `/instances/${instanceId}/obsws`,
      scope: "obsws",
      getToken: () => nodeToken(instanceId, "ws-ticket"),
    });
  }, [apiUrl, instanceId]);
  const obs = useObsWebSocket({
    getWsUrl: apiUrl && instanceId && obsWsPassword ? getWsUrl : null,
    password: obsWsPassword,
  });

  // Warns on top of the desktop when an ingest source is removed or its link
  // breaks. The dashboard runs its own copy; during its guided setup it puts
  // a missing source back itself, which closes this warning too.
  const ingestGuard = useIngestSourceGuard({ obs, obsPullHost, enabled: canInteract });
  // Once per browser: a browser source added here without OBS audio.
  const audioTip = useBrowserSourceAudioTip({ obs, enabled: canInteract });

  if (apiUrl && instanceId && !error) {
    return (
      <>
        <CloudOBSViewer
          name={name}
          logo={<StreamWizardLogo width={24} height={24} className="text-white" />}
          onReconnect={obs.reconnect}
          actions={
            <>
              <ViewerAddIngestSource obs={obs} canInteract={canInteract} obsPullHost={obsPullHost} />
              <ViewerAddBrowserSource obs={obs} canInteract={canInteract} />
            </>
          }
          viewerRoot={selkiesViewerRoot(apiUrl, `/instances/${instanceId}/selkies/`)}
          getViewerUrl={getViewerUrl}
        />
        <IngestSourceProblemDialog
          state={ingestGuard.state}
          problem={ingestGuard.problem}
          onPutBack={ingestGuard.putBack}
          onLeave={ingestGuard.leave}
        />
        <BrowserSourceAudioTipDialog
          sourceName={audioTip.sourceName}
          fixing={audioTip.fixing}
          onFix={audioTip.fix}
          onClose={audioTip.close}
        />
      </>
    );
  }

  return <CloudOBSViewerPlaceholder error={error} pending="Resolving instance…" />;
}
