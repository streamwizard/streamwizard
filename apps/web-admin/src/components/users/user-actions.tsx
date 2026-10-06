"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@repo/ui";
import { resyncEventSubAction, setAdminRoleAction, unlinkDiscordAction } from "@/actions/users";

interface Controlled {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Asks before running a server action. Whoever owns `open` decides what opens it. */
function ConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  destructive,
  run,
}: Controlled & {
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
  run: () => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onConfirm = (event: React.MouseEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await run();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* The variant, not a bg class: a class lands next to the default bg-primary instead of replacing it. */}
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={pending}>
            {pending ? "Working…" : confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Make admin or Remove admin, whichever applies. Opened from the Actions menu. */
export function AdminRoleDialog({ userId, name, isAdmin, open, onOpenChange }: Controlled & { userId: string; name: string; isAdmin: boolean }) {
  return (
    <ConfirmAction
      open={open}
      onOpenChange={onOpenChange}
      title={isAdmin ? `Remove admin from ${name}?` : `Make ${name} an admin?`}
      description={
        isAdmin
          ? "They lose access to this dashboard on their next page load."
          : "They get full access to this dashboard, including every user, plan and the Discord server settings. They still need a passkey or authenticator app to get in."
      }
      confirm={isAdmin ? "Remove admin" : "Make admin"}
      destructive={isAdmin}
      run={() => setAdminRoleAction(userId, !isAdmin)}
    />
  );
}

export function UnlinkDiscordDialog({ userId, name, open, onOpenChange }: Controlled & { userId: string; name: string }) {
  return (
    <ConfirmAction
      open={open}
      onOpenChange={onOpenChange}
      title={`Unlink Discord from ${name}?`}
      description="Removes the link and takes back the Verified Member role. They can link again from their integrations page."
      confirm="Unlink"
      destructive
      run={() => unlinkDiscordAction(userId)}
    />
  );
}

/** The button on the Discord tab. The Actions menu opens the same dialog. */
export function UnlinkDiscordButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => setOpen(true)}>
        Unlink Discord
      </Button>
      <UnlinkDiscordDialog userId={userId} name={name} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** One resync, shared by the EventSub tab button and the Actions menu. */
export function useResyncEventSub(userId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const resync = () => {
    startTransition(async () => {
      // From the menu there's no button left on screen to spin, so the toast carries the progress.
      const id = toast.loading("Resyncing EventSub…");
      let result: Awaited<ReturnType<typeof resyncEventSubAction>>;
      try {
        result = await resyncEventSubAction(userId);
      } catch {
        // Without this the loading toast would spin forever when the request itself fails.
        toast.error("Couldn't run the resync. Reload and try again.", { id });
        return;
      }
      if (result.error) {
        toast.error(result.error, { id });
        return;
      }
      const summary = `Created ${result.created}, deleted ${result.deleted}.`;
      if (result.failed.length) {
        toast.warning(`${summary} ${result.failed.length} failed: ${result.failed.map((f) => `${f.type} (${f.message})`).join("; ")}`, { id });
      } else {
        toast.success(result.created || result.deleted ? summary : "Nothing to fix.", { id });
      }
      router.refresh();
    });
  };

  return { pending, resync };
}

export function ResyncEventSubButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const { pending, resync } = useResyncEventSub(userId);

  return (
    <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={resync} disabled={disabled || pending}>
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {pending ? "Resyncing…" : "Resync"}
    </Button>
  );
}
