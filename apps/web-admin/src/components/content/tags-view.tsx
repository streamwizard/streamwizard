"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitMerge, Pencil, Plus, Search, SearchX, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@repo/cms";
import {
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui";
import { deleteTagAction, mergeTagsAction, saveTagAction } from "@/actions/cms-taxonomy";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { ConfirmButton } from "./confirm-button";
import { FormField } from "./form-field";

export interface TagRow {
  id: string;
  slug: string;
  name: string;
  postCount: number;
}

type Dialog = { kind: "new" } | { kind: "edit"; tag: TagRow } | { kind: "merge"; tag: TagRow };

function TagDialog({ tag, onClose }: { tag: TagRow | null; onClose: (saved: boolean) => void }) {
  const uid = useId();
  const [name, setName] = useState(tag?.name ?? "");
  const [slug, setSlug] = useState(tag?.slug ?? "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const result = await saveTagAction(tag?.id ?? null, { name, slug });
      if (result.error) return void toast.error(result.error);
      toast.success(tag ? "Tag saved." : "Tag added.");
      onClose(true);
    });

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose(false)}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tag ? `Edit ${tag.name}` : "New tag"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Tags are the small details: a widget, a platform, a feature.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-4">
          <FormField label="Name" htmlFor={`${uid}-name`}>
            <Input
              id={`${uid}-name`}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alert box"
            />
          </FormField>
          <FormField
            label="Slug"
            htmlFor={`${uid}-slug`}
            hint={`streamwizard.org/tags/${slug || slugify(name) || "…"}`}
          >
            <Input
              id={`${uid}-slug`}
              value={slug}
              maxLength={80}
              onChange={(event) => setSlug(event.target.value)}
              placeholder={slugify(name) || "alert-box"}
            />
          </FormField>
        </div>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function MergeDialog({ tag, tags, onClose }: { tag: TagRow; tags: TagRow[]; onClose: (merged: boolean) => void }) {
  const uid = useId();
  const others = tags.filter((other) => other.id !== tag.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [pending, start] = useTransition();

  const merge = () =>
    start(async () => {
      const result = await mergeTagsAction(tag.id, target);
      if (result.error) return void toast.error(result.error);
      toast.success("Tags merged.");
      onClose(true);
    });

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose(false)}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Merge {tag.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Its {tag.postCount} post{tag.postCount === 1 ? "" : "s"} get the tag you pick, then {tag.name} is deleted.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <FormField label="Merge into" htmlFor={`${uid}-target`}>
          <NativeSelect
            id={`${uid}-target`}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="w-full"
          >
            {others.map((other) => (
              <NativeSelectOption key={other.id} value={other.id}>
                {other.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={merge} disabled={pending || !target}>
            {pending ? "Merging…" : "Merge"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function DeleteTag({ tag, onDeleted }: { tag: TagRow; onDeleted: () => void }) {
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      const result = await deleteTagAction(tag.id);
      if (result.error) return void toast.error(result.error);
      toast.success("Tag deleted.");
      onDeleted();
    });
  return (
    <ConfirmButton
      title={`Delete ${tag.name}?`}
      description={
        tag.postCount > 0
          ? `${tag.postCount} post${tag.postCount === 1 ? "" : "s"} lose this tag. Merge it instead to keep them tagged. You can't undo this.`
          : "No posts use it. You can't undo this."
      }
      onConfirm={remove}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:size-8"
        disabled={pending}
        aria-label={`Delete ${tag.name}`}
      >
        <Trash2 />
      </Button>
    </ConfirmButton>
  );
}

export function TagsView({ tags, search }: { tags: TagRow[]; search?: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const refresh = () => router.refresh();
  const close = (changed: boolean) => {
    setDialog(null);
    if (changed) refresh();
  };

  const columns: DataColumn<TagRow>[] = [
    {
      key: "name",
      header: "Tag",
      mobile: "title",
      cell: (tag) => (
        <span className="min-w-0">
          <span className="block truncate font-medium">{tag.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">/{tag.slug}</span>
        </span>
      ),
    },
    { key: "posts", header: "Posts", className: "tabular-nums", cell: (tag) => tag.postCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tags" description="Small details posts share. Merge duplicates instead of deleting them.">
        <Button className="h-11 md:h-9" onClick={() => setDialog({ kind: "new" })}>
          <Plus aria-hidden />
          New tag
        </Button>
      </PageHeader>

      <TicketFiltersForm action="/content/tags" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="Name or slug"
          aria-label="Search tags"
          className="h-11 basis-full md:h-9 lg:basis-64 lg:flex-1"
        />
        <Button type="submit" variant="secondary" className="h-11 md:h-9">
          <Search aria-hidden />
          Search
        </Button>
        {search && (
          <Button variant="ghost" className="h-11 md:h-9" asChild>
            <Link href="/content/tags">Clear</Link>
          </Button>
        )}
      </TicketFiltersForm>

      {tags.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{search ? <SearchX /> : <Tags />}</EmptyMedia>
            <EmptyTitle>{search ? "No tags match" : "No tags yet"}</EmptyTitle>
            <EmptyDescription>
              {search ? "Try a shorter search." : "Add tags here, or straight from the post editor."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0 sm:px-2">
            <DataList
              rows={tags}
              rowKey={(tag) => tag.id}
              columns={columns}
              actions={(tag) => (
                <span className="inline-flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-8"
                    onClick={() => setDialog({ kind: "edit", tag })}
                    aria-label={`Edit ${tag.name}`}
                  >
                    <Pencil />
                  </Button>
                  {tags.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 md:size-8"
                      onClick={() => setDialog({ kind: "merge", tag })}
                      aria-label={`Merge ${tag.name}`}
                    >
                      <GitMerge />
                    </Button>
                  )}
                  <DeleteTag tag={tag} onDeleted={refresh} />
                </span>
              )}
            />
          </CardContent>
        </Card>
      )}

      {dialog?.kind === "new" && <TagDialog tag={null} onClose={close} />}
      {dialog?.kind === "edit" && <TagDialog tag={dialog.tag} onClose={close} />}
      {dialog?.kind === "merge" && <MergeDialog tag={dialog.tag} tags={tags} onClose={close} />}
    </div>
  );
}
