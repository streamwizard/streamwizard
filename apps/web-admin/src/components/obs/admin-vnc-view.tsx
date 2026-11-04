"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOBSViewer } from "@repo/obs-web";
import { getInstanceNodeApiUrlAction } from "@/actions/nodes/obs";
import { mintNoVncConnection } from "@repo/obs-web";
import { adminNodeToken } from "@/lib/nodes/node-token";

// Admin's noVNC proxy lives at /admin/instances/:id/novnc on the node's API
// (vs. the end-user /instances/:id/novnc), gated by the admin's own role
// instead of instance ownership. A fresh single-use ws-ticket rides on the
// socket; the ticket-mint POST carries a 60-second admin node token, never the
// admin's session (see lib/nodes/node-token.ts).
//
// apiUrl must come from a trusted lookup, never the query string -- the URL
// gets a ticket appended and dialed as a WebSocket. It is resolved from the
// instance (getInstanceNodeApiUrlAction), the same row that sets the node
// token's aud, so the token only ever goes to the node that hosts it.
export function AdminVncView() {
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

  const getConnection = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintNoVncConnection(apiUrl, {
      ticketPath: `/admin/instances/${instanceId}/ws-ticket`,
      wsPath: `/admin/instances/${instanceId}/novnc`,
      getToken: () => adminNodeToken({ instanceId }, "admin:ws-ticket"),
    });
  }, [apiUrl, instanceId]);

  return (
    <div className="flex h-screen w-screen flex-col bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-sm text-white">{name ?? instanceId}</span>
      </div>
      <div className="flex-1">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-400">{error}</p>
            <button className="text-xs text-white/40 underline underline-offset-2" onClick={() => window.close()}>
              Close window
            </button>
          </div>
        ) : apiUrl && instanceId ? (
          <CloudOBSViewer getConnection={getConnection} />
        ) : (
          <p className="p-4 text-sm text-white/60">Resolving node…</p>
        )}
      </div>
    </div>
  );
}
