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

type ChannelPoint = Database["public"]["Tables"]["smp_channelpoints_templates"]["Row"];

interface ChannelPointsTableProps {
  data: ChannelPoint[];
}

export function ChannelPointsTable({ data }: ChannelPointsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: string) => {
    router.push(`/dashboard/smp/admin/channel-points/${id}`);
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>User Input</TableHead>
            <TableHead>Cooldown</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((item) => (
              <TableRow
                key={item.id}
                onClick={() => handleRowClick(item.id)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>{item.cost.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={item.is_enabled ? "default" : "secondary"}>
                    {item.is_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.is_user_input_required ? (
                    <Badge variant="outline">Required</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Not required</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.is_global_cooldown_enabled ? (
                    <span className="text-sm">{item.global_cooldown_seconds}s</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No channel points found. Create your first one!
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

