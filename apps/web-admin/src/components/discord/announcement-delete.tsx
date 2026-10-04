"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
  Button,
} from "@repo/ui";
import { deleteAnnouncementAction } from "@/actions/discord-announcement";

interface DeleteAnnouncementButtonProps {
  id: string;
  title: string;
  /** It is in Discord, so deleting takes it out of the channel too. */
  posted: boolean;
  disabled?: boolean;
  /** True when the delete starts, false when it failed. */
  onDeleting?: (running: boolean) => void;
  onDeleted: () => void;
}

export function DeleteAnnouncementButton({ id, title, posted, disabled, onDeleting, onDeleted }: DeleteAnnouncementButtonProps) {
  const [pending, start] = useTransition();

  const remove = () =>
    start(async () => {
      onDeleting?.(true);
      const result = await deleteAnnouncementAction(id);
      if (result.error) {
        onDeleting?.(false);
        return void toast.error(result.error);
      }
      toast.success(posted ? "Deleted here and in Discord." : "Deleted.");
      onDeleted();
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* A labelled, 44px button on a phone; the icon alone from 768px up. */}
        <Button
          variant="ghost"
          size="icon"
          className="max-md:h-11 max-md:w-auto max-md:px-3"
          aria-label={`Delete ${title}`}
          disabled={disabled || pending}
        >
          <Trash2 />
          <span className="md:hidden">Delete</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {posted
              ? "The bot removes it from the Discord channel too. You can't undo this."
              : "It was never posted, so nothing changes in Discord. You can't undo this."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
