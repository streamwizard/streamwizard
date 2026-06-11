"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@repo/ui";
import { discordInviteLink } from "@/lib/constant";

export function DiscordStep() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">You're all set.</h2>
        <p className="text-sm text-muted-foreground">
          Clips sorted. Sync configured. Chaos contained.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">One more thing</p>
        <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
                <MessageSquare className="h-4 w-4 text-purple-400" />
              </span>
              <div>
                <p className="text-sm font-medium">StreamWizard Discord</p>
                <p className="text-xs text-muted-foreground">Bug reports, feature requests, streamers complaining about chat.</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 ml-3">
              <a href={discordInviteLink} target="_blank" rel="noopener noreferrer">
                Join
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
