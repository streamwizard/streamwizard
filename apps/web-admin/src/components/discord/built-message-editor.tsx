"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateMessage, type BuiltMessage } from "@repo/discord-message";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@repo/ui";
import { MessageBuilder, type BuilderTheme } from "@repo/ui/message-builder";
import { publishBuiltMessageAction, saveBuiltMessageDraftAction } from "@/actions/discord-built-message";
import { PageHeader } from "@/components/widgets/page-header";
import { useAutosave, type AutosaveStatus } from "@/hooks/use-autosave";
import {
  MESSAGE_BUILDER_PRESETS,
  MESSAGE_NAME_MAX,
  MESSAGE_VALIDATE_OPTIONS,
  MESSAGE_VARIABLES,
  builtMessageStatus,
  channelNameFor,
} from "@/lib/discord/built-messages";
import type { PickerOption } from "@/lib/discord/options";
import { DeleteBuiltMessageButton } from "./built-message-delete";
import { Picker } from "./pickers";

const CREATE = "__create__";

interface BuiltMessageEditorProps {
  id: string;
  initial: { name: string; message: BuiltMessage; channelId: string | null; createChannel: boolean };
  /** What is in Discord right now, to tell "live" from "unpublished changes". */
  published: { message: BuiltMessage | null; channelId: string | null };
  channels: PickerOption[];
  themes: BuilderTheme[];
  bot: { name: string; avatarUrl: string | null };
  uploadsEnabled: boolean;
}

function SaveStatus({ status }: { status: AutosaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      {status === "saving" && <Loader2 className="size-3.5 animate-spin" />}
      {status === "saved" && <Check className="size-3.5" />}
      {status === "error" && <AlertTriangle className="size-3.5 text-destructive" />}
      {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Couldn't save"}
    </span>
  );
}

async function uploadBanner(file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  const res = await fetch("/api/discord/banner-upload", { method: "POST", body });
  const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !payload.url) throw new Error(payload.error ?? "Couldn't upload that image. Try again?");
  return payload.url;
}

/** One message: header with Publish and save status, name and channel, the builder. */
export function BuiltMessageEditor({ id, initial, published, channels, themes, bot, uploadsEnabled }: BuiltMessageEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [publishing, startPublish] = useTransition();

  const name = draft.name.trim();
  // Set while a delete runs, so a late autosave doesn't complain the message is gone.
  const deleting = useRef(false);
  const { status, flush } = useAutosave(draft, async (value) => {
    // A cleared name box isn't saved; the last good name stays until a new one is typed.
    if (!value.name.trim() || deleting.current) return true;
    const result = await saveBuiltMessageDraftAction(id, value);
    if (result.error) toast.error(result.error);
    return !result.error;
  });

  const newChannel = `#${channelNameFor(name)}`;
  const nameTaken = channels.some((c) => c.label === newChannel);
  const channelOptions = useMemo<PickerOption[]>(
    () => [{ value: CREATE, label: `Create a ${newChannel} channel for me`, group: "New" }, ...channels],
    [channels, newChannel],
  );
  const shownChannelError =
    channelError ?? (draft.createChannel && nameTaken ? `${newChannel} already exists. Pick it from the list instead.` : null);

  const issues = useMemo(() => validateMessage(draft.message, MESSAGE_VALIDATE_OPTIONS), [draft.message]);
  const hasChannel = draft.createChannel ? !nameTaken : Boolean(draft.channelId);
  const blocked = !name
    ? "Give the message a name first"
    : issues.length > 0
      ? "Fix the marked problems first"
      : !hasChannel
        ? "Pick a channel first"
        : null;

  const live =
    builtMessageStatus({
      draft: draft.message,
      published: published.message,
      draftChannelId: draft.channelId,
      createChannel: draft.createChannel,
      channelId: published.channelId,
    }) === "live";

  const publish = () =>
    startPublish(async () => {
      if (!(await flush())) return;
      const result = await publishBuiltMessageAction(id);
      if (result.channelError) return setChannelError(result.channelError);
      if (result.error) return void toast.error(result.error);
      // The bot may have created the channel: show it as the picked one.
      if (result.channelId) setDraft((prev) => ({ ...prev, channelId: result.channelId ?? null, createChannel: false }));
      toast.success(published.message ? "Updated in Discord." : "Published. Go check Discord.");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Link
        href="/discord/messages"
        // Save first, so the list shows the name that was just typed.
        onClick={(e) => {
          if (status !== "saving" || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          void flush().then(() => router.push("/discord/messages"));
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All messages
      </Link>
      <PageHeader title={name || "Untitled message"} description="Build it here, publish it when it looks right.">
        <SaveStatus status={status} />
        {published.message && <Badge variant={live ? "secondary" : "outline"}>{live ? "Live" : "Unpublished changes"}</Badge>}
        <Button onClick={publish} disabled={publishing || blocked !== null} title={blocked ?? undefined}>
          {publishing ? "Publishing…" : "Publish"}
        </Button>
        <DeleteBuiltMessageButton
          id={id}
          name={name || "this message"}
          published={published.message !== null}
          disabled={publishing}
          onDeleting={(running) => {
            deleting.current = running;
          }}
          onDeleted={() => router.push("/discord/messages")}
        />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name and channel</CardTitle>
          <CardDescription>The name is only for this dashboard. The channel is where the message goes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="built-message-name">Name</Label>
            <Input
              id="built-message-name"
              value={draft.name}
              maxLength={MESSAGE_NAME_MAX}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Rules"
              aria-invalid={!name || undefined}
              disabled={publishing}
            />
            {!name && (
              <p className="text-sm text-destructive" role="alert">
                Give the message a name.
              </p>
            )}
          </div>
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="built-message-channel">Channel</Label>
            <Picker
              id="built-message-channel"
              options={channelOptions}
              value={draft.createChannel ? CREATE : draft.channelId}
              onChange={(value) => {
                setChannelError(null);
                setDraft((prev) => ({ ...prev, createChannel: value === CREATE, channelId: value === CREATE ? null : value }));
              }}
              placeholder="Pick a channel"
              emptyText="No channels match"
              disabled={publishing}
            />
          </div>
          {shownChannelError ? (
            <p className="text-sm text-destructive" role="alert">
              {shownChannelError}
            </p>
          ) : (
            draft.createChannel && (
              <p className="text-xs text-muted-foreground">The bot creates {newChannel} when you publish, read-only for members.</p>
            )
          )}
          {published.channelId && !draft.createChannel && draft.channelId && draft.channelId !== published.channelId && (
            <p className="text-xs text-muted-foreground">Publishing moves the message: it is removed from the old channel.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customize</CardTitle>
          <CardDescription>Changes save as a draft. Nothing reaches Discord until you publish.</CardDescription>
        </CardHeader>
        <CardContent>
          <MessageBuilder
            value={draft.message}
            onChange={(message) => setDraft((prev) => ({ ...prev, message }))}
            presets={MESSAGE_BUILDER_PRESETS}
            variables={MESSAGE_VARIABLES}
            themes={themes}
            bot={bot}
            onUploadImage={uploadsEnabled ? uploadBanner : undefined}
            disabled={publishing}
          />
        </CardContent>
      </Card>
    </div>
  );
}
