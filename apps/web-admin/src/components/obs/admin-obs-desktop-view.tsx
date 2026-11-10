"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOBSViewer, CloudOBSViewerPlaceholder, mintSelkiesViewerUrl, selkiesViewerRoot } from "@repo/obs-web";
import { getInstanceNodeApiUrlAction } from "@/actions/nodes/obs";
import { adminNodeToken } from "@/lib/nodes/node-token";

// Admin's Selkies viewer lives at /admin/instances/:id/selkies/ on the node's
// API (vs. the end-user /instances/:id/selkies/), gated by the admin's own role
// instead of instance ownership. A fresh single-use ws-ticket rides on the
// framed URL; the ticket-mint POST carries a 60-second admin node token, never
// the admin's session (see lib/nodes/node-token.ts).
//
// apiUrl must come from a trusted lookup, never the query string: it decides
// which node origin the viewer frames and trusts, and the ticket goes there.
// It is resolved from the instance (getInstanceNodeApiUrlAction), the same row
// that sets the node token's aud, so the token only ever goes to the node that
// hosts it.
export function AdminObsDesktopView() {
  const searchParams = useSearchParams();
  const nodeId = searchParams.get("nodeId");
  const instanceId = searchParams.get("instanceId");
  const name = searchParams.get("name");

  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId || !instanceId) {
      setError("Missing nodeId or instanceId in the URL.");
      return;
    }

    getInstanceNodeApiUrlAction(instanceId, nodeId).then(({ data: nodeData, error: nodeError }) => {
      if (nodeError || !nodeData) {
        setError(nodeError ?? "Couldn't resolve this instance's node.");
        return;
      }
      setApiUrl(nodeData.apiUrl);
    });
  }, [nodeId, instanceId]);

  const getViewerUrl = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintSelkiesViewerUrl(apiUrl, {
      ticketPath: `/admin/instances/${instanceId}/ws-ticket`,
      viewerPath: `/admin/instances/${instanceId}/selkies/`,
      getToken: () => adminNodeToken({ instanceId }, "admin:ws-ticket"),
    });
  }, [apiUrl, instanceId]);

  if (apiUrl && instanceId && !error) {
    return (
      <CloudOBSViewer
        name={name ?? instanceId}
        viewerRoot={selkiesViewerRoot(apiUrl, `/admin/instances/${instanceId}/selkies/`)}
        getViewerUrl={getViewerUrl}
      />
    );
  }

  return <CloudOBSViewerPlaceholder error={error} pending="Resolving node…" />;
}
