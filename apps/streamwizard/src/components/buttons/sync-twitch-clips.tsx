"use client";
import { SyncBroadcasterClips } from "@/actions/twitch/clips";
import { RefreshCcw } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import LoadingSpinner from "../global/loading";
import { Button } from "../ui/button";

export default function SyncTwitchClipsButton() {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  const handleSyncTwitchClips = () => {
    setIsLoading(true);

    toast.promise(
      SyncBroadcasterClips().then((response) => {
        if (!response.success) {
          throw new Error(response.message);
        }
        return response.message;
      }),
      {
        loading: "Syncing Twitch Clips",
        success: (message) => message,
        error: (error) => {
          if (error.message) return error.message;
          return `Error syncing Twitch Clips`;
        },
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
