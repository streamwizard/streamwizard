"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui";
import { removeInstanceAdminAction } from "@/actions/nodes";

interface RemovableInstance {
  id: string;
  container_name: string;
}

/** Confirm and run "remove instance". Used by the node page and the instance
 *  page, so both ask the same question and call the same action. */
export function RemoveInstanceDialog({
  nodeId,
  instance,
  onClose,
  onRemoved,
}: {
  nodeId: string;
  /** The instance being removed; null keeps the dialog closed. */
  instance: RemovableInstance | null;
  onClose: () => void;
  onRemoved: (instanceId: string) => void;
}) {
  const [pending, setPending] = useState(false);
  // Keep the last instance around so the text does not blank out while the dialog closes.
  const [shown, setShown] = useState(instance);
  if (instance && instance !== shown) setShown(instance);

  const handleRemove = async () => {
    if (!instance) return;
    setPending(true);
    try {
      const { error } = await removeInstanceAdminAction(nodeId, instance.id);
      if (error) throw new Error(error);
      toast.success("Instance removed.");
      onRemoved(instance.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the instance.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog
      open={!!instance}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this instance?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono break-all">{shown?.container_name}</span>{" "}
            will be stopped and its container deleted. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              // Stay open until the node answers, so a failure is not lost behind a closed dialog.
              e.preventDefault();
              void handleRemove();
            }}
          >
            {pending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
