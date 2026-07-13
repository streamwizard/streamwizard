"use client";

import { Loader2, MonitorOff, Play } from "lucide-react";
import { Button, Card, CardContent } from "@repo/ui";

interface ObsOfflineStateProps {
  status: "booting" | "offline";
  /** Start-the-container handler. Only passed when starting is the right action. */
  onStart?: () => void;
  /** A start is in flight — show a spinner and disable the button. */
  starting?: boolean;
}

/**
 * Fills the controls area when OBS isn't connected. Showing the Scenes/Sources
 * tabs while the container is off is meaningless, so we replace the whole strip
 * with a single state: a "warming up" note while booting, or an offline state
 * with a button to start the container right here.
 */
export function ObsOfflineState({ status, onStart, starting }: ObsOfflineStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        {status === "booting" ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Warming up</p>
              <p className="text-sm text-muted-foreground">
                Your scenes, sources, and stats show up here in a sec.
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MonitorOff className="h-6 w-6 text-muted-foreground" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">OBS is offline</p>
              <p className="text-sm text-muted-foreground">
                Start your container and your scenes, sources, and controls show up right here.
              </p>
            </div>
            {onStart && (
              <Button size="sm" disabled={starting} onClick={onStart}>
                {starting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                {starting ? "Starting…" : "Start it up"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
