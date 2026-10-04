"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ANNOUNCEMENT_COLORS, DISCORD_LIMITS, validateAnnouncement, type Announcement } from "@repo/discord-message";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  cn,
} from "@repo/ui";
import { ColorDot, toHex } from "@repo/ui/message-builder";
import {
  postAnnouncementNowAction,
  saveAnnouncementDraftAction,
  scheduleAnnouncementAction,
  unscheduleAnnouncementAction,
} from "@/actions/discord-announcement";
import { PageHeader } from "@/components/widgets/page-header";
import { useAutosave, type AutosaveStatus } from "@/hooks/use-autosave";
import {
  ANNOUNCEMENT_STATUS_LABELS,
  ANNOUNCEMENT_VALIDATE_OPTIONS,
  MENTION_OPTIONS,
  SCHEDULE_GRACE_MS,
  announcementStatus,
  fromLocalInputValue,
  toLocalInputValue,
} from "@/lib/discord/announcements";
import { uploadBanner } from "@/lib/discord/banner-upload-client";
import type { PickerOption } from "@/lib/discord/options";
import { DeleteAnnouncementButton } from "./announcement-delete";
import { AnnouncementPreview } from "./announcement-preview";
import { LocalDateTime } from "./local-date-time";
import { Picker } from "./pickers";

interface AnnouncementEditorProps {
  id: string;
  initial: { announcement: Announcement; channelId: string | null };
  /** What the bot knows: where it stands, what is in Discord. */
  state: {
    status: string;
    posted: Announcement | null;
    /** The channel the Discord message is in, when there is one. */
    postedChannelId: string | null;
    scheduledFor: string | null;
    postedAt: string | null;
    lastError: string | null;
  };
  channels: PickerOption[];
  roles: PickerOption[];
  bot: { name: string; avatarUrl: string | null };
  uploadsEnabled: boolean;
  previewImageHosts: string[];
}

const REFRESH_MS = 20_000;

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

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * One announcement. With room (a content column of 896px or more) the form and
 * what Discord shows sit side by side; below that they are two tabs. A
 * container query decides, not the viewport: the sidebar takes 256px of it. Post and Schedule live in a bar that
 * stays in view, so they are one tap away from anywhere in the form.
 */
