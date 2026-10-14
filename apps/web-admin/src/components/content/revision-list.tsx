"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui";
import { restoreRevisionAction } from "@/actions/cms-content";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { PageCrumb } from "@/lib/crumbs";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { ConfirmButton } from "./confirm-button";

export interface RevisionRow {
  id: string;
  kind: "autosave" | "manual" | "publish" | "restore";
  createdAt: string;
  title: string;
  words: number;
}

const KIND_LABELS: Record<RevisionRow["kind"], string> = {
  autosave: "Autosave",
  manual: "Saved version",
  publish: "Published",
  restore: "Before a restore",
};

function RestoreButton({
  contentId,
  lockVersion,
  revision,
}: {
  contentId: string;
  lockVersion: number;
  revision: RevisionRow;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const restore = () =>
    start(async () => {
      const result = await restoreRevisionAction(contentId, lockVersion, revision.id);
      if (result.error) return void toast.error(result.error);
      toast.success("Restored into the draft. Nothing changed on the site.");
      router.push(`/content/${contentId}`);
      router.refresh();
    });
  return (
    <ConfirmButton
      title="Restore this version?"
      description="It replaces the current draft. The current draft is kept as a revision, so you can go back. The live site doesn't change until you publish."
      confirmLabel="Restore"
      cancelLabel="Cancel"
      onConfirm={restore}
    >
      <Button variant="ghost" size="sm" className="h-11 md:h-8" disabled={pending}>
        <RotateCcw aria-hidden />
        Restore
      </Button>
    </ConfirmButton>
  );
}

export function RevisionList({
  contentId,
  title,
  lockVersion,
  revisions,
}: {
  contentId: string;
  title: string;
  lockVersion: number;
  revisions: RevisionRow[];
}) {
  const columns: DataColumn<RevisionRow>[] = [
    {
      key: "when",
      header: "When",
      mobile: "title",
      cell: (revision) => (
        <time dateTime={revision.createdAt} title={formatDateTime(revision.createdAt)}>
          {formatRelativeTime(revision.createdAt)}
        </time>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      mobile: "badge",
      cell: (revision) => (
        <Badge variant={revision.kind === "publish" ? "default" : "outline"} className="text-xs">
          {KIND_LABELS[revision.kind]}
        </Badge>
      ),
    },
    {
      key: "title",
      header: "Title then",
      className: "max-w-80 truncate",
      cell: (revision) => revision.title || "Untitled",
    },
    {
      key: "words",
      header: "Words",
      className: "tabular-nums text-muted-foreground",
      cell: (revision) => revision.words,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageCrumb label={title} href={`/content/${contentId}`} />
      <PageCrumb label="Revisions" href={`/content/${contentId}/revisions`} />
      <PageHeader
        title="Revisions"
        description={`${title}. Autosaves keep one copy per 10 minutes; saved versions and publishes are all kept.`}
      />
      {revisions.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>No revisions yet</EmptyTitle>
            <EmptyDescription>They appear once you start editing.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0 sm:px-2">
            <DataList
              rows={revisions}
              rowKey={(revision) => revision.id}
              columns={columns}
              actions={(revision) => (
                <RestoreButton contentId={contentId} lockVersion={lockVersion} revision={revision} />
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
