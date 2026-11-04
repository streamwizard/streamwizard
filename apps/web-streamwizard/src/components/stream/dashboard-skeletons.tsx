import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return <Skeleton className="h-72 w-full rounded-xl" />;
}

export function HourlyStatsSkeleton() {
  return <Skeleton className="h-72 w-full rounded-xl" />;
}

export function CategoryStatsSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

export function FeedSkeleton() {
  return <Skeleton className="h-96 w-full rounded-xl" />;
}

export function ListSkeleton() {
  return <Skeleton className="h-56 w-full rounded-xl" />;
}
