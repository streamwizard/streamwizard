"use client";

import { useState } from "react";
import { TwitchVideo } from "@/types/twitch";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

interface DeleteConfirmDialogProps {
    videos: TwitchVideo[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
}

/**
 * Confirmation dialog before deleting videos
 */
export function DeleteConfirmDialog({
    videos,
    open,
    onOpenChange,
    onConfirm,
}: DeleteConfirmDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onConfirm();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {videos.length} video{videos.length !== 1 ? "s" : ""}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. The following video{videos.length !== 1 ? "s" : ""} will be permanently deleted:
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* List of videos to delete */}
                <ul className="max-h-[200px] overflow-y-auto space-y-1 text-sm">
                    {videos.map((video) => (
                        <li key={video.id} className="truncate text-muted-foreground">
                            • {video.title}
                        </li>
                    ))}
                </ul>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleConfirm();
                        }}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? (
                            <>
                                <Spinner className="mr-2 h-4 w-4" />
                                Deleting...
                            </>
                        ) : (
                            "Delete"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
