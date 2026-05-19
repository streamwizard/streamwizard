import { listIrlTokens, getIrlSubscriberToken } from "@/actions/irl-tokens";
import { IrlTokensClient } from "./irl-tokens-client";
import { IrlLiveMap } from "@/components/irl/irl-live-map";
import { IrlSetupGuide } from "./irl-setup-guide";
import { MapPin } from "lucide-react";
import { env } from "@repo/env/next";

export default async function IrlPage() {
  const [{ data: tokens, error }, { data: subscriberToken }] =
    await Promise.all([listIrlTokens(), getIrlSubscriberToken()]);

  const hasDevices = (tokens ?? []).length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">IRL Collector</h1>
          <p className="text-muted-foreground text-sm">
            Stream your real-time GPS location to your OBS overlays while
            broadcasting on the go.
          </p>
        </div>
      </div>

      {/* Main grid: devices left (big), map right (small) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left — Device management */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your devices
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Each device gets its own collector URL.
            </p>
          </div>
          <IrlTokensClient tokens={tokens ?? []} error={error} />
        </div>

        {/* Right — Live map */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Live location
            </p>
          </div>
          {subscriberToken ? (
            <IrlLiveMap
              subscriberToken={subscriberToken}
              wsUrl={env.NEXT_PUBLIC_WS_SERVER_URL ?? "ws://localhost:8000"}
              mapHeight="h-[320px]"
            />
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 flex flex-col items-center justify-center gap-2 h-[320px] text-center">
              <MapPin className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Create an overlay to enable the live map.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* How it works — collapsed by default when user has devices */}
      <IrlSetupGuide defaultOpen={!hasDevices} />
    </div>
  );
}
