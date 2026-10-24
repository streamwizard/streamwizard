"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { Check, Loader2, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@repo/ui";
import {
  addContentCommentAction,
  deleteContentCommentAction,
  listContentCommentsAction,
  resolveContentCommentAction,
  type CommentView,
} from "@/actions/cms-comments";
import { countComments } from "@/lib/cms/review";
import { formatDateTime } from "@/lib/discord/tickets";
import { cn } from "@/lib/utils";

// Notes admins leave each other on a draft. A comment is about a heading or
// about the post as a whole, never about a stretch of text: anchors survive
// rewriting, character offsets don't.

interface Thread {
  comment: CommentView;
  replies: CommentView[];
}

function threadsOf(comments: CommentView[]): Thread[] {
  const roots = comments.filter((comment) => !comment.parentId);
  return roots.map((comment) => ({
    comment,
    replies: comments.filter((reply) => reply.parentId === comment.id),
  }));
}

function Author({ id }: { id: string | null }) {
  // Admins are few and know each other; the account id is noise on screen.
  return <span className="text-xs text-muted-foreground">{id ? "An admin" : "A deleted account"}</span>;
}

export function CommentsSheet({
  contentId,
  open,
  onOpenChange,
  headings,
  onCountChange,
}: {
  contentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Headings on the page, to say what a comment is about and to file a new one. */
  headings: { anchor: string; text: string }[];
  onCountChange?: (open: number) => void;
}) {
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [draft, setDraft] = useState("");
  const [about, setAbout] = useState<string>("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [pending, start] = useTransition();

  // Same two lines as the effect below, but reachable from an event handler:
  // an effect event can only be called from an effect.
  const apply = useEffectEvent((loaded: CommentView[]) => {
    setComments(loaded);
    onCountChange?.(countComments(loaded).open);
  });

  const load = async () => {
    const result = await listContentCommentsAction(contentId);
    if (result.error) return void toast.error(result.error);
    setComments(result.comments);
    onCountChange?.(countComments(result.comments).open);
  };

  // Reloading when the sheet opens is enough: comments move at human speed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await listContentCommentsAction(contentId);
      if (cancelled) return;
      if (result.error) return void toast.error(result.error);
      apply(result.comments);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contentId]);

  const add = (body: string, parentId: string | null, anchor: string | null) =>
    start(async () => {
      const result = await addContentCommentAction({ contentId, body, parentId, anchor });
      if (result.error) return void toast.error(result.error);
      setDraft("");
      setReplyDraft("");
      setReplyTo(null);
      await load();
    });

  const resolve = (commentId: string, resolved: boolean) =>
    start(async () => {
      const result = await resolveContentCommentAction(contentId, commentId, resolved);
      if (result.error) return void toast.error(result.error);
      await load();
    });

  const remove = (commentId: string) =>
    start(async () => {
      const result = await deleteContentCommentAction(contentId, commentId);
      if (result.error) return void toast.error(result.error);
      await load();
    });

  const headingText = (anchor: string | null) =>
    anchor ? (headings.find((heading) => heading.anchor === anchor)?.text ?? "a heading that's gone") : null;

  const threads = threadsOf(comments ?? []);
  const openThreads = threads.filter((thread) => !thread.comment.resolvedAt);
  const doneThreads = threads.filter((thread) => thread.comment.resolvedAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Comments</SheetTitle>
          <SheetDescription>
            Notes for whoever picks this up next. Readers never see them, and they don&apos;t hold up publishing.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-b p-4">
          <Textarea
            value={draft}
            rows={3}
            maxLength={4000}
            placeholder="What needs saying?"
            aria-label="New comment"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={about}
              aria-label="What it's about"
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
              onChange={(event) => setAbout(event.target.value)}
            >
              <option value="">The whole post</option>
              {headings.map((heading) => (
                <option key={heading.anchor} value={heading.anchor}>
                  {heading.text}
                </option>
              ))}
            </select>
            <Button
              className="h-9"
              disabled={pending || !draft.trim()}
              onClick={() => add(draft, null, about || null)}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <MessageSquare aria-hidden />}
              Comment
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 p-4">
          {comments === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            [...openThreads, ...doneThreads].map((thread) => (
              <article
                key={thread.comment.id}
                className={cn("space-y-2 rounded-lg border p-3", thread.comment.resolvedAt && "opacity-60")}
              >
                <header className="flex flex-wrap items-center gap-2">
                  {thread.comment.anchor && <Badge variant="outline">{headingText(thread.comment.anchor)}</Badge>}
                  <Author id={thread.comment.authorId} />
                  <time className="text-xs text-muted-foreground" dateTime={thread.comment.createdAt}>
                    {formatDateTime(thread.comment.createdAt)}
                  </time>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={pending}
                      aria-label={thread.comment.resolvedAt ? "Reopen this thread" : "Resolve this thread"}
                      onClick={() => resolve(thread.comment.id, !thread.comment.resolvedAt)}
                    >
                      {thread.comment.resolvedAt ? <RotateCcw /> : <Check />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={pending}
                      aria-label="Delete this comment"
                      onClick={() => remove(thread.comment.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </header>
                <p className="text-sm whitespace-pre-wrap">{thread.comment.body}</p>

                {thread.replies.map((reply) => (
                  <div key={reply.id} className="ml-4 border-l pl-3">
                    <div className="flex items-center gap-2">
                      <Author id={reply.authorId} />
                      <time className="text-xs text-muted-foreground" dateTime={reply.createdAt}>
                        {formatDateTime(reply.createdAt)}
                      </time>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                  </div>
                ))}

                {replyTo === thread.comment.id ? (
                  <div className="ml-4 space-y-2">
                    <Textarea
                      value={replyDraft}
                      rows={2}
                      maxLength={4000}
                      autoFocus
                      aria-label="Reply"
                      onChange={(event) => setReplyDraft(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={pending || !replyDraft.trim()}
                        onClick={() => add(replyDraft, thread.comment.id, null)}
                      >
                        Reply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  !thread.comment.resolvedAt && (
                    <Button size="sm" variant="ghost" className="ml-4" onClick={() => setReplyTo(thread.comment.id)}>
                      Reply
                    </Button>
                  )
                )}
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
