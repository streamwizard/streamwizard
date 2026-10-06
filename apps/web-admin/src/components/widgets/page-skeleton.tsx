import { Card, CardContent, CardHeader, Skeleton } from "@repo/ui";
import { StatGrid } from "@/components/widgets/stat-grid";

const clampCols = (count: number) => Math.min(6, Math.max(2, count)) as 2 | 3 | 4 | 5 | 6;

/** Generic loading state: header + a row of stat cards + chart/table blocks.
 * Route-level loading.tsx files compose this with page-appropriate counts. */
export function PageSkeleton({ statCards = 4, blocks = 2 }: { statCards?: number; blocks?: number }) {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-24 mt-1" />
      </div>
      {statCards > 0 && (
        <StatGrid cols={clampCols(statCards)}>
          {Array.from({ length: statCards }, (_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-20" />
              </CardContent>
            </Card>
          ))}
        </StatGrid>
      )}
      {Array.from({ length: blocks }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-60 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
