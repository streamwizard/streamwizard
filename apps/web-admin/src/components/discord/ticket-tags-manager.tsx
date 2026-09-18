"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CORE_VARIABLES, findUnknownVariables } from "@repo/discord-message";
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
  Textarea,
} from "@repo/ui";
import { SortableList } from "@repo/ui/components/sortable-list";
import {
  createTicketTagAction,
  removeTicketTagAction,
  reorderTicketTagsAction,
  updateTicketTagAction,
  type TicketTagFormInput,
} from "@/actions/discord-ticket-tags";
import { toastResult } from "./toast-result";

export interface TicketTagView {
  id: string;
  name: string;
  content: string;
  triggerKeywords: string[];
  autoReply: boolean;
}

interface TicketTagsManagerProps {
  items: TicketTagView[];
  nameMax: number;
  contentMax: number;
  keywordsMax: number;
}

const ALLOWED = CORE_VARIABLES.map((v) => v.key);
const EMPTY: TicketTagFormInput = { name: "", content: "", triggerKeywords: [], autoReply: false };

/** Canned answers: posted with /tag, or on their own when a member's message contains a keyword. */
export function TicketTagsManager({ items, nameMax, contentMax, keywordsMax }: TicketTagsManagerProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [order, setOrder] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<TicketTagView | "new" | null>(null);
  const ordered = order ? [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : items;

  const reorder = (next: TicketTagView[]) => {
    const ids = next.map((item) => item.id);
    setOrder(ids);
    start(async () => {
      const result = await reorderTicketTagsAction(ids);
      if (result.error) {
        toast.error(result.error);
        setOrder(null);
      }
      router.refresh();
    });
  };

  const remove = (item: TicketTagView) =>
    start(async () => {
      if (toastResult(await removeTicketTagAction(item.id), `${item.name} is removed.`)) {
        setOrder(null);
        router.refresh();
      }
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Tags</CardTitle>
          <CardDescription>
            Canned answers. Staff post one with <code>/tag name</code> or from the reply box on a ticket page. A tag with
            auto-reply on posts itself once per ticket when a member&apos;s message contains one of its keywords. Drag to
            change the order.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing("new")} disabled={pending}>
          <Plus />
          Add tag
        </Button>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet. Add the answers you keep typing.</p>
        ) : (
          <SortableList id="ticket-tag-order" items={ordered} onReorder={reorder} disabled={pending} itemLabel={(item) => item.name}>
            {(item) => (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <code>/tag {item.name}</code>
                    {item.autoReply && <Badge variant="secondary">Auto-reply</Badge>}
                  </p>
                  <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.content}</p>
                  {item.triggerKeywords.length > 0 && (
                    <p className="flex flex-wrap gap-1">
                      {item.triggerKeywords.map((keyword) => (
                        <Badge key={keyword} variant="outline" className="font-normal">
                          {keyword}
                        </Badge>
                      ))}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${item.name}`} title="Edit" disabled={pending} onClick={() => setEditing(item)}>
                    <Pencil />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${item.name}`} title="Remove" disabled={pending}>
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {item.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          <code>/tag {item.name}</code> stops working and it won&apos;t auto-reply anymore. Answers it already posted stay.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(item)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </SortableList>
        )}
      </CardContent>

      <TagDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        editing={editing}
        pending={pending}
        nameMax={nameMax}
        contentMax={contentMax}
        keywordsMax={keywordsMax}
        onClose={() => setEditing(null)}
        onSubmit={(draft) =>
          start(async () => {
            const result = editing === "new" ? await createTicketTagAction(draft) : editing ? await updateTicketTagAction(editing.id, draft) : null;
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

function TagDialog({
  editing,
  pending,
  nameMax,
  contentMax,
  keywordsMax,
  onClose,
  onSubmit,
}: {
  editing: TicketTagView | "new" | null;
  pending: boolean;
  nameMax: number;
  contentMax: number;
  keywordsMax: number;
  onClose: () => void;
  onSubmit: (draft: TicketTagFormInput) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<TicketTagFormInput>(() =>
    editing && editing !== "new"
      ? { name: editing.name, content: editing.content, triggerKeywords: editing.triggerKeywords, autoReply: editing.autoReply }
      : EMPTY,
  );
  const [keyword, setKeyword] = useState("");
  const set = <K extends keyof TicketTagFormInput>(key: K, value: TicketTagFormInput[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const unknown = findUnknownVariables(draft.content, ALLOWED);
  const addKeyword = () => {
    const clean = keyword.trim().toLowerCase();
    if (!clean || draft.triggerKeywords.includes(clean) || draft.triggerKeywords.length >= keywordsMax) return;
    set("triggerKeywords", [...draft.triggerKeywords, clean]);
    setKeyword("");
  };
  const valid = draft.name.trim() && draft.content.trim() && unknown.length === 0 && (!draft.autoReply || draft.triggerKeywords.length > 0);

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ ...draft, name: draft.name.trim().toLowerCase(), content: draft.content.trim() });
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing === "new" || !editing ? "Add a tag" : `Edit ${editing.name}`}</DialogTitle>
            <DialogDescription>Staff type /tag and the name. Keep it short.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={draft.name}
              onChange={(event) => set("name", event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              maxLength={nameMax}
              placeholder="obs-connect"
              required
              autoFocus
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-content`}>Answer</Label>
            <Textarea
              id={`${id}-content`}
              value={draft.content}
              onChange={(event) => set("content", event.target.value)}
              maxLength={contentMax}
              rows={5}
              required
              aria-describedby={`${id}-content-hint`}
            />
            <p id={`${id}-content-hint`} className="text-xs text-muted-foreground">
              Discord formatting works. Placeholders:{" "}
              {CORE_VARIABLES.map((variable, index) => (
                <span key={variable.key}>
                  {index > 0 && ", "}
                  <code title={variable.label}>[{variable.key}]</code>
                </span>
              ))}
              . The member is whoever the tag is for.
            </p>
            {unknown.length > 0 && <p className="text-xs text-destructive">Unknown placeholder {unknown.map((u) => `[${u}]`).join(", ")}.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-keyword`}>Keywords</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-keyword`}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addKeyword();
                  }
                }}
                maxLength={50}
                placeholder="won't connect"
                disabled={draft.triggerKeywords.length >= keywordsMax}
              />
              <Button type="button" variant="outline" onClick={addKeyword} disabled={!keyword.trim() || draft.triggerKeywords.length >= keywordsMax}>
                Add
              </Button>
            </div>
            {draft.triggerKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {draft.triggerKeywords.map((item) => (
                  <Badge key={item} variant="outline" className="gap-1 font-normal">
                    {item}
                    <button
                      type="button"
                      aria-label={`Remove keyword ${item}`}
                      className="rounded-full hover:text-foreground"
                      onClick={() => set("triggerKeywords", draft.triggerKeywords.filter((k) => k !== item))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Plain words or phrases, matched anywhere in a member&apos;s message, any capitalisation. Up to {keywordsMax}.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-auto`}>Auto-reply</Label>
              <p className="text-xs text-muted-foreground">Post this answer on its own, once per ticket, when a member&apos;s message contains a keyword.</p>
            </div>
            <Switch id={`${id}-auto`} checked={draft.autoReply} onCheckedChange={(value) => set("autoReply", value)} disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !valid}>
              {editing === "new" ? "Add tag" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
