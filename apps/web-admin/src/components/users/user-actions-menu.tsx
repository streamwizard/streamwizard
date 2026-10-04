"use client";

import { useState } from "react";
import { Ban, ChevronDown, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2, Undo2, Unlink } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import type { UserRow } from "@/components/subscriptions/types";
import { cn } from "@/lib/utils";
import { useGrantAccess } from "./grant-access";
import { BanUserDialog, DeleteUserDialog, UnbanDialog } from "./moderation";
import { AdminRoleDialog, UnlinkDiscordDialog, useResyncEventSub } from "./user-actions";

type DialogName = "ban" | "unban" | "role" | "unlink" | "delete";

// Menu rows tall enough to hit with a thumb.
const ITEM = "min-h-11 md:min-h-8";

/**
 * Everything an admin can do to a user, in the header of every tab. Each item
 * opens the confirm it always had: the menu only replaces the buttons that
 * were spread over the Account card, the danger zone and the tabs.
 */
export function UserActionsMenu({
  user,
  isSelf,
  isAdmin,
  banned,
  discordBanned,
  hasDiscord,
  hasTwitch,
  className,
}: {
  user: UserRow;
  isSelf: boolean;
  isAdmin: boolean;
  banned: boolean;
  /** The ban took their Discord account out of the server too. */
  discordBanned: boolean;
  hasDiscord: boolean;
  hasTwitch: boolean;
  className?: string;
}) {
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const grant = useGrantAccess();
  const { pending: resyncing, resync } = useResyncEventSub(user.id);
  // Same rule as the server actions: never yourself, never another admin.
  const canModerate = !isSelf && !isAdmin;
  const control = (name: DialogName) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-11 md:h-8", className)}>
            Actions
            <ChevronDown className="size-3.5 opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem className={ITEM} onSelect={() => grant(user)}>
            <Plus aria-hidden />
            Grant access
          </DropdownMenuItem>
          {banned ? (
            <DropdownMenuItem className={ITEM} onSelect={() => setDialog("unban")}>
              <Undo2 aria-hidden />
              Lift ban
            </DropdownMenuItem>
          ) : (
            canModerate && (
              <DropdownMenuItem className={ITEM} onSelect={() => setDialog("ban")}>
                <Ban aria-hidden />
                Ban
              </DropdownMenuItem>
            )
          )}
          {isAdmin && isSelf ? (
            // Shown but off, with the reason in view: a hover hint doesn't exist on a phone.
            <DropdownMenuItem className={cn(ITEM, "items-start")} disabled>
              <ShieldOff className="mt-0.5" aria-hidden />
              <span>
                Remove admin
                <span className="block text-xs">You can&apos;t remove your own admin role.</span>
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className={ITEM} onSelect={() => setDialog("role")}>
              {isAdmin ? <ShieldOff aria-hidden /> : <ShieldCheck aria-hidden />}
              {isAdmin ? "Remove admin" : "Make admin"}
            </DropdownMenuItem>
          )}
          {hasDiscord && (
            <DropdownMenuItem className={ITEM} onSelect={() => setDialog("unlink")}>
              <Unlink aria-hidden />
              Unlink Discord
            </DropdownMenuItem>
          )}
          {hasTwitch && (
            <DropdownMenuItem className={ITEM} disabled={resyncing} onSelect={resync}>
              <RefreshCw aria-hidden />
              Resync EventSub
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {canModerate ? (
            <DropdownMenuItem className={ITEM} variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2 aria-hidden />
              Delete account
            </DropdownMenuItem>
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {isSelf
                ? "You can't ban or delete your own account from here."
                : "Remove their admin role first. Admins can't be banned or deleted."}
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canModerate && !banned && (
        <BanUserDialog userId={user.id} name={user.name} hasDiscord={hasDiscord} hasTwitch={hasTwitch} {...control("ban")} />
      )}
      {banned && <UnbanDialog userId={user.id} name={user.name} discordBanned={discordBanned} {...control("unban")} />}
      {!(isAdmin && isSelf) && <AdminRoleDialog userId={user.id} name={user.name} isAdmin={isAdmin} {...control("role")} />}
      {hasDiscord && <UnlinkDiscordDialog userId={user.id} name={user.name} {...control("unlink")} />}
      {canModerate && <DeleteUserDialog userId={user.id} name={user.name} hasDiscord={hasDiscord} {...control("delete")} />}
    </>
  );
}
