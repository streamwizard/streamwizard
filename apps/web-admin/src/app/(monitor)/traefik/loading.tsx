import { PageSkeleton } from "@/components/shared/page/page-skeleton";

export default function Loading() {
  return <PageSkeleton statCards={6} blocks={3} />;
}
