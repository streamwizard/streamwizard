"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
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
  Checkbox,
  Input,
  Label,
  Textarea,
} from "@repo/ui";
import {
  banUserAction,
  deleteUserAction,
  removeUserPasskeyAction,
  removeUserTotpAction,
  unbanUserAction,
  type ModerationResult,
} from "@/actions/users";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";

// Ban, lift ban and delete are opened from the Actions menu in the user header,
// so they take `open` from outside and draw no trigger of their own.
interface Controlled {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Primary button on top in the phone drawer, like the desktop footer puts it last.
const FOOTER = "max-md:flex-col-reverse";

/** Toasts the outcome; side-step failures show as one warning so nothing is silently skipped. */
function report(result: ModerationResult, done: string): boolean {
  if (result.error) {
    toast.error(result.error, { description: result.warnings.join(" ") || undefined });
    return false;
  }
  if (result.warnings.length) toast.warning(done, { description: result.warnings.join(" ") });
  else toast.success(done);
  return true;
}

function CheckRow({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1 md:py-0">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
      <Label htmlFor={id} className="block flex-1 font-normal leading-snug">
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </Label>
    </div>
  );
}

export function BanUserDialog({
  userId,
  name,
  hasDiscord,
  hasTwitch,
  open,
  onOpenChange,
}: Controlled & {
  userId: string;
  name: string;
  hasDiscord: boolean;
  hasTwitch: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [banDiscord, setBanDiscord] = useState(true);
  const [stopEventSub, setStopEventSub] = useState(true);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await banUserAction(userId, { reason, banDiscord: hasDiscord && banDiscord, stopEventSub: hasTwitch && stopEventSub });
      if (!report(result, `${name} is banned.`)) return;
      onOpenChange(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[460px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Ban {name}?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            They&apos;re signed out everywhere and can&apos;t sign in again until you lift it. Their data stays, so
            unbanning puts everything back.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ban-reason">Reason</Label>
            <Textarea
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What happened. Goes in the log and the Discord audit log, never to them."
            />
          </div>
          {hasDiscord && (
            <CheckRow
              id="ban-discord"
              checked={banDiscord}
              onChange={setBanDiscord}
              label="Ban their Discord account from the server too"
              hint="Kicks them out if they're in it and stops them rejoining."
            />
          )}
          {hasTwitch && (
            <CheckRow
              id="ban-eventsub"
              checked={stopEventSub}
              onChange={setStopEventSub}
              label="Delete their EventSub subscriptions"
              hint="Chat, alerts and overlays stop getting events. Resync brings them back after an unban."
            />
          )}
        </div>
        <ResponsiveDialogFooter className={FOOTER}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending || !reason.trim()}>
            {pending ? "Banning…" : "Ban user"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function UnbanDialog({
  userId,
  name,
  discordBanned,
  open,
  onOpenChange,
}: Controlled & { userId: string; name: string; discordBanned: boolean }) {
  const router = useRouter();
  const [unbanDiscord, setUnbanDiscord] = useState(true);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.MouseEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await unbanUserAction(userId, { unbanDiscord: discordBanned && unbanDiscord });
      if (!report(result, `${name} can sign in again.`)) return;
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lift the ban on {name}?</AlertDialogTitle>
          <AlertDialogDescription>They can sign in again right away.</AlertDialogDescription>
        </AlertDialogHeader>
        {discordBanned && (
          <CheckRow
            id="unban-discord"
            checked={unbanDiscord}
            onChange={setUnbanDiscord}
            label="Lift their Discord server ban too"
            hint="They can rejoin with an invite. The bot doesn't re-add them."
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={pending}>
            {pending ? "Working…" : "Lift ban"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The Lift ban button on the ban banner. The Actions menu opens the same dialog. */
export function UnbanButton({ userId, name, discordBanned }: { userId: string; name: string; discordBanned: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => setOpen(true)}>
        Lift ban
      </Button>
      <UnbanDialog userId={userId} name={name} discordBanned={discordBanned} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function DeleteUserDialog({
  userId,
  name,
  hasDiscord,
  open,
  onOpenChange,
}: Controlled & { userId: string; name: string; hasDiscord: boolean }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [banDiscord, setBanDiscord] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await deleteUserAction(userId, { confirmation, banDiscord: hasDiscord && banDiscord });
      if (!report(result, `${name}'s account is deleted.`)) return;
      onOpenChange(false);
      router.push("/users");
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setConfirmation("");
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-[460px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Delete {name}&apos;s account?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            This can&apos;t be undone. Their overlays, clips, VODs, plans and settings go, their Twitch access is revoked,
            and their EventSub subscriptions are deleted. Ticket messages stay as &quot;Deleted user&quot;. Nothing stops
            them signing up again: ban instead if that matters.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-4 py-1">
          {hasDiscord && (
            <CheckRow
              id="delete-ban-discord"
              checked={banDiscord}
              onChange={setBanDiscord}
              label="Also ban their Discord account from the server"
              hint="Otherwise they just lose the Verified Member role."
            />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">{name}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 md:h-9"
            />
          </div>
        </div>
        <ResponsiveDialogFooter className={FOOTER}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending || confirmation.trim() !== name}>
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** Removes one TOTP factor or passkey after a confirm. */
export function RemoveFactorButton({
  userId,
  kind,
  id,
  label,
}: {
  userId: string;
  kind: "totp" | "passkey";
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = (event: React.MouseEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = kind === "totp" ? await removeUserTotpAction(userId, id) : await removeUserPasskeyAction(userId, id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} removed.`);
      router.refresh();
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 md:size-7" aria-label={`Remove ${label}`}>
          <X className="size-4 md:size-3.5" aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            They can&apos;t use it to sign in to this dashboard any more. With no second factor left, their next sign-in
            asks them to set one up again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove} disabled={pending}>
            {pending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
