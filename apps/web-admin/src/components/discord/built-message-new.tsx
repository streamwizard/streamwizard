"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { MESSAGE_TEMPLATES } from "@repo/discord-message";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  cn,
} from "@repo/ui";
import { createBuiltMessageAction } from "@/actions/discord-built-message";
import { MESSAGE_NAME_MAX } from "@/lib/discord/built-messages";

/** "New message": a name and a starting point, then straight into the editor. */
export function NewBuiltMessageButton() {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(MESSAGE_TEMPLATES[0]!.id);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const template = MESSAGE_TEMPLATES.find((t) => t.id === templateId) ?? MESSAGE_TEMPLATES[0]!;

  const create = () =>
    start(async () => {
      const result = await createBuiltMessageAction({ name: name.trim() || template.name, templateId });
      if (result.error || !result.id) return setError(result.error ?? "Couldn't create the message. Try again?");
      router.push(`/discord/messages/${result.id}`);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName("");
          setError(null);
          setTemplateId(MESSAGE_TEMPLATES[0]!.id);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>Pick a starting point. You choose the channel next, and nothing is sent until you publish.</DialogDescription>
          </DialogHeader>

          <div role="radiogroup" aria-label="Start from" className="grid gap-2 sm:grid-cols-2">
            {MESSAGE_TEMPLATES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={option.id === templateId}
                onClick={() => setTemplateId(option.id)}
                className={cn(
                  "rounded-md border p-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  option.id === templateId ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={MESSAGE_NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={template.name}
              aria-describedby={`${id}-hint`}
            />
            <p id={`${id}-hint`} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
              {error ?? "Only shown in this dashboard."}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create message"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
