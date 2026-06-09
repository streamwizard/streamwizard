"use client";
import { SyncBroadcasterClips } from "@/actions/twitch/clips";
import { RefreshCcw } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Button, LoadingSpinner } from "@repo/ui";

export default function SyncTwitchClipsButton() {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  const handleSyncTwitchClips = () => {
    setIsLoading(true);

    toast.promise(
      SyncBroadcasterClips().then((response) => {
        if (!response.success) {
          const readyAt = response.lastSync
            ? new Date(new Date(response.lastSync).getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;
          const msg = response.skipped && readyAt
            ? `${response.message} You can sync again at ${readyAt}.`
            : response.message;
          throw new Error(msg);
        }
        return response.message;
      }),
      {
        loading: "Syncing Twitch Clips",
        success: (message) => message,
        error: (error) => error.message || "Error syncing Twitch Clips",
        finally: () => setIsLoading(false),
      }
    );
  };

  return (
    <Button type="button" variant="outline" className="flex-1" onClick={handleSyncTwitchClips} disabled={isLoading}>
      {isLoading ? (
        <span>
          <LoadingSpinner />
          <span className="sr-only">Syncing Twitch Clips</span>
        </span>
      ) : (
        <span className="mr-2 h-4 w-4 flex justify-center items-center">
          <RefreshCcw />
        </span>
      )}
      Sync
    </Button>
  );
}
