"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { unblockVoiceRenameAction } from "@/actions/discord-voice";
import { formatDateTime } from "@/lib/discord/tickets";
import { toastResult } from "./toast-result";

export interface VoiceRenameBlockView {
  discordUserId: string;
  username: string;
  blockedByUsername: string;
  reason: string | null;
  createdAt: string;
}

/** Members voice staff blocked from renaming with /voice-rename-block. Lifting one here is /voice-rename-unblock. */
export function VoiceRenameBlocks({ items }: { items: VoiceRenameBlockView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const lift = (item: VoiceRenameBlockView) =>
    start(async () => {
      if (toastResult(await unblockVoiceRenameAction(item.discordUserId), `${item.username} can rename again.`)) router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Blocked from renaming</CardTitle>
        <CardDescription>
          Voice staff block someone with /voice-rename-block when they pick a bad name. Their channels use the
          lobby&apos;s name until the block is lifted, here or with /voice-rename-unblock.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody&apos;s blocked. Good names all round.</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.discordUserId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-all text-sm font-medium">{item.username}</p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    Blocked by {item.blockedByUsername}, {formatDateTime(item.createdAt)}
                    {item.reason && ` · ${item.reason}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 shrink-0 md:h-8"
                  disabled={pending}
                  onClick={() => lift(item)}
                  aria-label={`Lift the rename block on ${item.username}`}
                >
                  Lift block
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
