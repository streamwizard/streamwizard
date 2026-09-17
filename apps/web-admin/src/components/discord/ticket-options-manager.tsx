"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
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
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from "@repo/ui";
import { SortableList } from "@repo/ui/components/sortable-list";
import type { DiscordActionResult } from "@/lib/discord/action";
import type { RemoveResult } from "@/actions/discord-ticket-config";
import type { PickerOption } from "@/lib/discord/options";
import { emojiForDisplay } from "@/lib/discord/ticket-options";
import { Picker } from "./pickers";
import { toastResult } from "./toast-result";

/** A category or a product, flattened to what the list and the dialog need. */
export interface TicketOption {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string | null;
  archived: boolean;
  /** Categories only. */
  enabled?: boolean;
  discordCategoryId?: string | null;
}

export interface TicketOptionDraft {
  name: string;
  description: string;
  emoji: string | null;
  enabled: boolean;
  discordCategoryId: string | null;
}

interface TicketOptionsManagerProps {
  kind: "category" | "product";
  title: string;
  description: string;
  items: TicketOption[];
  /** Most options Discord can show at once. */
  limit: number;
  nameMax: number;
  descriptionMax: number;
  /** Discord category channels, for a category's "create tickets under". Categories only. */
  discordCategories?: PickerOption[];
  /** A page with more to set up for one item: a category's form and opening message. */
  detailHref?: (item: TicketOption) => string;
  onCreate: (draft: TicketOptionDraft) => Promise<DiscordActionResult>;
  onUpdate: (id: string, draft: TicketOptionDraft) => Promise<DiscordActionResult>;
  onRemove: (id: string) => Promise<RemoveResult>;
  onRestore: (id: string) => Promise<DiscordActionResult>;
  onReorder: (orderedIds: string[]) => Promise<DiscordActionResult>;
}

const EMPTY: TicketOptionDraft = { name: "", description: "", emoji: null, enabled: true, discordCategoryId: null };

