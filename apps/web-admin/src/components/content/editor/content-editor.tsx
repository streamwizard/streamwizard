"use client";

import { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleAlert,
  History,
  ImagePlus,
  ListCollapse,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { contentPath, countWords } from "@repo/cms";
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
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@repo/ui";
import { setContentReviewStateAction } from "@/actions/cms-comments";
import { saveContentDraftAction, trashContentAction } from "@/actions/cms-content";
import { createTagAction } from "@/actions/cms-taxonomy";
import { useAutosave, type AutosaveStatus } from "@/hooks/use-autosave";
import { forgetOpeningDraft, useContentDraftRecovery } from "@/hooks/use-content-draft-recovery";
import {
  DIFFICULTIES,
  LIMITS,
  deriveDraft,
  slugForTitle,
  type ContentDraft,
  type ContentType,
  type Difficulty,
} from "@/lib/cms/draft";
import type { CmsMediaItem } from "@/lib/cms/media-items";
import { clearLocalDraft, writeLocalDraft } from "@/lib/cms/local-draft";
import { publishReadiness } from "@/lib/cms/readiness";
import { REVIEW_BADGE, REVIEW_LABELS, nextReviewStates, type ReviewState } from "@/lib/cms/review";
import { PageCrumb } from "@/lib/crumbs";
import { cn } from "@/lib/utils";
import { FormField } from "../form-field";
import { ImagePickerDialog } from "../image-picker-dialog";
import { ChipPicker, type PickerOption } from "./chip-picker";
import { CommentsSheet } from "./comments-sheet";
import { EditorOutline } from "./editor-outline";
import { EditorWorkspace, type LinkTarget } from "./editor-workspace";
import { FindReplaceDialog } from "./find-replace-dialog";
import { PreviewMenu } from "./preview-menu";
import { PreviewPane } from "./preview-pane";
import { PublishControls } from "./publish-controls";
import { RestoreDraftDialog } from "./restore-draft-dialog";
import { RichTextEditor, WorkspaceToolbar } from "./rich-text-editor";
import { SearchPreview } from "./search-preview";
import { SectionList } from "./section-list";

export type ContentStatus = "draft" | "scheduled" | "published" | "archived";

export interface EditorImage {
  url: string;
  alt: string;
  decorative: boolean;
}

export interface ContentEditorProps {
  id: string;
  type: ContentType;
  status: ContentStatus;
  lockVersion: number;
  initial: ContentDraft;
  /** The live copy's slug, when the post is on the site. */
  publishedSlug: string | null;
  /** The live page on the site, when published and the site URL is known. */
  liveUrl: string | null;
  /** When a scheduled post goes live. */
  publishAt: string | null;
  /** The working copy changed after the live copy was made. */
  unpublishedChanges: boolean;
  scheduleError: string | null;
  /** The stored body was written by a newer deploy than this one. */
  futureBody: boolean;
  /** When the working copy was last saved on the server, to judge a local copy against. */
  updatedAt: string;
  /** Where this draft stands with the other admins. Advisory: it never blocks publishing. */
  reviewState: ReviewState;
  options: { authors: PickerOption[]; categories: PickerOption[]; tags: PickerOption[]; related: PickerOption[] };
  /** Cover and OG images the draft already points at. */
  images: Record<string, EditorImage>;
  /** Other posts and guides, for the link search. */
  linkablePosts: { title: string; path: string; type: ContentType; live: boolean }[];
}

const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

function SaveStatus({ status, conflict }: { status: AutosaveStatus; conflict: boolean }) {
  if (conflict) return null;
  if (status === "idle") return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      {status === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {status === "saved" && <Check className="size-3.5" aria-hidden />}
      {status === "error" && <AlertTriangle className="size-3.5 text-destructive" aria-hidden />}
      {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Couldn't save · kept on this device"}
    </span>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={value.length > max * 0.9 ? "text-amber-600 dark:text-amber-400" : undefined}>
      {value.length}/{max}
    </span>
  );
}

function ImageField({
  label,
  hint,
  image,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  image: EditorImage | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN image in an internal tool
        <img src={image.url} alt={image.alt} className="aspect-video w-full rounded-md border bg-muted object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <ImagePlus aria-hidden className="size-6" />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="h-11 md:h-8" onClick={onPick}>
          {image ? "Change" : "Choose"}
        </Button>
        {image && (
          <Button type="button" variant="ghost" size="sm" className="h-11 md:h-8" onClick={onClear}>
            <X aria-hidden />
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * One blog post or guide. Everything autosaves into the working copy; the live
 * site only changes when it is published. A save that finds someone else's
 * newer version stops autosaving and asks for a reload instead of overwriting.
 */
const SCHEDULED_AT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function ContentEditor(props: ContentEditorProps) {
  const { id, type, status, publishedSlug, unpublishedChanges, scheduleError, futureBody, options } = props;
  const uid = useId();
  const router = useRouter();
  const [draft, setDraft] = useState<ContentDraft>(props.initial);
  const [images, setImages] = useState(props.images);
  const [conflict, setConflict] = useState(false);
  const [picker, setPicker] = useState<"cover" | "og" | null>(null);
  const [tagOptions, setTagOptions] = useState(options.tags);
  const [pending, start] = useTransition();
  const [trashOpen, setTrashOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [folded, setFolded] = useState<string[]>([]);
  // The side-by-side preview, on wide screens. `saves` ticks after every save so it reloads.
  const [beside, setBeside] = useState(false);
  const [saves, setSaves] = useState(0);
  // Bumped by a restore: the editors own their content after mount, so the
  // only way to put different text in them is to mount them again.
  const [restoreKey, setRestoreKey] = useState(0);
  const [mounted, setMounted] = useState<ContentDraft>(props.initial);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [review, setReview] = useState<ReviewState>(props.reviewState);
  const lock = useRef(props.lockVersion);
  const latest = useRef(props.initial);
  const writing = useRef<HTMLDivElement>(null);
  const summaryField = useRef<HTMLTextAreaElement>(null);
  const guide = type === "guide";

  useEffect(() => {
    latest.current = draft;
  });

  const set = <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async (value: ContentDraft, kind: "autosave" | "manual" = "autosave"): Promise<boolean> => {
    if (conflict) return false;
    // Parked here first: if the request never lands, the text survives the tab.
    writeLocalDraft(id, value, lock.current);
    const result = await saveContentDraftAction(id, type, lock.current, value, kind);
    if (result.conflict) {
      setConflict(true);
      return false;
    }
    if (result.error || result.lockVersion === null) {
      toast.error(result.error ?? "Couldn't save.");
      return false;
    }
    lock.current = result.lockVersion;
    clearLocalDraft(id);
    forgetOpeningDraft(id);
    setSaves((count) => count + 1);
    if (result.removed > 0) toast.warning("Some pasted content isn't supported here and was left out when saving.");
    return true;
  };

  const { status: saveStatus, flush } = useAutosave(draft, (value) => save(value));

  // A tab closed inside the debounce, or while a save is failing, still leaves
  // the text in this browser. pagehide fires where beforeunload doesn't (iOS,
  // bfcache), and localStorage is synchronous, so it always completes.
  useEffect(() => {
    const park = () => writeLocalDraft(id, latest.current, lock.current);
    window.addEventListener("pagehide", park);
    return () => window.removeEventListener("pagehide", park);
  }, [id]);

  // Back online: send what's waiting instead of sitting on "Couldn't save"
  // until the next keystroke.
  useEffect(() => {
    const retry = () => void flush();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [flush]);

  const restoreLocal = useCallback((recovered: ContentDraft) => {
    setDraft(recovered);
    setMounted(recovered);
    setRestoreKey((key) => key + 1);
  }, []);
  const recovery = useContentDraftRecovery(id, props.updatedAt, restoreLocal);

  const derived = useMemo(() => deriveDraft(type, draft), [type, draft]);
  const cover = draft.coverAssetId ? (images[draft.coverAssetId] ?? null) : null;
  const og = draft.ogAssetId ? (images[draft.ogAssetId] ?? null) : null;
  const readiness = useMemo(
    () =>
      publishReadiness(type, draft, { coverAlt: cover ? { alt: cover.alt, decorative: cover.decorative } : undefined }),
    [type, draft, cover],
  );
  const errors = readiness.filter((item) => item.severity === "error");
  const warnings = readiness.filter((item) => item.severity === "warning");
  const linkTargets = useMemo<LinkTarget[]>(
    () => [
      ...derived.toc
        .filter((entry) => entry.text)
        .map((entry) => ({ label: entry.text, href: `#${entry.anchor}`, hint: "On this page" })),
      ...props.linkablePosts.map((post) => ({
        label: post.title,
        href: post.path,
        hint: `${post.type === "guide" ? "Guide" : "Blog post"}${post.live ? "" : " · not live"}`,
      })),
    ],
    [derived.toc, props.linkablePosts],
  );

  // A post with some structure opens on its outline; a fresh one on its details.
  const [tab, setTab] = useState(() => (derived.toc.length > 1 ? "outline" : "details"));

  const setTitle = (title: string) =>
    setDraft((current) => {
      // The slug follows the title until the post has been on the site or the slug was set by hand.
      const placeholder =
        /^untitled-[0-9a-f]{8}$/.test(current.slug) || current.slug === slugForTitle(current.title, current.slug);
      return {
        ...current,
        title,
        slug: !publishedSlug && placeholder ? slugForTitle(title, current.slug) : current.slug,
      };
    });

  const saveVersion = () =>
    start(async () => {
      if (!(await flush())) return;
      if (await save(draft, "manual")) toast.success("Version saved. Find it under Revisions.");
    });

  // Ctrl/Cmd+S saves a version instead of opening the browser's save dialog.
  // Ctrl/Cmd+H opens find and replace, like in most editors.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      saveVersion();
    } else if (key === "h") {
      event.preventDefault();
      setFindOpen(true);
    }
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => onShortcut(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trash = () =>
    start(async () => {
      await flush();
      const result = await trashContentAction(id, lock.current);
      if (result.error) return void toast.error(result.error);
      toast.success(publishedSlug ? "Moved to the trash and taken off the site." : "Moved to the trash.");
      router.push("/content");
    });

  const pickImage = (asset: CmsMediaItem) => {
    setImages((current) => ({
      ...current,
      [asset.id]: { url: asset.url, alt: asset.alt, decorative: asset.decorative },
    }));
    if (picker === "cover") set("coverAssetId", asset.id);
    if (picker === "og") set("ogAssetId", asset.id);
  };

  const createTag = async (name: string): Promise<PickerOption | null> => {
    const result = await createTagAction(name);
    if (result.error || !result.tag) {
      toast.error(result.error ?? "Couldn't add the tag.");
      return null;
    }
    const option = { id: result.tag.id, label: result.tag.name };
    setTagOptions((current) => [...current, option].sort((a, b) => a.label.localeCompare(b.label)));
    return option;
  };

  const categoryOptions = options.categories.filter((option) => draft.categoryIds.includes(option.id));

  const plainFields = [
    { label: "Title", value: draft.title },
    { label: "Summary", value: draft.summary },
    { label: "Excerpt", value: draft.excerpt },
    { label: "SEO title", value: draft.seoTitle },
    { label: "Meta description", value: draft.seoDescription },
    ...(guide
      ? [
          ...draft.sections.map((section, index) => ({ label: `Section ${index + 1} title`, value: section.title })),
          ...draft.prerequisites.map((item, index) => ({ label: `Prerequisite ${index + 1}`, value: item })),
        ]
      : []),
  ];
  const replaceInFields = (replace: (text: string) => string) =>
    setDraft((current) => ({
      ...current,
      title: replace(current.title),
      summary: replace(current.summary),
      excerpt: replace(current.excerpt),
      seoTitle: replace(current.seoTitle),
      seoDescription: replace(current.seoDescription),
      sections: current.sections.map((section) => ({ ...section, title: replace(section.title) })),
      prerequisites: current.prerequisites.map(replace),
    }));

  return (
    <EditorWorkspace linkTargets={linkTargets}>
      <div className="flex flex-col gap-6">
        <RestoreDraftDialog {...recovery} />
        <CommentsSheet
          contentId={id}
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          headings={derived.toc.map((entry) => ({ anchor: entry.anchor, text: entry.text || "Untitled heading" }))}
          onCountChange={setOpenComments}
        />
        <PageCrumb label={draft.title.trim() || "Untitled"} href={`/content/${id}`} />
        <h1 className="sr-only">{draft.title.trim() || (guide ? "Untitled guide" : "Untitled post")}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <Badge variant={status === "published" ? "default" : "outline"}>{STATUS_LABELS[status]}</Badge>
            {status === "scheduled" && props.publishAt && (
              <span className="text-xs">
                Goes live {/* The server renders in its own timezone; the browser corrects it to the admin's. */}
                <time dateTime={props.publishAt} suppressHydrationWarning>
                  {SCHEDULED_AT.format(new Date(props.publishAt))}
                </time>
              </span>
            )}
            {publishedSlug && unpublishedChanges && <Badge variant="secondary">Unpublished changes</Badge>}
            <span className="tabular-nums">
              {guide ? "Guide" : "Blog post"} · {derived.words} words · {derived.minutes} min read
            </span>
            <SaveStatus status={saveStatus} conflict={conflict} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 md:h-9">
                  <Badge variant={REVIEW_BADGE[review]}>{REVIEW_LABELS[review]}</Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {nextReviewStates(review).map((state) => (
                  <DropdownMenuItem
                    key={state}
                    onSelect={() =>
                      start(async () => {
                        const previous = review;
                        setReview(state);
                        const result = await setContentReviewStateAction(id, state);
                        if (result.error) {
                          setReview(previous);
                          toast.error(result.error);
                        }
                      })
                    }
                  >
                    {REVIEW_LABELS[state]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" className="h-11 md:h-9" onClick={() => setCommentsOpen(true)}>
              <MessageSquare aria-hidden />
              Comments
              {openComments !== null && openComments > 0 && <Badge variant="secondary">{openComments}</Badge>}
            </Button>
            <PreviewMenu contentId={id} flush={flush} />
            <Button
              variant={beside ? "secondary" : "ghost"}
              size="icon"
              className="hidden xl:inline-flex"
              aria-pressed={beside}
              aria-label="Preview next to the editor"
              title="Preview next to the editor"
              onClick={() => setBeside((open) => !open)}
            >
              <PanelRight />
            </Button>
            <PublishControls
              contentId={id}
              status={status}
              path={contentPath(type, draft.slug)}
              liveUrl={props.liveUrl}
              readiness={readiness}
              publishAt={props.publishAt}
              flush={flush}
              lockVersion={() => lock.current}
              disabled={pending || conflict}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={saveVersion} disabled={pending || conflict}>
                  <Save aria-hidden />
                  Save version
                  <DropdownMenuShortcut>Ctrl S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFindOpen(true)}>
                  <Search aria-hidden />
                  Find and replace
                  <DropdownMenuShortcut>Ctrl H</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/content/${id}/revisions`}>
                    <History aria-hidden />
                    Revisions
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setTrashOpen(true)} disabled={pending}>
                  <Trash2 aria-hidden />
                  Move to trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={trashOpen} onOpenChange={setTrashOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Move to the trash?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {publishedSlug
                      ? "It comes off the site right away. You can restore it from the trash."
                      : "You can restore it from the trash."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={trash}>Move to trash</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {conflict && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm"
          >
            <CircleAlert className="size-4 text-destructive" aria-hidden />
            <span className="flex-1">
              Someone else saved this post in another tab or session. Autosave is paused so nothing gets overwritten.
            </span>
            <Button size="sm" className="h-11 md:h-8" onClick={() => window.location.reload()}>
              Reload their version
            </Button>
          </div>
        )}
        {scheduleError && (
          <div role="alert" className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
            The scheduled publish didn&apos;t go through, so this is a draft again. {scheduleError}
          </div>
        )}

        {futureBody && (
          <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
            This post was last edited on a newer version of the admin. Saving it here could drop parts of it. Reload
            once this deploy has caught up.
          </div>
        )}

        <div
          className={cn(
            "grid gap-6",
            beside ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_22rem]",
          )}
        >
          <div ref={writing} className="min-w-0 space-y-6">
            <Textarea
              value={draft.title}
              maxLength={LIMITS.title}
              rows={1}
              // A title is one line on the site: Enter moves on to the summary.
              onChange={(event) => setTitle(event.target.value.replace(/\s*\n\s*/g, " "))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  summaryField.current?.focus();
                }
              }}
              placeholder={guide ? "How to …" : "Title"}
              aria-label="Title"
              className="min-h-0 resize-none rounded-none border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl leading-tight font-semibold tracking-tight shadow-none focus-visible:border-ring focus-visible:ring-0 md:text-3xl dark:bg-transparent"
            />
            <FormField
              label="Summary"
              htmlFor={`${uid}-summary`}
              hint={
                <>
                  The short, direct answer at the top of the page. AI assistants and search snippets quote it.{" "}
                  <Counter value={draft.summary} max={LIMITS.summary} />
                </>
              }
            >
              <Textarea
                ref={summaryField}
                id={`${uid}-summary`}
                value={draft.summary}
                maxLength={LIMITS.summary}
                rows={2}
                onChange={(event) => set("summary", event.target.value)}
              />
            </FormField>

            <WorkspaceToolbar onFind={() => setFindOpen(true)} />

            <div className="space-y-1.5">
              <Label>{guide ? "Intro" : "Body"}</Label>
              <RichTextEditor
                key={restoreKey}
                initial={mounted.body}
                onChange={(body) => set("body", body)}
                placeholder={guide ? "What will the reader have built by the end?" : "Start writing…"}
                label={guide ? "Intro" : "Body"}
              />
            </div>

            {guide && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Sections</h2>
                  {draft.sections.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 md:h-8"
                      onClick={() => setFolded(folded.length > 0 ? [] : draft.sections.map((section) => section.id))}
                    >
                      <ListCollapse aria-hidden />
                      {folded.length > 0 ? "Unfold all" : "Fold all"}
                    </Button>
                  )}
                </div>
                <SectionList
                  key={restoreKey}
                  sections={draft.sections}
                  onChange={(update) => setDraft((current) => ({ ...current, sections: update(current.sections) }))}
                  words={(derived.sections ?? []).map((section) => countWords(section.body_text))}
                  folded={folded}
                  onFold={setFolded}
                />
              </div>
            )}
          </div>

          {beside && (
            <aside className="hidden min-w-0 xl:sticky xl:top-[4.5rem] xl:block xl:h-[calc(100dvh-5.5rem)] xl:self-start xl:pb-4">
              <PreviewPane contentId={id} flush={flush} reloadKey={saves} onClose={() => setBeside(false)} />
            </aside>
          )}
          <aside
            className={cn(
              "min-w-0 space-y-3 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100dvh-5.5rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pb-4",
              beside && "xl:hidden",
            )}
          >
            <button
              type="button"
              onClick={() => setTab("checks")}
              className="flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {errors.length > 0 ? (
                <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
              ) : (
                <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              )}
              <span className="flex-1">
                {errors.length > 0
                  ? `${errors.length} ${errors.length === 1 ? "thing" : "things"} to fix before it can go live`
                  : "Ready to publish"}
                {warnings.length > 0 && (
                  <span className="text-muted-foreground"> · {warnings.length} worth a look</span>
                )}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="outline">Outline</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                {guide && <TabsTrigger value="guide">Guide</TabsTrigger>}
                <TabsTrigger value="checks">
                  Checks
                  {errors.length > 0 && (
                    <Badge variant="destructive" className="ml-1 px-1.5 text-[10px] tabular-nums">
                      {errors.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="outline">
                <Card>
                  <CardContent>
                    <EditorOutline
                      entries={derived.toc}
                      root={writing}
                      onUnfold={(sectionId) => setFolded((current) => current.filter((id) => id !== sectionId))}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details">
                <Card>
                  <CardContent className="space-y-5">
                    <FormField
                      label="Slug"
                      htmlFor={`${uid}-slug`}
                      hint={`streamwizard.org/${guide ? "guides" : "blog"}/${draft.slug || "…"}${publishedSlug && publishedSlug !== draft.slug ? ". The old URL will redirect." : ""}`}
                    >
                      <Input
                        id={`${uid}-slug`}
                        value={draft.slug}
                        maxLength={80}
                        onChange={(event) => set("slug", event.target.value)}
                      />
                    </FormField>
                    <FormField
                      label="Excerpt"
                      htmlFor={`${uid}-excerpt`}
                      hint={
                        <>
                          One or two sentences for cards and link previews.{" "}
                          <Counter value={draft.excerpt} max={LIMITS.excerpt} />
                        </>
                      }
                    >
                      <Textarea
                        id={`${uid}-excerpt`}
                        value={draft.excerpt}
                        maxLength={LIMITS.excerpt}
                        rows={3}
                        onChange={(event) => set("excerpt", event.target.value)}
                      />
                    </FormField>
                    <ImageField
                      label="Cover image"
                      hint="Shown on cards and at the top of the page. 1600 × 900 works well."
                      image={cover}
                      onPick={() => setPicker("cover")}
                      onClear={() => set("coverAssetId", null)}
                    />
                    <div className="space-y-1.5">
                      <Label>Authors</Label>
                      <ChipPicker
                        label="Authors"
                        options={options.authors}
                        value={draft.authorIds}
                        onChange={(ids) => set("authorIds", ids)}
                        max={10}
                      />
                      <p className="text-xs text-muted-foreground">The first one is the byline.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Categories</Label>
                      <ChipPicker
                        label="Categories"
                        options={options.categories}
                        value={draft.categoryIds}
                        onChange={(ids) => set("categoryIds", ids)}
                        max={10}
                      />
                    </div>
                    {categoryOptions.length > 1 && (
                      <FormField
                        label="Primary category"
                        htmlFor={`${uid}-primary`}
                        hint="Used in the breadcrumb and for related posts."
                      >
                        <NativeSelect
                          id={`${uid}-primary`}
                          value={draft.primaryCategoryId ?? ""}
                          onChange={(event) => set("primaryCategoryId", event.target.value || null)}
                          className="w-full"
                        >
                          <NativeSelectOption value="">First one</NativeSelectOption>
                          {categoryOptions.map((option) => (
                            <NativeSelectOption key={option.id} value={option.id}>
                              {option.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FormField>
                    )}
                    <div className="space-y-1.5">
                      <Label>Tags</Label>
                      <ChipPicker
                        label="Tags"
                        options={tagOptions}
                        value={draft.tagIds}
                        onChange={(ids) => set("tagIds", ids)}
                        max={30}
                        onCreate={createTag}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Related posts</Label>
                      <ChipPicker
                        label="Related"
                        options={options.related.filter((option) => option.id !== id)}
                        value={draft.relatedIds}
                        onChange={(ids) => set("relatedIds", ids)}
                        max={10}
                      />
                      <p className="text-xs text-muted-foreground">
                        Shown first under the post; the rest come from the same category and tags.
                      </p>
                    </div>
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`${uid}-featured`}>Featured</Label>
                        <Switch
                          id={`${uid}-featured`}
                          checked={draft.isFeatured}
                          onCheckedChange={(checked) => set("isFeatured", checked)}
                        />
                      </div>
                      <FormField
                        label="Pin position"
                        htmlFor={`${uid}-pin`}
                        hint="Empty: not pinned. 1 shows first on the index page."
                      >
                        <Input
                          id={`${uid}-pin`}
                          type="number"
                          min={1}
                          max={999}
                          value={draft.pinnedRank ?? ""}
                          className="w-28"
                          onChange={(event) =>
                            set(
                              "pinnedRank",
                              event.target.value ? Math.max(1, Number.parseInt(event.target.value, 10) || 1) : null,
                            )
                          }
                        />
                      </FormField>
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`${uid}-comments`}>Comments</Label>
                        <Switch
                          id={`${uid}-comments`}
                          checked={draft.commentsEnabled}
                          onCheckedChange={(checked) => set("commentsEnabled", checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="seo">
                <Card>
                  <CardContent className="space-y-5">
                    <SearchPreview
                      title={draft.seoTitle.trim() || draft.title.trim()}
                      description={draft.seoDescription.trim() || draft.excerpt.trim() || draft.summary.trim()}
                      path={contentPath(type, draft.slug)}
                    />
                    <FormField
                      label="SEO title"
                      htmlFor={`${uid}-seo-title`}
                      hint={
                        <>
                          Empty: the title is used. Around 60 characters shows in full.{" "}
                          <Counter value={draft.seoTitle} max={LIMITS.seoTitle} />
                        </>
                      }
                    >
                      <Input
                        id={`${uid}-seo-title`}
                        value={draft.seoTitle}
                        maxLength={LIMITS.seoTitle}
                        placeholder={draft.title}
                        onChange={(event) => set("seoTitle", event.target.value)}
                      />
                    </FormField>
                    <FormField
                      label="Meta description"
                      htmlFor={`${uid}-seo-description`}
                      hint={
                        <>
                          Empty: the excerpt is used. Around 155 characters shows in full.{" "}
                          <Counter value={draft.seoDescription} max={LIMITS.seoDescription} />
                        </>
                      }
                    >
                      <Textarea
                        id={`${uid}-seo-description`}
                        value={draft.seoDescription}
                        maxLength={LIMITS.seoDescription}
                        rows={3}
                        placeholder={draft.excerpt}
                        onChange={(event) => set("seoDescription", event.target.value)}
                      />
                    </FormField>
                    <ImageField
                      label="Social image"
                      hint="Empty: one is generated from the title. 1200 × 630."
                      image={og}
                      onPick={() => setPicker("og")}
                      onClear={() => set("ogAssetId", null)}
                    />
                    <FormField
                      label="Canonical URL"
                      htmlFor={`${uid}-canonical`}
                      hint="Only when this post first appeared somewhere else. Empty: this page."
                    >
                      <Input
                        id={`${uid}-canonical`}
                        type="url"
                        value={draft.canonicalUrl}
                        placeholder="https://"
                        onChange={(event) => set("canonicalUrl", event.target.value)}
                      />
                    </FormField>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id={`${uid}-noindex`}
                        checked={draft.noindex}
                        onCheckedChange={(checked) => set("noindex", checked === true)}
                      />
                      <div className="grid gap-0.5">
                        <Label htmlFor={`${uid}-noindex`}>Hide from search engines</Label>
                        <p className="text-xs text-muted-foreground">
                          The page stays reachable by link but asks not to be indexed.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {guide && (
                <TabsContent value="guide">
                  <Card>
                    <CardContent className="space-y-5">
                      <FormField label="Difficulty" htmlFor={`${uid}-difficulty`}>
                        <NativeSelect
                          id={`${uid}-difficulty`}
                          value={draft.difficulty ?? ""}
                          onChange={(event) => set("difficulty", (event.target.value || null) as Difficulty | null)}
                          className="w-full"
                        >
                          <NativeSelectOption value="">Not set</NativeSelectOption>
                          {Object.entries(DIFFICULTIES).map(([value, label]) => (
                            <NativeSelectOption key={value} value={value}>
                              {label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FormField>
                      <FormField
                        label="Time to complete (minutes)"
                        htmlFor={`${uid}-minutes`}
                        hint={`Reading alone takes about ${derived.minutes} min.`}
                      >
                        <Input
                          id={`${uid}-minutes`}
                          type="number"
                          min={1}
                          value={draft.estimatedMinutes ?? ""}
                          className="w-28"
                          onChange={(event) =>
                            set(
                              "estimatedMinutes",
                              event.target.value ? Math.max(1, Number.parseInt(event.target.value, 10) || 1) : null,
                            )
                          }
                        />
                      </FormField>
                      <div className="space-y-2">
                        <Label>Before you start</Label>
                        <ul className="space-y-2">
                          {draft.prerequisites.map((item, index) => (
                            <li key={index} className="flex gap-2">
                              <Input
                                value={item}
                                maxLength={LIMITS.prerequisite}
                                aria-label={`Prerequisite ${index + 1}`}
                                onChange={(event) =>
                                  set(
                                    "prerequisites",
                                    draft.prerequisites.map((p, i) => (i === index ? event.target.value : p)),
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-11 shrink-0 md:size-9"
                                aria-label={`Remove prerequisite ${index + 1}`}
                                onClick={() =>
                                  set(
                                    "prerequisites",
                                    draft.prerequisites.filter((_, i) => i !== index),
                                  )
                                }
                              >
                                <X />
                              </Button>
                            </li>
                          ))}
                        </ul>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-11 md:h-8"
                          disabled={draft.prerequisites.length >= LIMITS.prerequisites}
                          onClick={() => set("prerequisites", [...draft.prerequisites, ""])}
                        >
                          <Plus aria-hidden />
                          Add prerequisite
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="checks">
                <Card>
                  <CardContent className="space-y-4 text-sm">
                    {readiness.length === 0 ? (
                      <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <Check className="size-4" aria-hidden />
                        Ready to publish.
                      </p>
                    ) : (
                      <>
                        {errors.length > 0 && (
                          <div className="space-y-2">
                            <p className="font-medium">Before it can go live</p>
                            <ul className="space-y-1.5">
                              {errors.map((item, index) => (
                                <li key={index} className="flex gap-2">
                                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                                  <span>
                                    {item.section !== undefined && (
                                      <span className="text-muted-foreground">Section {item.section + 1}: </span>
                                    )}
                                    {item.message}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {warnings.length > 0 && (
                          <div className="space-y-2">
                            <p className="font-medium">Worth a look</p>
                            <ul className="space-y-1.5">
                              {warnings.map((item, index) => (
                                <li key={index} className="flex gap-2 text-muted-foreground">
                                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                                  {item.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </aside>
        </div>

        <ImagePickerDialog
          open={picker !== null}
          onOpenChange={(open) => !open && setPicker(null)}
          purpose="content"
          defaultAlt={draft.title}
          onPick={pickImage}
        />
        <FindReplaceDialog
          open={findOpen}
          onOpenChange={setFindOpen}
          fields={plainFields}
          onReplaceFields={replaceInFields}
        />
      </div>
    </EditorWorkspace>
  );
}
