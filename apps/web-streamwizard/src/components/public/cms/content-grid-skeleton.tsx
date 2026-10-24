import { Skeleton } from "@repo/ui";

// The /blog and /guides index while the server renders it: hero copy, toolbar,
// featured post and a grid, in the same boxes the real page uses so nothing
// jumps when it lands.

const BONE = "bg-white/[0.06]";

function CardSkeleton() {
  return (
    <li className="flex">
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <Skeleton className={`aspect-video rounded-none ${BONE}`} />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex gap-3">
            <Skeleton className={`h-5 w-20 rounded-full ${BONE}`} />
            <Skeleton className={`h-5 w-16 ${BONE}`} />
          </div>
          <Skeleton className={`h-6 w-4/5 ${BONE}`} />
          <Skeleton className={`h-4 w-full ${BONE}`} />
          <Skeleton className={`h-4 w-2/3 ${BONE}`} />
          <Skeleton className={`mt-2 h-3 w-1/3 ${BONE}`} />
        </div>
      </div>
    </li>
  );
}

export function ContentGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <ul aria-hidden className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </ul>
  );
}

export function ContentIndexSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground" aria-busy="true">
      <span className="sr-only">Loading</span>
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto flex flex-col items-center px-4">
          <Skeleton className={`h-3 w-16 ${BONE}`} />
          <Skeleton className={`mt-5 h-10 w-full max-w-xl ${BONE}`} />
          <Skeleton className={`mt-6 h-5 w-full max-w-lg ${BONE}`} />
        </div>
      </section>
      <section className="container mx-auto flex flex-col gap-8 px-4 py-16">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className={`h-10 w-full sm:max-w-sm ${BONE}`} />
          <Skeleton className={`h-10 w-24 ${BONE}`} />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[14, 20, 24, 18, 22].map((width) => (
            <Skeleton key={width} className={`h-8 shrink-0 rounded-full ${BONE}`} style={{ width: `${width * 4}px` }} />
          ))}
        </div>
        <Skeleton className={`h-[420px] w-full rounded-2xl ${BONE} lg:h-80`} />
        <ContentGridSkeleton />
      </section>
    </div>
  );
}
