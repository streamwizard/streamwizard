"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@repo/ui";
import { discordInviteLink } from "@/lib/constant";

export function DiscordStep() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Join the Discord.</h2>
        <p className="text-sm text-muted-foreground">
          Bug reports, feature requests, and streamers complaining about their chat — all in one place.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">StreamWizard Discord</span>
        </div>
        <Button asChild size="sm">
          <a href={discordInviteLink} target="_blank" rel="noopener noreferrer">
            Join
          </a>
        </Button>
      </div>
    </div>
  );
}