/** Add, edit, reorder, archive: the whole life of a ticket category or product list. */
export function TicketOptionsManager(props: TicketOptionsManagerProps) {
  const { kind, title, description, items, limit } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  // Local order so a drag lands at once; the server copy replaces it on refresh.
  const [order, setOrder] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<TicketOption | "new" | null>(null);

  const active = items.filter((item) => !item.archived);
  const archived = items.filter((item) => item.archived);
  const ordered = order
    ? [...active].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    : active;
  const full = active.length >= limit;

  const run = (action: () => Promise<DiscordActionResult>, success: string) =>
    start(async () => {
      if (toastResult(await action(), success)) {
        setOrder(null);
        router.refresh();
      }
    });

  const reorder = (next: TicketOption[]) => {
    const ids = next.map((item) => item.id);
    setOrder(ids);
    start(async () => {
      const result = await props.onReorder(ids);
      if (result.error) {
        toast.error(result.error);
        setOrder(null);
      }
      router.refresh();
    });
  };

  const remove = (item: TicketOption) =>
    start(async () => {
      const result = await props.onRemove(item.id);
      if (result.error) return void toast.error(result.error);
      if (result.warning) toast.warning(result.warning);
      else if (result.outcome === "archived") toast.success(`${item.name} is archived. Old tickets keep the label.`);
      else toast.success(`${item.name} is removed.`);
      setOrder(null);
      router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing("new")}
          disabled={pending || full}
          title={full ? `Discord fits ${limit} in a menu` : undefined}
        >
          <Plus />
          Add {kind}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {kind === "category"
              ? "No categories yet. Members can't open tickets until there is one."
              : "No products yet. The ticket form skips the product question."}
          </p>
        ) : (
          <SortableList
            id={`ticket-${kind}-order`}
            items={ordered}
            onReorder={reorder}
            disabled={pending}
            itemLabel={(item) => item.name}
          >
            {(item) => (
              <OptionRow item={item}>
                {props.detailHref && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={props.detailHref(item)}>Form and message</Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${item.name}`}
                  title="Edit"
                  disabled={pending}
                  onClick={() => setEditing(item)}
                >
                  <Pencil />
                </Button>
                <RemoveButton item={item} kind={kind} disabled={pending} onConfirm={() => remove(item)} />
              </OptionRow>
            )}
          </SortableList>
        )}

        {archived.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Archived</h3>
            <p className="text-xs text-muted-foreground">
              Hidden from new tickets. Still here because older tickets use them.
            </p>
            <ul className="divide-y">
              {archived.map((item) => (
                <li key={item.id} className="py-3">
                  <OptionRow item={item}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || full}
                      onClick={() => run(() => props.onRestore(item.id), `${item.name} is back.`)}
                    >
                      <ArchiveRestore />
                      Restore
                    </Button>
                  </OptionRow>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <OptionDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        {...props}
        editing={editing}
        pending={pending}
        onClose={() => setEditing(null)}
        onSubmit={(draft) =>
          start(async () => {
            const result =
              editing === "new" ? await props.onCreate(draft) : editing ? await props.onUpdate(editing.id, draft) : null;
            if (!result) return;
            if (toastResult(result, editing === "new" ? `${draft.name} is added.` : "Saved.")) {
              setEditing(null);
              router.refresh();
            }
          })
        }
      />
    </Card>
  );
}

function OptionRow({ item, children }: { item: TicketOption; children: React.ReactNode }) {
  const emoji = emojiForDisplay(item.emoji);
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 shrink-0 truncate text-center text-lg" aria-hidden="true">
        {emoji ?? "·"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="truncate">{item.name}</span>
          <code className="text-xs font-normal text-muted-foreground">{item.slug}</code>
          {item.enabled === false && !item.archived && <Badge variant="outline">Off</Badge>}
        </p>
        {item.description && <p className="truncate text-xs text-muted-foreground">{item.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}

function RemoveButton({
  item,
  kind,
  disabled,
  onConfirm,
}: {
  item: TicketOption;
  kind: "category" | "product";
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Remove ${item.name}`} title="Remove" disabled={disabled}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {item.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Members can&apos;t pick this {kind} anymore. If tickets already use it, it gets archived instead of
            deleted, so they keep their label and you can restore it later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface OptionDialogProps extends Pick<TicketOptionsManagerProps, "kind" | "nameMax" | "descriptionMax" | "discordCategories"> {
  editing: TicketOption | "new" | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (draft: TicketOptionDraft) => void;
}

function OptionDialog({
  kind,
  nameMax,
  descriptionMax,
  discordCategories,
  editing,
  pending,
  onClose,
  onSubmit,
}: OptionDialogProps) {
  const id = useId();
  const [draft, setDraft] = useState<TicketOptionDraft>(() =>
    editing && editing !== "new"
      ? {
          name: editing.name,
          description: editing.description,
          emoji: editing.emoji,
          enabled: editing.enabled ?? true,
          discordCategoryId: editing.discordCategoryId ?? null,
        }
      : EMPTY,
  );
  const set = <K extends keyof TicketOptionDraft>(key: K, value: TicketOptionDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const isNew = editing === "new";

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ ...draft, name: draft.name.trim(), description: draft.description.trim() });
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing === "new" || !editing ? `Add a ${kind}` : `Edit ${editing.name}`}</DialogTitle>
            <DialogDescription>
              {kind === "category"
                ? "Members pick a category when they open a ticket."
                : "Members say which product their ticket is about."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={nameMax}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-description`}>Description</Label>
            <Input
              id={`${id}-description`}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={descriptionMax}
              aria-describedby={`${id}-description-hint`}
            />
            <p id={`${id}-description-hint`} className="text-xs text-muted-foreground">
              Shown under the name in Discord&apos;s menu. Optional.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-emoji`}>Emoji</Label>
            <Input
              id={`${id}-emoji`}
              value={draft.emoji ?? ""}
              onChange={(event) => set("emoji", event.target.value || null)}
              maxLength={64}
              className="w-40"
              aria-describedby={`${id}-emoji-hint`}
            />
            <p id={`${id}-emoji-hint`} className="text-xs text-muted-foreground">
              One emoji, or a server emoji as {"<:name:id>"}. Optional.
            </p>
          </div>

          {kind === "category" && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${id}-parent`}>Create tickets under</Label>
                <Picker
                  id={`${id}-parent`}
                  options={discordCategories ?? []}
                  value={draft.discordCategoryId}
                  onChange={(value) => set("discordCategoryId", value)}
                  placeholder="The default ticket category"
                  emptyText="No categories match"
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the ticket category from the general settings.
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`${id}-enabled`}>Open for new tickets</Label>
                  <p className="text-xs text-muted-foreground">Off hides it from members without archiving it.</p>
                </div>
                <Switch
                  id={`${id}-enabled`}
                  checked={draft.enabled}
                  onCheckedChange={(value) => set("enabled", value)}
                  disabled={pending}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !draft.name.trim()}>
              {isNew ? `Add ${kind}` : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
