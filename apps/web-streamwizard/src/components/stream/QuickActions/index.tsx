"use client";

import { useState } from "react";
import { CalendarPlus, Gift, Scissors, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { createTwitchClip } from "@/actions/twitch/clips";
import { QuickActionButton } from "./QuickActionButton";

interface QuickActionsProps {
  broadcasterId: string;
  streamId: string;
  hasVod: boolean;
  broadcasterUsername: string;
  streamTitle: string;
}

export function QuickActions({
  broadcasterId,
  hasVod,
  broadcasterUsername,
  streamTitle,
}: QuickActionsProps) {
  const [clipEditUrl, setClipEditUrl] = useState<string | null>(null);

  async function handleCreateClip() {
    const { editUrl } = await createTwitchClip(broadcasterId);
    setClipEditUrl(editUrl);
  }

  function handleShare() {
    const text = encodeURIComponent(`Watching ${streamTitle}`);
    const url = encodeURIComponent(`https://twitch.tv/${broadcasterUsername}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <QuickActionButton
            icon={Scissors}
            label="Create clip"
            onClick={handleCreateClip}
            disabled={!hasVod}
            disabledReason="No recent VOD for this stream"
            successMessage="Clip created!"
            errorMessage="Failed to create clip"
          />
          <QuickActionButton
            icon={Share2}
            label="Share"
            onClick={async () => handleShare()}
          />
          <QuickActionButton
            icon={CalendarPlus}
            label="Schedule"
            disabled
            disabledReason="Coming soon"
          />
          <QuickActionButton
            icon={Gift}
            label="Rewards"
            disabled
            disabledReason="Coming soon"
          />
        </div>

        {clipEditUrl && (
          <a
            href={clipEditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md bg-muted px-3 py-2 text-center text-xs font-medium text-primary hover:underline"
          >
            View clip →
          </a>
        )}
      </CardContent>
    </Card>
  );
}
