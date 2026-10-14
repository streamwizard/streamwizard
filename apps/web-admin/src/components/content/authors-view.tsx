"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, UserPen } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
} from "@repo/ui";
import { createAuthorAction } from "@/actions/cms-authors";
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
import { FormField } from "./form-field";

export interface AuthorRow {
  id: string;
  slug: string;
  name: string;
  roleTitle: string | null;
  avatarUrl: string | null;
  linked: boolean;
  deleted: boolean;
  postCount: number;
}

const COLUMNS: DataColumn<AuthorRow>[] = [
  {
    key: "author",
    header: "Author",
    mobile: "title",
    cell: (author) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar className="size-8">
          {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
          <AvatarFallback className="text-xs">{author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate">{author.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {author.roleTitle ?? `/${author.slug}`}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    mobile: "badge",
    cell: (author) =>
      author.deleted ? (
        <Badge variant="outline" className="text-xs">
          Deleted
        </Badge>
      ) : author.linked ? (
        <Badge variant="secondary" className="text-xs">
          Linked account
        </Badge>
      ) : (
        <span className="text-muted-foreground/60 @max-2xl:hidden">–</span>
      ),
  },
  { key: "posts", header: "Posts", className: "tabular-nums", cell: (author) => author.postCount },
];

function NewAuthorDialog({ onClose }: { onClose: () => void }) {
  const uid = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const result = await createAuthorAction(name);
      if (result.error || !result.id) return void toast.error(result.error ?? "Couldn't create the author.");
      router.push(`/content/authors/${result.id}`);
    });

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>New author</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Add the bio, avatar and links on the next page.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <FormField label="Name" htmlFor={`${uid}-name`}>
            <Input
              id={`${uid}-name`}
              value={name}
              maxLength={80}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
        </form>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={create} disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function AuthorsView({ authors, showDeleted }: { authors: AuthorRow[]; showDeleted: boolean }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Authors" description="Who wrote a post. Each author gets a public page listing their posts.">
        <Button variant="ghost" className="h-11 md:h-9" asChild>
          <Link href={showDeleted ? "/content/authors" : "/content/authors?deleted=1"}>
            {showDeleted ? "Hide deleted" : "Show deleted"}
          </Link>
        </Button>
        <Button className="h-11 md:h-9" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          New author
        </Button>
      </PageHeader>

      {authors.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserPen />
            </EmptyMedia>
            <EmptyTitle>No authors yet</EmptyTitle>
            <EmptyDescription>Every post needs at least one. Start with yourself.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0 sm:px-2">
            <DataList
              rows={authors}
              rowKey={(author) => author.id}
              rowHref={(author) => `/content/authors/${author.id}`}
              rowClassName={(author) => (author.deleted ? "opacity-60" : undefined)}
              columns={COLUMNS}
            />
          </CardContent>
        </Card>
      )}

      {creating && <NewAuthorDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
