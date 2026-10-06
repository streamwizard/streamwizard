"use client";

import { useRouter } from "next/navigation";
import { Badge, Card, CardContent } from "@repo/ui";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { ANNOUNCEMENT_STATUS_LABELS, type AnnouncementStatus } from "@/lib/discord/announcements";
import { DeleteAnnouncementButton } from "./announcement-delete";
import { LocalDateTime } from "./local-date-time";

export interface AnnouncementListItem {
  id: string;
  title: string;
  /** "#news", or what stands in for it: none picked, one that is gone. */
  channel: string;
  status: AnnouncementStatus;
  /** What went wrong, for a failed one. */
  error: string | null;
  /** When it goes out, or went out. */
  when: string | null;
  by: string;
}

const VARIANT: Record<AnnouncementStatus, "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  posting: "secondary",
  posted: "secondary",
  changed: "outline",
  failed: "destructive",
};

const COLUMNS: DataColumn<AnnouncementListItem>[] = [
  {
    key: "title",
    header: "Announcement",
    mobile: "title",
    className: "max-w-md min-w-48 whitespace-normal",
    cell: (item) => (
      <>
        {item.title}
        {/* Under the title in both layouts: the reason has to be readable without a hover. */}
        {item.status === "failed" && item.error && (
          <span className="mt-0.5 block text-xs font-normal break-words text-destructive">{item.error}</span>
        )}
      </>
    ),
  },
  { key: "channel", header: "Channel", className: "text-muted-foreground", cell: (item) => item.channel },
  {
    key: "status",
    header: "Status",
    mobile: "badge",
    cell: (item) => <Badge variant={VARIANT[item.status]}>{ANNOUNCEMENT_STATUS_LABELS[item.status]}</Badge>,
  },
  {
    key: "when",
    header: "When",
    className: "whitespace-nowrap text-muted-foreground tabular-nums",
    cell: (item) => (item.when ? <LocalDateTime iso={item.when} /> : "—"),
  },
  { key: "by", header: "By", className: "text-muted-foreground", cell: (item) => item.by },
];

export function AnnouncementList({ announcements }: { announcements: AnnouncementListItem[] }) {
  const router = useRouter();

  return (
    <Card className="py-0 sm:py-2">
      <CardContent className="px-0 sm:px-4">
        <DataList
          rows={announcements}
          rowKey={(item) => item.id}
          rowHref={(item) => `/discord/announcements/${item.id}`}
          columns={COLUMNS}
          actions={(item) => (
            <DeleteAnnouncementButton
              id={item.id}
              title={item.title}
              posted={item.status === "posted" || item.status === "changed"}
              disabled={item.status === "posting"}
              onDeleted={() => router.refresh()}
            />
          )}
        />
      </CardContent>
    </Card>
  );
}
