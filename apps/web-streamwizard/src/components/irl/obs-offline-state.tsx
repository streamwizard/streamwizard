"use client";

import Image from "next/image";
import { Loader2, MonitorOff } from "lucide-react";
import { Card, CardContent } from "@repo/ui";

// The only real meme asset we ship today. Swap for a rotating set once the
// meme library exists — keep it as a single constant so that's a one-liner.
const OFFLINE_MEME_SRC = "/goodbye.gif";

interface ObsOfflineStateProps {
  status: "booting" | "offline";
  memesEnabled: boolean;
}

/**
 * Fills the controls area when OBS isn't connected. Showing the Scenes/Sources
 * tabs while the container is off is meaningless, so we replace the whole strip
 * with a single state: a "warming up" note while booting, or an offline empty
 * state (a meme for the people who opted in, a plain message for everyone else).
 */
export function ObsOfflineState({ status, memesEnabled }: ObsOfflineStateProps) {
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
        ) : memesEnabled ? (
          <>
            <Image
              src={OFFLINE_MEME_SRC}
              alt="OBS is offline"
              width={480}
              height={270}
              unoptimized
              className="w-full max-w-[280px] rounded-lg"
              style={{ height: "auto" }}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">OBS has left the building.</p>
              <p className="text-sm text-muted-foreground">
                Start your container and your scenes, sources, and controls show up right here.
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
