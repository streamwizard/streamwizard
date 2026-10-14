"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
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
  Textarea,
} from "@repo/ui";
import { deleteCategoryAction, saveCategoryAction } from "@/actions/cms-taxonomy";
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

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  postCount: number;
}

type Editing = { mode: "new" } | { mode: "edit"; category: CategoryRow };

function CategoryDialog({
  editing,
  nextPosition,
  onClose,
}: {
  editing: Editing;
  nextPosition: number;
  onClose: (saved: boolean) => void;
}) {
  const uid = useId();
  const initial = editing.mode === "edit" ? editing.category : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [position, setPosition] = useState(String(initial?.position ?? nextPosition));
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const result = await saveCategoryAction(initial?.id ?? null, {
        name,
        slug,
        description,
        position: Number.parseInt(position, 10) || 0,
      });
      if (result.error) return void toast.error(result.error);
      toast.success(initial ? "Category saved." : "Category added.");
      onClose(true);
    });

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose(false)}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{initial ? `Edit ${initial.name}` : "New category"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Shared by blog posts and guides. Each one gets its own page on the site.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-4">
          <FormField label="Name" htmlFor={`${uid}-name`}>
            <Input
              id={`${uid}-name`}
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="OBS setup"
            />
          </FormField>
          <FormField
            label="Slug"
            htmlFor={`${uid}-slug`}
            hint={`streamwizard.org/categories/${slug || slugify(name) || "…"}`}
          >
            <Input
              id={`${uid}-slug`}
              value={slug}
              maxLength={80}
              onChange={(event) => setSlug(event.target.value)}
              placeholder={slugify(name) || "obs-setup"}
            />
          </FormField>
          <FormField label="Description" htmlFor={`${uid}-description`} hint="Shown on the category page. Optional.">
            <Textarea
              id={`${uid}-description`}
              value={description}
              maxLength={300}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <FormField label="Order" htmlFor={`${uid}-position`} hint="Lower numbers come first in menus.">
            <Input
              id={`${uid}-position`}
              type="number"
              min={0}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              className="w-28"
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

function DeleteCategory({ category, onDeleted }: { category: CategoryRow; onDeleted: () => void }) {
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result.error) return void toast.error(result.error);
      toast.success("Category deleted.");
      onDeleted();
    });
  return (
    <ConfirmButton
      title={`Delete ${category.name}?`}
      description={
        category.postCount > 0
          ? `${category.postCount} post${category.postCount === 1 ? "" : "s"} lose this category. The posts stay. You can't undo this.`
          : "No posts use it. You can't undo this."
      }
      onConfirm={remove}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:size-8"
        disabled={pending}
        aria-label={`Delete ${category.name}`}
      >
        <Trash2 />
      </Button>
    </ConfirmButton>
  );
}

export function CategoriesView({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const refresh = () => router.refresh();

  const columns: DataColumn<CategoryRow>[] = [
    {
      key: "name",
      header: "Category",
      mobile: "title",
      cell: (category) => (
        <span className="min-w-0">
          <span className="block truncate font-medium">{category.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">/{category.slug}</span>
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "max-w-80 truncate text-muted-foreground",
      cell: (category) => category.description ?? "–",
    },
    { key: "posts", header: "Posts", className: "tabular-nums", cell: (category) => category.postCount },
    {
      key: "order",
      header: "Order",
      mobile: "hidden",
      className: "tabular-nums text-muted-foreground",
      cell: (category) => category.position,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="The main topics. A post can have several; one is its primary category."
      >
        <Button className="h-11 md:h-9" onClick={() => setEditing({ mode: "new" })}>
          <Plus aria-hidden />
          New category
        </Button>
      </PageHeader>

      {categories.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderTree />
            </EmptyMedia>
            <EmptyTitle>No categories yet</EmptyTitle>
            <EmptyDescription>
              Start with a few broad ones, like OBS setup, Overlays or Growing your stream.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0 sm:px-2">
            <DataList
              rows={categories}
              rowKey={(category) => category.id}
              columns={columns}
              actions={(category) => (
                <span className="inline-flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-8"
                    onClick={() => setEditing({ mode: "edit", category })}
                    aria-label={`Edit ${category.name}`}
                  >
                    <Pencil />
                  </Button>
                  <DeleteCategory category={category} onDeleted={refresh} />
                </span>
              )}
            />
          </CardContent>
        </Card>
      )}

      {editing && (
        <CategoryDialog
          editing={editing}
          nextPosition={categories.length === 0 ? 0 : Math.max(...categories.map((category) => category.position)) + 1}
          onClose={(saved) => {
            setEditing(null);
            if (saved) refresh();
          }}
        />
      )}
    </div>
  );
}
