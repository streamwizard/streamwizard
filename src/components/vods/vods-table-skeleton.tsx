"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface VodsTableSkeletonProps {
    rows?: number;
}

/**
 * Skeleton loading state for the VODs table
 */
export function VodsTableSkeleton({ rows = 5 }: VodsTableSkeletonProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]">
                        <Skeleton className="h-4 w-4" />
                    </TableHead>
                    <TableHead className="w-[140px]">Thumbnail</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Duration</TableHead>
                    <TableHead className="w-[100px]">Views</TableHead>
                    <TableHead className="w-[120px]">Created</TableHead>
                    <TableHead className="w-[80px]">Language</TableHead>
                    <TableHead className="w-[80px]">Type</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: rows }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell>
                            <Skeleton className="h-4 w-4" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-[72px] w-[128px] rounded" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-[200px]" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-[60px]" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-[50px]" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-[80px]" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-[40px]" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-[60px]" />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
