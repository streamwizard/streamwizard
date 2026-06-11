"use client";
import { SyncBroadcasterClips } from "@/actions/twitch/clips";
import { RefreshCcw } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Button } from "@repo/ui";

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
    <Button
      type="button"
      className="gap-2 border border-[#374151] !bg-[#374151] !text-white shadow-sm hover:!bg-[#eef0f4] hover:!text-foreground dark:border-transparent dark:!bg-primary dark:!text-primary-foreground dark:shadow-none dark:hover:!bg-primary/90 dark:hover:!text-primary-foreground"
      onClick={handleSyncTwitchClips}
      disabled={isLoading}
    >
      <RefreshCcw className={`h-4 w-4 shrink-0 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "Syncing with Twitch…" : "Sync with Twitch"}
    </Button>
  );
}
