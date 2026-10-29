"use client";

import { usePathname } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { ALERT_EVENT_LABELS, type AlertEventType } from "@repo/ui/overlay";
import type { TwitchScopeFeature } from "@repo/schemas";
import { TwitchConnectButton, TWITCH_SCOPE_COPY } from "@/components/ui/twitch-scope-banner";
import { useOverlayStore } from "@/stores/overlay-editor-store";

export interface AlertPermissionDialogProps {
  /** The alert being turned on, with the Twitch permission it is missing. */
  request: { event: AlertEventType; feature: TwitchScopeFeature } | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Says why an alert needs one more Twitch permission before sending anyone to
 * Twitch's consent screen. Twitch brings them back to this editor; the alert
 * stays off until they turn it on again, so nothing fires that they did not
 * ask for twice.
 */
export function AlertPermissionDialog({ request, onOpenChange }: AlertPermissionDialogProps) {
  const pathname = usePathname();
  const isDirty = useOverlayStore((s) => s.isDirty);
  const copy = request ? TWITCH_SCOPE_COPY[request.feature] : null;

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.body}</DialogDescription>
        </DialogHeader>
        {request ? (
          <p className="text-sm text-muted-foreground">
            Twitch shows its own screen, then sends you back here. Turn the{" "}
            {ALERT_EVENT_LABELS[request.event].toLowerCase()} alert on again once you are back.
          </p>
        ) : null}
        {isDirty ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            Save your overlay first. Going to Twitch leaves the editor.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          {request ? (
            <TwitchConnectButton
              feature={request.feature}
              next={pathname ?? "/dashboard"}
              disabled={isDirty}
              size="default"
              label="Continue to Twitch"
            />
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
