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
  AlertDialogTrigger,
  Button,
} from "@repo/ui";
import { resyncEventSubAction, setAdminRoleAction, unlinkDiscordAction } from "@/actions/users";

/** A button that asks before running a server action. */
function ConfirmAction({
  trigger,
  title,
  description,
  confirm,
  destructive,
  run,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
  run: () => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onConfirm = (event: React.MouseEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await run();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          >
            {pending ? "Working…" : confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminRoleToggle({ userId, name, isAdmin, isSelf }: { userId: string; name: string; isAdmin: boolean; isSelf: boolean }) {
  if (isAdmin && isSelf) {
    return (
      <Button variant="outline" size="sm" disabled title="You can't remove your own admin role">
        Remove admin
      </Button>
    );
  }
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" size="sm">
          {isAdmin ? "Remove admin" : "Make admin"}
        </Button>
      }
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

export function UnlinkDiscordButton({ userId, name }: { userId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" size="sm">
          Unlink Discord
        </Button>
      }
      title={`Unlink Discord from ${name}?`}
      description="Removes the link and takes back the Verified Member role. They can link again from their integrations page."
      confirm="Unlink"
      destructive
      run={() => unlinkDiscordAction(userId)}
    />
  );
}

export function ResyncEventSubButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const resync = () => {
    startTransition(async () => {
      const result = await resyncEventSubAction(userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const summary = `Created ${result.created}, deleted ${result.deleted}.`;
      if (result.failed.length) {
        toast.warning(`${summary} ${result.failed.length} failed: ${result.failed.map((f) => `${f.type} (${f.message})`).join("; ")}`);
      } else {
        toast.success(result.created || result.deleted ? summary : "Nothing to fix.");
      }
      router.refresh();
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={resync} disabled={disabled || pending}>
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {pending ? "Resyncing…" : "Resync"}
    </Button>
  );
}
