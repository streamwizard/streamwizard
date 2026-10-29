"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  Label,
} from "@repo/ui";
import {
  createVoiceHubAction,
  removeVoiceHubAction,
  updateVoiceHubAction,
  type VoiceHubFormInput,
} from "@/actions/discord-voice";
import type { PickerOption } from "@/lib/discord/options";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { Picker } from "./pickers";
import { TicketRowMenu } from "./ticket-row-menu";
import { toastResult } from "./toast-result";

export interface VoiceHubView extends VoiceHubFormInput {
  id: string;
  /** Temp channels made from this lobby that exist right now. */
  openChannels: number;
}

interface VoiceHubsManagerProps {
  items: VoiceHubView[];
  voiceChannels: PickerOption[];
  categories: PickerOption[];
  /** id → "#name" or category name, for the rows. */
  names: Record<string, string>;
  limit: number;
  templateMax: number;
  userLimitMax: number;
  defaultTemplate: string;
  placeholders: readonly { key: string; label: string }[];
}

/** What a template turns into for an example member, so the dialog shows the result. */
function previewName(template: string): string {
  const name = template
    .replace(/\{\s*username\s*\}/gi, "pogfrog")
    .replace(/\{\s*displayname\s*\}/gi, "Pog Frog")
    .replace(/\s+/g, " ")
    .trim();
  return name || "Voice channel";
}

