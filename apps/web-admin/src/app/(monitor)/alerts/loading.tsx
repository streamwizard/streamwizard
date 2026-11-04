import { PageSkeleton } from "@/components/shared/page/page-skeleton";

export default function Loading() {
  return <PageSkeleton statCards={3} blocks={1} />;
}