export function AnnouncementEditor({ id, initial, state, channels, roles, bot, uploadsEnabled, previewImageHosts }: AnnouncementEditorProps) {
  const router = useRouter();
  const uid = useId();
  const [draft, setDraft] = useState(initial);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [postLater, setPostLater] = useState(state.status === "scheduled");
  const [when, setWhen] = useState(state.scheduledFor ? toLocalInputValue(state.scheduledFor) : "");
  const [confirm, setConfirm] = useState<null | "post" | "schedule">(null);
  const [uploading, setUploading] = useState(false);
  const [working, startWork] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  // The picker's floor, from when the page opened. The action checks the real clock.
  const [minWhen] = useState(() => toLocalInputValue(new Date()));

  const { announcement, channelId } = draft;
  const set = (patch: Partial<Announcement>) => setDraft((prev) => ({ ...prev, announcement: { ...prev.announcement, ...patch } }));

  const posting = state.status === "posting";
  const inDiscord = state.postedChannelId !== null;
  const status = announcementStatus({ status: state.status, draft: announcement, posted: state.posted });
  const busy = working || uploading || posting;

  // Set while a delete runs, so a late autosave doesn't complain the announcement is gone.
  const deleting = useRef(false);
  const { status: saveStatus, flush } = useAutosave(draft, async (value) => {
    if (deleting.current || posting) return true;
    const result = await saveAnnouncementDraftAction(id, value);
    if (result.error) toast.error(result.error);
    return !result.error;
  });

  // The bot moves a scheduled one along on its own clock: keep the page in step.
  useEffect(() => {
    if (state.status !== "scheduled" && state.status !== "posting") return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [state.status, router]);

  const issues = useMemo(() => validateAnnouncement(announcement, ANNOUNCEMENT_VALIDATE_OPTIONS), [announcement]);
  const channelLabel = channels.find((c) => c.value === channelId)?.label ?? "the channel";
  const scheduleIso = postLater ? fromLocalInputValue(when) : null;
  const pingsEveryone = announcement.mention.kind === "everyone" || announcement.mention.kind === "here";
  const colorName = ANNOUNCEMENT_COLORS.find((swatch) => swatch.value === announcement.color)?.name ?? `Custom (${toHex(announcement.color)})`;

  const blocked = issues.length > 0 ? issues[0]!.message : !channelId ? "Pick a channel first." : null;
  const scheduleBlocked = blocked ?? (!scheduleIso ? "Pick a date and time first." : null);
  // The bar's main button is Schedule only for a new one with "Post later" on.
  const scheduling = postLater && state.status !== "scheduled" && !inDiscord;
  const reason = scheduling ? scheduleBlocked : blocked;

  const postNow = () =>
    startWork(async () => {
      if (!(await flush())) return;
      const result = await postAnnouncementNowAction(id);
      if (result.error) return void toast.error(result.error);
      toast.success(
        result.resent
          ? "Posted again. The old message was gone, so this one pinged like a new post."
          : inDiscord
            ? "Updated in Discord."
            : "Posted. Go check Discord.",
      );
      router.refresh();
    });

  const schedule = () =>
    startWork(async () => {
      if (!scheduleIso) return;
      // Checked here and not during render: the clock moves while the page is open.
      if (new Date(scheduleIso).getTime() < Date.now() - SCHEDULE_GRACE_MS) return void toast.error("That time has passed. Pick a later one.");
      if (!(await flush())) return;
      const result = await scheduleAnnouncementAction(id, scheduleIso);
      if (result.error) return void toast.error(result.error);
      toast.success("Scheduled. The bot posts it when the time comes.");
      router.refresh();
    });

  const unschedule = () =>
    startWork(async () => {
      const result = await unscheduleAnnouncementAction(id);
      if (result.error) return void toast.error(result.error);
      toast.success("Unscheduled. It's saved as a draft.");
      setPostLater(false);
      router.refresh();
    });

  /** @everyone and @here get a second look before they go out. */
  const withConfirm = (action: "post" | "schedule") => (pingsEveryone ? setConfirm(action) : action === "post" ? postNow() : schedule());

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set({ imageUrl: await uploadBanner(file) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload that image. Try again?");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const title = announcement.title.trim() || "Untitled announcement";

  return (
    <div className="@container space-y-6">
      {/* No back link: the header's breadcrumb and back arrow do that, and autosave flushes when the page is left. */}
      <PageHeader title={title} description="Write it, check the preview, post it now or set a time.">
        <SaveStatus status={saveStatus} />
        {status !== "draft" && (
          <Badge variant={status === "failed" ? "destructive" : status === "changed" ? "outline" : "secondary"}>
            {ANNOUNCEMENT_STATUS_LABELS[status]}
          </Badge>
        )}
        <DeleteAnnouncementButton
          id={id}
          title={title}
          posted={inDiscord}
          disabled={busy}
          onDeleting={(running) => {
            deleting.current = running;
          }}
          onDeleted={() => router.push("/discord/announcements")}
        />
      </PageHeader>

      {state.status === "failed" && state.lastError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>It didn&apos;t go out</AlertTitle>
          <AlertDescription>{state.lastError}</AlertDescription>
        </Alert>
      )}
      {state.status === "scheduled" && state.scheduledFor && (
        <p className="text-sm text-muted-foreground">
          Goes out <LocalDateTime iso={state.scheduledFor} className="font-medium text-foreground" /> ({timeZone}). Edits made before then go out with it.
        </p>
      )}
      {inDiscord && (
        <p className="text-sm text-muted-foreground">
          {state.postedAt && (
            <>
              Posted <LocalDateTime iso={state.postedAt} className="font-medium text-foreground" />.{" "}
            </>
          )}
          Updating edits the message in place. Nobody is pinged again.
        </p>
      )}

      <Tabs value={view} onValueChange={(value) => setView(value === "preview" ? "preview" : "edit")} className="gap-4">
        <TabsList className="grid w-full grid-cols-2 group-data-[orientation=horizontal]/tabs:h-11 @4xl:hidden">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Both panels stay mounted: the tabs only pick which one shows while they are stacked. */}
        <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] @4xl:items-start @6xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <TabsContent value="edit" forceMount className="min-w-0 space-y-6 @max-4xl:data-[state=inactive]:hidden">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Announcement</CardTitle>
                <CardDescription>Changes save as a draft. Nothing reaches Discord until you post it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Title" htmlFor={`${uid}-title`}>
                  <Input
                    id={`${uid}-title`}
                    value={announcement.title}
                    maxLength={DISCORD_LIMITS.embedTitle}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="StreamWizard 2.0 is out"
                    className="h-11 md:h-9"
                    disabled={busy}
                  />
                </Field>

                <Field
                  label="Text"
                  htmlFor={`${uid}-body`}
                  hint={
                    <>
                      Discord formatting works: **bold**, *italic*, `code`, [text](https://…) links. [server.name] and [server.member_count] are filled in.
                    </>
                  }
                >
                  <Textarea
                    id={`${uid}-body`}
                    value={announcement.body}
                    maxLength={DISCORD_LIMITS.embedDescription}
                    onChange={(e) => set({ body: e.target.value })}
                    placeholder="What's new, when it happens, what to do."
                    className="min-h-40"
                    disabled={busy}
                  />
                </Field>

                {/* The picked colour is named in text: a swatch alone says nothing to a screen reader or on a phone. */}
                <Field label="Colour" hint={`Picked: ${colorName}`}>
                  <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 md:gap-2">
                    {ANNOUNCEMENT_COLORS.map((swatch) => (
                      <button
                        key={swatch.value}
                        type="button"
                        title={swatch.name}
                        aria-label={swatch.name}
                        aria-pressed={swatch.value === announcement.color}
                        disabled={busy}
                        onClick={() => set({ color: swatch.value })}
                        // The button is the 44px tap target on a phone; the dot inside keeps its size.
                        className="group grid size-11 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40 md:size-8"
                      >
                        <span
                          className={cn(
                            "size-8 rounded-full border-2 transition-transform group-hover:scale-110 md:size-7",
                            swatch.value === announcement.color ? "border-foreground" : "border-transparent",
                          )}
                          style={{ backgroundColor: toHex(swatch.value) }}
                        />
                      </button>
                    ))}
                    <span className="mx-1 hidden h-5 w-px bg-border md:block" aria-hidden />
                    <span className="flex items-center gap-2 max-md:[&>button]:size-10">
                      <ColorDot color={announcement.color} onChange={(color) => set({ color })} disabled={busy} />
                      <span className="text-xs text-muted-foreground">Any colour</span>
                    </span>
                  </div>
                </Field>

                <Field
                  label="Image"
                  htmlFor={`${uid}-image`}
                  hint={uploadsEnabled ? "Upload a png, jpg or gif up to 10 MB, or paste a link to one." : "Paste a link to a png, jpg or gif. Discord loads it."}
                >
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id={`${uid}-image`}
                      type="url"
                      value={announcement.imageUrl ?? ""}
                      onChange={(e) => set({ imageUrl: e.target.value.trim() || null })}
                      placeholder="https://"
                      className="h-11 w-full sm:w-auto sm:min-w-56 sm:flex-1 md:h-9"
                      disabled={busy}
                    />
                    {uploadsEnabled && (
                      <>
                        <input
                          ref={fileInput}
                          type="file"
                          accept="image/png,image/jpeg,image/gif"
                          className="sr-only"
                          onChange={(e) => void pickImage(e.target.files?.[0])}
                          tabIndex={-1}
                        />
                        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => fileInput.current?.click()} disabled={busy}>
                          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                          {uploading ? "Uploading…" : "Upload"}
                        </Button>
                      </>
                    )}
                    {announcement.imageUrl && (
                      <Button type="button" variant="ghost" className="h-11 md:h-9" onClick={() => set({ imageUrl: null })} disabled={busy}>
                        <X />
                        Remove image
                      </Button>
                    )}
                  </div>
                </Field>

                <Field label="Button" hint="One link button under the message, for a changelog, a sign-up, a stream.">
                  {announcement.button ? (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={announcement.button.label}
                        maxLength={DISCORD_LIMITS.buttonLabel}
                        onChange={(e) => set({ button: { ...announcement.button!, label: e.target.value } })}
                        placeholder="Read more"
                        aria-label="Button label"
                        className="h-11 w-full sm:w-44 md:h-9"
                        disabled={busy}
                      />
                      <Input
                        type="url"
                        value={announcement.button.url}
                        maxLength={DISCORD_LIMITS.buttonUrl}
                        onChange={(e) => set({ button: { ...announcement.button!, url: e.target.value.trim() } })}
                        placeholder="https://"
                        aria-label="Button link"
                        className="h-11 w-full sm:w-auto sm:min-w-56 sm:flex-1 md:h-9"
                        disabled={busy}
                      />
                      <Button type="button" variant="ghost" className="h-11 md:h-9" onClick={() => set({ button: null })} disabled={busy}>
                        <X />
                        Remove button
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Button type="button" variant="outline" size="sm" className="h-11 md:h-8" onClick={() => set({ button: { label: "", url: "" } })} disabled={busy}>
                        Add a button
                      </Button>
                    </div>
                  )}
                </Field>

                {issues.length > 0 && (
                  <ul className="space-y-0.5 text-sm text-destructive" aria-live="polite">
                    {issues.map((issue, i) => (
                      <li key={i}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where and when</CardTitle>
                <CardDescription>The channel it lands in, who gets a ping, and when it goes out.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Channel"
                    htmlFor={`${uid}-channel`}
                    hint={inDiscord ? "It's in this channel now. Delete it and write a new one to post somewhere else." : undefined}
                  >
                    <Picker
                      id={`${uid}-channel`}
                      options={channels}
                      value={channelId}
                      onChange={(value) => setDraft((prev) => ({ ...prev, channelId: value }))}
                      placeholder="Pick a channel"
                      emptyText="No channels match"
                      disabled={busy || inDiscord}
                    />
                  </Field>
                  <Field label="Ping" htmlFor={`${uid}-ping`} hint={inDiscord ? "An update never pings again." : undefined}>
                    {/* The select's wrapper is w-fit by default: full width here, so the two controls stack cleanly on a phone. */}
                    <div className="flex flex-col gap-2 [&_[data-slot=native-select-wrapper]]:w-full">
                      <NativeSelect
                        id={`${uid}-ping`}
                        value={announcement.mention.kind}
                        disabled={busy}
                        className="h-11 text-base md:h-9 md:text-sm"
                        onChange={(e) => {
                          const kind = e.target.value as (typeof MENTION_OPTIONS)[number]["value"];
                          set({ mention: kind === "role" ? { kind, roleId: roles[0]?.value ?? "" } : { kind } });
                        }}
                      >
                        {MENTION_OPTIONS.map((option) => (
                          <NativeSelectOption key={option.value} value={option.value}>
                            {option.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      {announcement.mention.kind === "role" && (
                        <Picker
                          options={roles}
                          value={announcement.mention.roleId || null}
                          onChange={(value) => set({ mention: { kind: "role", roleId: value ?? "" } })}
                          placeholder="Pick a role"
                          emptyText="No roles match"
                          disabled={busy}
                        />
                      )}
                    </div>
                  </Field>
                </div>

                {!inDiscord && (
                  <div className="space-y-3 border-t pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label htmlFor={`${uid}-later`}>Post later</Label>
                        <p className="text-xs text-muted-foreground">The bot posts it at the time you pick. You can still edit it until then.</p>
                      </div>
                      <Switch
                        id={`${uid}-later`}
                        checked={postLater}
                        onCheckedChange={setPostLater}
                        disabled={busy || state.status === "scheduled"}
                      />
                    </div>
                    {postLater && (
                      <Field label="When" htmlFor={`${uid}-when`} hint={`Times are in your zone, ${timeZone}.`}>
                        <Input
                          id={`${uid}-when`}
                          type="datetime-local"
                          value={when}
                          min={minWhen}
                          onChange={(e) => setWhen(e.target.value)}
                          className="h-11 w-full sm:w-fit md:h-9"
                          disabled={busy || state.status === "scheduled"}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" forceMount className="min-w-0 space-y-2 @max-4xl:data-[state=inactive]:hidden @4xl:sticky @4xl:top-20">
            <p className="text-xs text-muted-foreground">How it looks in Discord</p>
            <AnnouncementPreview announcement={announcement} roles={roles} bot={bot} imageHosts={previewImageHosts} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Stays in view while the form scrolls, above the phone's bottom bar. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-4">
        {/* Why the button is off, as text: a tooltip is no use on a phone. */}
        <p className={cn("min-w-0 text-sm", reason ? "text-foreground" : "text-muted-foreground")} role="status" aria-live="polite">
          {reason ??
            (posting
              ? "The bot is posting it now."
              : state.status === "scheduled"
                ? "Scheduled. Post now sends it without the wait."
                : scheduling
                  ? "Goes out at the time you picked."
                  : inDiscord
                    ? "Update changes the message that is already in Discord."
                    : `Goes to ${channelLabel} right away.`)}
        </p>
        <div className="flex shrink-0 gap-2">
          {state.status === "scheduled" && (
            <Button variant="outline" className="h-11 flex-1 sm:flex-none md:h-9" onClick={unschedule} disabled={busy}>
              Unschedule
            </Button>
          )}
          {scheduling ? (
            <Button className="h-11 flex-1 sm:flex-none md:h-9" onClick={() => withConfirm("schedule")} disabled={busy || scheduleBlocked !== null}>
              {working ? "Scheduling…" : "Schedule"}
            </Button>
          ) : (
            <Button className="h-11 flex-1 sm:flex-none md:h-9" onClick={() => withConfirm("post")} disabled={busy || blocked !== null}>
              {posting ? "Posting…" : working ? "Posting…" : inDiscord ? "Update in Discord" : state.status === "failed" ? "Try again" : "Post now"}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ping {announcement.mention.kind === "here" ? "everyone online" : "everyone"} in {channelLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {announcement.mention.kind === "here"
                ? `Every member who is online ${confirm === "schedule" ? "at that time" : "right now"} gets a notification.`
                : `Every member of the server gets a notification${confirm === "schedule" ? " when it goes out" : ""}.`}{" "}
              Sure about that?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirm;
                setConfirm(null);
                if (action === "post") postNow();
                else if (action === "schedule") schedule();
              }}
            >
              {confirm === "schedule" ? "Schedule it" : "Post it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
