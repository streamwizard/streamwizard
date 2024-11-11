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
    toast.promise(SyncBroadcasterClips(), {
      loading: "Syncing Twitch Clips",
      success(data) {
        return data;
      },
      error(error) {
        return error?.message;
      },
      finally() {
        setIsLoading(false);
      },
    });
  };

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleSyncTwitchClips} disabled={isLoading}>
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
