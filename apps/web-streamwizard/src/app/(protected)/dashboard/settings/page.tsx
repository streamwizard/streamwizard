"use client";

import { useTransition } from "react";
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
  Spinner,
} from "@repo/ui";
import { deleteAccount } from "@/actions/auth/delete-account";
import { toast } from "sonner";

export default function SettingsPage() {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAccount();
      if (result?.error) toast.error(result.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-destructive p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    This will permanently delete your account and all data including clips,
                    overlays, stream history, and integrations. This action cannot be undone.
                  </p>
                  <p>
                    Your data will be removed from our systems immediately. Please note that
                    encrypted database backups may retain your data for up to{" "}
                    <strong className="text-foreground">3 months</strong> in accordance with
                    applicable law, after which it is permanently purged on a rolling schedule.
                  </p>
                  <p>
                    We will revoke our access to your Twitch account automatically. To also
                    remove StreamWizard from your Twitch authorized apps, visit{" "}
                    <a
                      href="https://www.twitch.tv/settings/connections"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-foreground"
                    >
                      Twitch Settings → Connections
                    </a>{" "}
                    after deletion.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Deleting...
                  </>
                ) : (
                  "Yes, delete everything"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
