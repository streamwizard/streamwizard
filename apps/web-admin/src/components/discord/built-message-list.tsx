"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
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

export function BuiltMessageList({ messages }: { messages: BuiltMessageListItem[] }) {
  const router = useRouter();

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last published</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  <Link href={`/discord/messages/${message.id}`} className="font-medium hover:underline">
                    {message.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{message.channel}</TableCell>
                <TableCell>
                  <Badge variant={STATUS[message.status].variant}>{STATUS[message.status].label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{message.publishedAt ?? "Never"}</TableCell>
                <TableCell>
                  <DeleteBuiltMessageButton
                    id={message.id}
                    name={message.name}
                    published={message.status !== "draft"}
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
