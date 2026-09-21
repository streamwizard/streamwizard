"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui";
import { createAnnouncementAction } from "@/actions/discord-announcement";

/** "New announcement": a blank draft, then straight into the editor. */
export function NewAnnouncementButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const result = await createAnnouncementAction();
      if (result.error || !result.id) return void toast.error(result.error ?? "Couldn't start an announcement. Try again?");
      router.push(`/discord/announcements/${result.id}`);
    });

  return (
    <Button onClick={create} disabled={pending}>
      <Plus />
      {pending ? "One moment…" : "New announcement"}
    </Button>
  );
}
