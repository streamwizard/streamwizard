"use client";

import { Database } from "@/types/supabase";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_INFO, getEventById, parseActionString } from "@/lib/actions/action-registry";

type Action = Database["public"]["Tables"]["smp_actions"]["Row"];

interface ActionsTableProps {
  data: Action[];
}

export function ActionsTable({ data }: ActionsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: string) => {
    router.push(`/dashboard/smp/admin/actions/${id}`);
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((item) => {
              const parsed = parseActionString(item.action);
              const event = parsed ? getEventById(parsed.eventId) : null;
              const categoryInfo = parsed ? CATEGORY_INFO[parsed.category] : null;

              return (
                <TableRow
                  key={item.id}
                  onClick={() => handleRowClick(item.id)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {categoryInfo?.icon} {categoryInfo?.label || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{event?.label || parsed?.eventId || "Unknown"}</span>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {item.description || (
                      <span className="text-muted-foreground text-sm">No description</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No actions found. Create your first one!
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