/** Join-to-create lobbies: join one and the bot makes you a voice channel of your own. */
export function VoiceHubsManager({
  items,
  voiceChannels,
  categories,
  names,
  limit,
  templateMax,
  userLimitMax,
  defaultTemplate,
  placeholders,
}: VoiceHubsManagerProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<VoiceHubView | "new" | null>(null);
  const [removing, setRemoving] = useState<VoiceHubView | null>(null);
  const label = (id: string | null, fallback: string) => (id ? (names[id] ?? `Unknown (${id})`) : fallback);
  const full = items.length >= limit;

  const remove = (item: VoiceHubView) =>
    start(async () => {
      if (toastResult(await removeVoiceHubAction(item.id), "Lobby removed.")) router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Lobbies</CardTitle>
          <CardDescription>
            Join a lobby and the bot makes you a voice channel of your own and moves you in. You run it with the /voice
            commands, and it&apos;s deleted when the last person leaves.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="h-11 shrink-0 self-start md:h-8"
          onClick={() => setEditing("new")}
          disabled={pending || full}
        >
          <Plus />
          Add lobby
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No lobbies yet. Make a voice channel called something like &ldquo;Join to create&rdquo; in Discord, then add it
            here.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="break-all">{label(item.lobbyChannelId, "")}</span>
                    {item.openChannels > 0 && <Badge variant="secondary">{item.openChannels} open now</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    Makes &ldquo;{previewName(item.nameTemplate)}&rdquo; in {label(item.categoryId, "the lobby's category")}
                    {" · "}
                    {item.defaultUserLimit === 0 ? "no user limit" : `${item.defaultUserLimit} people max`}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-1 md:flex">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${label(item.lobbyChannelId, "lobby")}`} title="Edit" disabled={pending} onClick={() => setEditing(item)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${label(item.lobbyChannelId, "lobby")}`} title="Remove" disabled={pending} onClick={() => setRemoving(item)}>
                    <Trash2 />
                  </Button>
                </div>
                <TicketRowMenu label={label(item.lobbyChannelId, "lobby")} disabled={pending} className="md:hidden">
                  <DropdownMenuItem onSelect={() => setEditing(item)}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(item)}>
                    <Trash2 />
                    Remove
                  </DropdownMenuItem>
                </TicketRowMenu>
              </li>
            ))}
          </ul>
        )}
        {full && <p className="mt-3 text-xs text-muted-foreground">That&apos;s {limit} lobbies, the most a server can have.</p>}
      </CardContent>

      {removing && (
        <AlertDialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {label(removing.lobbyChannelId, "this lobby")}?</AlertDialogTitle>
              <AlertDialogDescription>
                Joining it stops making channels. The channel itself stays in Discord, and channels already made keep
                working until they empty.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-11 md:h-9">Keep it</AlertDialogCancel>
              <AlertDialogAction
                className="h-11 md:h-9"
                onClick={() => {
                  remove(removing);
                  setRemoving(null);
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <HubDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        editing={editing}
        pending={pending}
        voiceChannels={voiceChannels}
        categories={categories}
        templateMax={templateMax}
        userLimitMax={userLimitMax}
        defaultTemplate={defaultTemplate}
        placeholders={placeholders}
        onClose={() => setEditing(null)}
        onSubmit={(draft) =>
          start(async () => {
            const result =
              editing === "new" ? await createVoiceHubAction(draft) : editing ? await updateVoiceHubAction(editing.id, draft) : null;
            if (!result) return;
            if (toastResult(result, editing === "new" ? "Lobby added. Join it to try." : "Saved.")) {
              setEditing(null);
              router.refresh();
            }
          })
        }
      />
    </Card>
  );
}

function HubDialog({
  editing,
  pending,
  voiceChannels,
  categories,
  templateMax,
  userLimitMax,
  defaultTemplate,
  placeholders,
  onClose,
  onSubmit,
}: {
  editing: VoiceHubView | "new" | null;
  pending: boolean;
  voiceChannels: PickerOption[];
  categories: PickerOption[];
  templateMax: number;
  userLimitMax: number;
  defaultTemplate: string;
  placeholders: readonly { key: string; label: string }[];
  onClose: () => void;
  onSubmit: (draft: VoiceHubFormInput) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<VoiceHubFormInput>(() =>
    editing && editing !== "new"
      ? {
          lobbyChannelId: editing.lobbyChannelId,
          categoryId: editing.categoryId,
          nameTemplate: editing.nameTemplate,
          defaultUserLimit: editing.defaultUserLimit,
        }
      : { lobbyChannelId: "", categoryId: null, nameTemplate: defaultTemplate, defaultUserLimit: 0 },
  );
  const set = <K extends keyof VoiceHubFormInput>(key: K, value: VoiceHubFormInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const limitValid = Number.isInteger(draft.defaultUserLimit) && draft.defaultUserLimit >= 0 && draft.defaultUserLimit <= userLimitMax;
  const valid = draft.lobbyChannelId && draft.nameTemplate.trim() && limitValid;

  return (
    <ResponsiveDialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ ...draft, nameTemplate: draft.nameTemplate.trim() });
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editing === "new" || !editing ? "Add a lobby" : "Edit lobby"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Pick the voice channel people join to get their own.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`${id}-lobby`}>Lobby</Label>
            <Picker
              id={`${id}-lobby`}
              options={voiceChannels}
              value={draft.lobbyChannelId || null}
              onChange={(value) => set("lobbyChannelId", value ?? "")}
              placeholder="Pick a voice channel"
              emptyText="No voice channels match"
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-category`}>Category</Label>
            <Picker
              id={`${id}-category`}
              options={categories}
              value={draft.categoryId}
              onChange={(value) => set("categoryId", value)}
              placeholder="Same as the lobby"
              emptyText="No categories match"
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              New channels copy this category&apos;s permissions. Leave it empty to put them next to the lobby.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-template`}>Channel name</Label>
            <Input
              id={`${id}-template`}
              value={draft.nameTemplate}
              onChange={(event) => set("nameTemplate", event.target.value)}
              maxLength={templateMax}
              required
              className="h-11 md:h-9"
              aria-describedby={`${id}-template-hint`}
            />
            <p id={`${id}-template-hint`} className="text-xs text-muted-foreground">
              Placeholders:{" "}
              {placeholders.map((placeholder, index) => (
                <span key={placeholder.key}>
                  {index > 0 && ", "}
                  <code>{`{${placeholder.key}}`}</code> ({placeholder.label.toLowerCase()})
                </span>
              ))}
              . Comes out as &ldquo;{previewName(draft.nameTemplate)}&rdquo;. Owners can rename theirs.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-limit`}>User limit</Label>
            <Input
              id={`${id}-limit`}
              type="number"
              inputMode="numeric"
              min={0}
              max={userLimitMax}
              step={1}
              value={Number.isNaN(draft.defaultUserLimit) ? "" : draft.defaultUserLimit}
              onChange={(event) => set("defaultUserLimit", event.target.value === "" ? Number.NaN : Number(event.target.value))}
              className="h-11 w-32 md:h-9"
              aria-describedby={`${id}-limit-hint`}
            />
            <p id={`${id}-limit-hint`} className="text-xs text-muted-foreground">
              0 is no limit, up to {userLimitMax}. Owners can change it with /voice-limit.
            </p>
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !valid}>
              {editing === "new" ? "Add lobby" : "Save"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
