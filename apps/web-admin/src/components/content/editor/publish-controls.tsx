"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ChevronDown, CircleAlert, ExternalLink, FileText, Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
} from "@repo/ui";
import { publishContentAction, unarchiveContentAction, unpublishContentAction } from "@/actions/cms-publish";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import type { ReadinessItem } from "@/lib/cms/readiness";
import type { ContentStatus } from "./content-editor";

interface PublishControlsProps {
  contentId: string;
  status: ContentStatus;
  /** "/blog/slug" as it will be once published, for the confirm dialog. */
  path: string;
  /** The live page, when the post is on the site and the site URL is known. */
  liveUrl: string | null;
  readiness: ReadinessItem[];
  /** Saves pending edits first. Resolves to false when that failed. */
  flush: () => Promise<boolean>;
  /** The lock version after the last save. */
  lockVersion: () => number;
  disabled: boolean;
}

/**
 * Publish, Update, Unpublish, Archive. Publishing always saves first and
 * then puts the saved draft live, so what the admin sees is what goes out.
 */
export function PublishControls(props: PublishControlsProps) {
  const { contentId, status, path, liveUrl, readiness, flush, lockVersion, disabled } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minorEdit, setMinorEdit] = useState(false);
  const [takeDown, setTakeDown] = useState<"draft" | "archived" | null>(null);
  const [pending, start] = useTransition();
  const live = status === "published";
  const errors = readiness.filter((item) => item.severity === "error");
  const warnings = readiness.filter((item) => item.severity === "warning");

  const done = (message: string) => {
    toast.success(message);
    setOpen(false);
    router.refresh();
  };

  const publish = () =>
    start(async () => {
      if (!(await flush())) return void toast.error("Couldn't save your last changes, so nothing was published.");
      const result = await publishContentAction(contentId, lockVersion(), live && minorEdit);
      if (result.error) return void toast.error(result.error);
      done(live ? "Updated on the site." : "Published. It's live.");
    });

  const unpublish = (to: "draft" | "archived") =>
    start(async () => {
      if (!(await flush())) return void toast.error("Couldn't save your last changes. Try again?");
      const result = await unpublishContentAction(contentId, lockVersion(), to);
      if (result.error) return void toast.error(result.error);
      setTakeDown(null);
      done(to === "draft" ? "Taken off the site. It's a draft again." : "Archived and taken off the site.");
    });

  const unarchive = () =>
    start(async () => {
      if (!(await flush())) return void toast.error("Couldn't save your last changes. Try again?");
      const result = await unarchiveContentAction(contentId, lockVersion());
      if (result.error) return void toast.error(result.error);
      done("Back in drafts.");
    });

  const busy = pending || disabled;

  return (
    <>
      {liveUrl && (
        <Button variant="ghost" className="h-11 md:h-9" asChild>
          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            View on site
          </a>
        </Button>
      )}

      <div className="flex">
        <Button
          className={live || status === "archived" ? "h-11 rounded-r-none md:h-9" : "h-11 md:h-9"}
          onClick={() => setOpen(true)}
          disabled={busy}
        >
          <Rocket aria-hidden />
          {live ? "Update" : status === "archived" ? "Publish again" : "Publish"}
        </Button>
        {(live || status === "archived") && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-11 rounded-l-none border-l border-primary-foreground/20 px-2 md:h-9"
                disabled={busy}
                aria-label="More publishing options"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {live ? (
                <>
                  <DropdownMenuItem onSelect={() => setTakeDown("draft")}>
                    <FileText aria-hidden />
                    Unpublish (back to draft)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTakeDown("archived")}>
                    <Archive aria-hidden />
                    Archive
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onSelect={unarchive}>
                  <Undo2 aria-hidden />
                  Back to drafts
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {errors.length > 0 ? "Not ready yet" : live ? "Update the live page?" : "Publish it?"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {errors.length > 0
                ? "Fix these first. They're also on the Checks tab."
                : live
                  ? `The saved draft replaces what's on ${path} now.`
                  : `It goes live at ${path} right away.`}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {errors.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
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
          ) : (
            <div className="space-y-4 text-sm">
              {warnings.length > 0 && (
                <p className="text-muted-foreground">
                  {warnings.length === 1 ? "1 thing is" : `${warnings.length} things are`} still worth a look on the
                  Checks tab. They don&apos;t block publishing.
                </p>
              )}
              {live && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`${contentId}-minor`}
                    checked={minorEdit}
                    onCheckedChange={(value) => setMinorEdit(value === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`${contentId}-minor`} className="grid gap-1 font-normal leading-snug">
                    <span>Small fix</span>
                    <span className="text-muted-foreground">
                      Typos and the like. Keeps the &quot;Updated&quot; date readers see.
                    </span>
                  </Label>
                </div>
              )}
            </div>
          )}

          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {errors.length > 0 ? "Close" : "Cancel"}
            </Button>
            {errors.length === 0 && (
              <Button onClick={publish} disabled={pending}>
                {live ? "Update" : "Publish"}
              </Button>
            )}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={takeDown !== null} onOpenChange={(value) => !value && setTakeDown(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {takeDown === "archived" ? "Archive it?" : "Take it off the site?"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {path} stops working right away and drops out of the lists and the sitemap.
              {takeDown === "archived"
                ? " It stays in the archive until you publish it again."
                : " It becomes a draft you can keep editing."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => setTakeDown(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => takeDown && unpublish(takeDown)} disabled={pending}>
              {takeDown === "archived" ? "Archive" : "Unpublish"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
