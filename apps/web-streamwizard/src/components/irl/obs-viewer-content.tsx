"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOBSViewer, CloudOBSViewerPlaceholder, mintSelkiesViewerUrl, selkiesViewerRoot } from "@repo/obs-web";
import { getInstanceNodeApiUrlAction } from "@/actions/obs/nodes";
import { StreamWizardLogo } from "@/components/shared/streamwizard-logo";
import { nodeToken } from "@/lib/obs/node-token";

export function ObsViewerContent() {
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instanceId");
  const name = searchParams.get("name") ?? "Cloud OBS";

  // apiUrl comes from a trusted server-side lookup, never the query string:
  // it decides which node origin CloudOBSViewer frames and trusts.
  const [apiUrl, setApiUrl] = useState<string | null>(null);
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
  }, [instanceId]);

  const getViewerUrl = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintSelkiesViewerUrl(apiUrl, {
      ticketPath: `/instances/${instanceId}/ws-ticket`,
      viewerPath: `/instances/${instanceId}/selkies/`,
      getToken: () => nodeToken(instanceId, "ws-ticket"),
    });
  }, [apiUrl, instanceId]);

  if (apiUrl && instanceId && !error) {
    return (
      <CloudOBSViewer
        name={name}
        logo={<StreamWizardLogo width={24} height={24} className="text-white" />}
        viewerRoot={selkiesViewerRoot(apiUrl, `/instances/${instanceId}/selkies/`)}
        getViewerUrl={getViewerUrl}
      />
    );
  }

  return <CloudOBSViewerPlaceholder error={error} pending="Resolving instance…" />;
}
