import { Card, CardContent, CardFooter, CardHeader, Skeleton } from "@repo/ui";
import { DETAILS_GRID } from "@/components/clips/clips-details-view";
import { cn } from "@/lib/utils";

export function ClipsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Card className="w-full max-w-md overflow-hidden" key={index}>
          <CardHeader className="p-0">
            <div className="relative">
              <Skeleton className="w-full h-48" />
              <Skeleton className="absolute top-2 left-2 h-5 w-16" />
              <Skeleton className="absolute bottom-2 left-2 h-5 w-20" />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
          <CardFooter className="p-4 pt-0 flex justify-between">
            <div className="flex items-center space-x-1">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="flex items-center space-x-1">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function ClipsDetailsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/50">
      <div className="overflow-x-auto">
        <div className="min-w-[880px]">
          <div className={cn(DETAILS_GRID, "border-b border-border bg-muted/40 px-3 py-2")}>
            <span aria-hidden />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-14" />
            ))}
            <span aria-hidden />
          </div>

          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className={cn(DETAILS_GRID, "border-b border-border/50 px-3 py-2 last:border-b-0")}>
              <Skeleton className="h-10 w-16 shrink-0 rounded" />
              <Skeleton className="h-4 w-full max-w-[220px]" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
              <span aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
