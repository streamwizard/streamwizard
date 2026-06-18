"use client";

import { useTransition } from "react";
import { linkDiscord, unlinkDiscord } from "@/actions/auth/link-discord";
import { Badge, Button, Card, CardContent, CardHeader } from "@repo/ui";
import { IntegrationIcon } from "@/components/settings/integration-icon";

export function DiscordIntegrationSection({ discordUsername }: { discordUsername: string | null }) {
  const [isPending, startTransition] = useTransition();
  const isConnected = Boolean(discordUsername);

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <IntegrationIcon provider="discord" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-none">Discord</h3>
            <Badge variant={isConnected ? "default" : "outline"} className={isConnected ? "bg-[#5865F2] text-white" : ""}>
              {isConnected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Unlocks the Linked Role in our server. No more &ldquo;are you actually one of us&rdquo; energy.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm">
              Connected as <strong>{discordUsername}</strong>
            </p>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => startTransition(() => unlinkDiscord())}
            >
              {isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        ) : (
          <Button disabled={isPending} onClick={() => startTransition(() => linkDiscord())}>
            {isPending ? "Connecting…" : "Connect Discord"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
