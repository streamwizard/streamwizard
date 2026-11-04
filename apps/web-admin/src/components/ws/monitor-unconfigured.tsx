/** Shown on the live monitor pages when monitorWsUrl() is null. */
export function MonitorUnconfigured({ what }: { what: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Set <code className="text-xs bg-muted px-1 py-0.5 rounded">WS_SERVER_URL</code> and{" "}
      <code className="text-xs bg-muted px-1 py-0.5 rounded">WS_SERVICE_SIGNING_JWK</code> for this app to enable {what}.
      ws-server needs this app&apos;s public key in{" "}
      <code className="text-xs bg-muted px-1 py-0.5 rounded">WS_SERVICE_JWKS</code>.
    </p>
  );
}
