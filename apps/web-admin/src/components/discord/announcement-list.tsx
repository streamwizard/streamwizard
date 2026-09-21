"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
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

export function AnnouncementList({ announcements }: { announcements: AnnouncementListItem[] }) {
  const router = useRouter();

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Announcement</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link href={`/discord/announcements/${item.id}`} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.channel}</TableCell>
                <TableCell>
                  <Badge variant={VARIANT[item.status]} title={item.error ?? undefined}>
                    {ANNOUNCEMENT_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {item.when ? <LocalDateTime iso={item.when} /> : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.by}</TableCell>
                <TableCell>
                  <DeleteAnnouncementButton
                    id={item.id}
                    title={item.title}
                    posted={item.status === "posted" || item.status === "changed"}
                    disabled={item.status === "posting"}
                    onDeleted={() => router.refresh()}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
