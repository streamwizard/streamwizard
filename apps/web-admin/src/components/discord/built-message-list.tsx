"use client";

import { useRouter } from "next/navigation";
import { Badge, Card, CardContent } from "@repo/ui";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import type { BuiltMessageStatus } from "@/lib/discord/built-messages";
import { DeleteBuiltMessageButton } from "./built-message-delete";

export interface BuiltMessageListItem {
  id: string;
  name: string;
  /** "#rules", or what stands in for it: a channel still to be created, none picked, one that is gone. */
  channel: string;
  status: BuiltMessageStatus;
  /** Already formatted on the server, so both renders agree. */
  publishedAt: string | null;
}

const STATUS: Record<BuiltMessageStatus, { label: string; variant: "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  live: { label: "Live", variant: "secondary" },
  changed: { label: "Unpublished changes", variant: "outline" },
};

const COLUMNS: DataColumn<BuiltMessageListItem>[] = [
  { key: "name", header: "Message", mobile: "title", className: "max-w-md min-w-40 whitespace-normal", cell: (message) => message.name },
  { key: "channel", header: "Channel", className: "text-muted-foreground", cell: (message) => message.channel },
  {
    key: "status",
    header: "Status",
    mobile: "badge",
    cell: (message) => <Badge variant={STATUS[message.status].variant}>{STATUS[message.status].label}</Badge>,
  },
  {
    key: "published",
    header: "Last published",
    className: "text-muted-foreground tabular-nums",
    cell: (message) => message.publishedAt ?? "Never",
  },
];

export function BuiltMessageList({ messages }: { messages: BuiltMessageListItem[] }) {
  const router = useRouter();

  return (
    <Card className="py-0 sm:py-2">
      <CardContent className="px-0 sm:px-4">
        <DataList
          rows={messages}
          rowKey={(message) => message.id}
          rowHref={(message) => `/discord/messages/${message.id}`}
          columns={COLUMNS}
          actions={(message) => (
            <DeleteBuiltMessageButton
              id={message.id}
              name={message.name}
              published={message.status !== "draft"}
              onDeleted={() => router.refresh()}
            />
          )}
        />
      </CardContent>
    </Card>
  );
}
