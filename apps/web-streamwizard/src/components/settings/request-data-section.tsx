"use client";

import { useRef, useState } from "react";
import { requestUserData } from "@/actions/auth/request-data";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui";

export function RequestDataSection() {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);

  const handleRequest = () => {
    setOpen(false);
    setIsPending(true);

    const download = async () => {
      const result = await requestUserData();
      if (result.error || !result.data) throw new Error(result.error ?? "Failed to retrieve your data. Please try again.");

      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = anchorRef.current;
      if (anchor) {
        anchor.href = url;
        anchor.download = `streamwizard-data-${new Date().toISOString().split("T")[0]}.json`;
        anchor.click();
      }
      URL.revokeObjectURL(url);
    };

    toast.promise(download(), {
      loading: "Digging through your data…",
      success: "There it is. All your dirty little secrets, in a neat little file.",
      error: (err: Error) => err.message,
      finally: () => setIsPending(false),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download my data</CardTitle>
        <CardDescription>
          Export a copy of all personal data StreamWizard holds about you — profile, preferences,
          overlays, clips, commands, and more — as a JSON file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <a ref={anchorRef} className="hidden" aria-hidden />

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button disabled={isPending}>{isPending ? "Preparing download…" : "Download my data"}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Download your data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will generate a JSON file containing all personal data StreamWizard holds about
                you. The file will download to your device automatically.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isPending}
                onClick={() => toast("Bold move. GDPR exists for a reason, just saying.")}
              >
                Nah, I trust you
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleRequest();
                }}
                disabled={isPending}
              >
                Drop the loot
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
